import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import ExcelJS from 'exceljs'
import path from 'path'
import { readFile } from 'fs/promises'

type CellEdit = { address: string; value: string }

async function refreshTokenIfNeeded(req: NextRequest): Promise<string | null> {
  const accessToken = req.cookies.get('ms_access_token')?.value
  if (accessToken) {
    const check = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (check.ok) return accessToken
  }

  const refreshToken = req.cookies.get('ms_refresh_token')?.value
  if (!refreshToken) return null

  const tokenRes = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  const tokens = await tokenRes.json()
  return tokens.access_token ?? null
}

export async function POST(req: NextRequest) {
  const accessToken = await refreshTokenIfNeeded(req)
  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated', needsAuth: true }, { status: 401 })
  }

  const { templateId, edits }: { templateId: string; edits?: CellEdit[] } = await req.json()

  const template = await prisma.excelTemplate.findUnique({ where: { id: templateId } })
  if (!template?.filePath) return NextResponse.json({ error: 'No file' }, { status: 404 })

  const absPath = path.join(process.cwd(), 'public', template.filePath)
  let buffer: Buffer
  try { buffer = await readFile(absPath) }
  catch { return NextResponse.json({ error: 'File not found on disk' }, { status: 404 }) }

  // Apply current edits to the buffer before uploading
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

  const timestamp = Date.now()
  const fileName = `精算書_${template.name}_${timestamp}.xlsx`
  const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/ClaudeExpense/${encodeURIComponent(fileName)}:/content`

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
    body: buffer as unknown as BodyInit,
  })

  if (!uploadRes.ok) {
    const err = await uploadRes.text()
    return NextResponse.json({ error: 'OneDriveアップロードに失敗しました', details: err }, { status: 500 })
  }

  const item = await uploadRes.json()
  const webUrl: string = item.webUrl ?? ''

  // Office Online edit URL (personal OneDrive)
  // webUrl is already an Office Online edit link for .xlsx files
  return NextResponse.json({
    editUrl: webUrl,
    fileName,
    itemId: item.id as string,
  })
}
