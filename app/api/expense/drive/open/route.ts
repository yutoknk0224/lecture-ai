import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import ExcelJS from 'exceljs'
import path from 'path'
import { readFile } from 'fs/promises'

type CellEdit = { address: string; value: string }

async function getValidAccessToken(req: NextRequest): Promise<string | null> {
  const accessToken = req.cookies.get('google_access_token')?.value
  if (accessToken) {
    const check = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (check.ok) return accessToken
  }

  const refreshToken = req.cookies.get('google_refresh_token')?.value
  if (!refreshToken) return null

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  const tokens = await tokenRes.json() as { access_token?: string }
  return tokens.access_token ?? null
}

export async function POST(req: NextRequest) {
  const accessToken = await getValidAccessToken(req)
  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated', needsAuth: true }, { status: 401 })
  }

  // Verify token has drive scope by checking Drive API directly
  const driveCheck = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!driveCheck.ok) {
    const driveErr = await driveCheck.json() as { error?: { message?: string; status?: string } }
    console.error('[Drive API check failed]', driveCheck.status, JSON.stringify(driveErr))
    return NextResponse.json({
      error: `Google Drive APIエラー: ${driveErr.error?.message ?? driveCheck.status}`,
      details: driveErr,
    }, { status: 500 })
  }

  const { templateId, edits }: { templateId: string; edits?: CellEdit[] } = await req.json()

  const template = await prisma.excelTemplate.findUnique({ where: { id: templateId } })
  if (!template?.filePath) return NextResponse.json({ error: 'No file' }, { status: 404 })

  const absPath = path.join(process.cwd(), 'public', template.filePath)
  let buffer: Buffer
  try { buffer = await readFile(absPath) }
  catch { return NextResponse.json({ error: 'File not found on disk' }, { status: 404 }) }

  // Apply edits to buffer before upload
  if (edits && edits.length > 0) {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer)
    const ws = template.sheetName
      ? (wb.getWorksheet(template.sheetName) ?? wb.worksheets[0])
      : wb.worksheets[0]
    if (ws) {
      for (const { address, value } of edits) {
        const cell = ws.getCell(address)
        const num = Number(value)
        cell.value = (value !== '' && !isNaN(num) && value.trim() !== '') ? num : (value || null)
      }
    }
    const filled = await wb.xlsx.writeBuffer()
    buffer = Buffer.from(filled)
  }

  const fileName = `精算書_${template.name}_${Date.now()}.xlsx`

  const boundary = 'boundary_claude_expense'
  const xlsxMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  const metadataStr = JSON.stringify({
    name: fileName,
    mimeType: 'application/vnd.google-apps.spreadsheet',
  })

  // Build multipart body as binary Buffer (no base64)
  const part1 = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadataStr}\r\n`
  )
  const part2Header = Buffer.from(
    `--${boundary}\r\nContent-Type: ${xlsxMime}\r\n\r\n`
  )
  const part2End = Buffer.from(`\r\n--${boundary}--`)
  const body = Buffer.concat([part1, part2Header, buffer, part2End])

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': String(body.length),
      },
      body: body as unknown as BodyInit,
    }
  )

  if (!uploadRes.ok) {
    const err = await uploadRes.text()
    console.error('[Drive upload error]', uploadRes.status, err)
    return NextResponse.json({ error: 'Google Driveへのアップロードに失敗しました', details: err }, { status: 500 })
  }

  const file = await uploadRes.json() as { id: string; name: string }
  const sheetsUrl = `https://docs.google.com/spreadsheets/d/${file.id}/edit`

  return NextResponse.json({ sheetsUrl, fileId: file.id, fileName })
}
