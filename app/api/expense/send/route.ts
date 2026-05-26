import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'

async function getAccessToken(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get('google_access_token')?.value
  if (!token) return null
  const check = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (check.ok) return token

  const refresh = req.cookies.get('google_refresh_token')?.value
  if (!refresh) return null
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refresh,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json() as { access_token?: string }
  return data.access_token ?? null
}

type ItemInput = {
  date: string
  purpose: string
  departure: string
  destination: string
  transport: string
  category: string
  amount: number
  notes: string
}

async function buildExcelBuffer(title: string, period: string, items: ItemInput[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('旅費精算書')

  ws.mergeCells('A1:H1')
  const t = ws.getCell('A1')
  t.value = '旅費精算書'
  t.font = { size: 16, bold: true }
  t.alignment = { horizontal: 'center' }

  ws.mergeCells('A2:H2')
  const s = ws.getCell('A2')
  s.value = `${title}　対象期間：${period}`
  s.alignment = { horizontal: 'center' }
  s.font = { size: 11 }

  ws.addRow([])

  const headerRow = ws.addRow(['日付', '目的', '出発地', '目的地', '交通手段', '費目', '金額（円）', '備考'])
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true }
    cell.alignment = { horizontal: 'center' }
    cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
  })

  let total = 0
  for (const item of items) {
    const row = ws.addRow([item.date, item.purpose, item.departure, item.destination, item.transport, item.category, item.amount, item.notes])
    total += item.amount
    row.eachCell(cell => {
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
    })
    row.getCell(7).numFmt = '#,##0'
    row.getCell(7).alignment = { horizontal: 'right' }
  }

  ws.addRow([])
  const totalRow = ws.addRow(['', '', '', '', '', '合計', total, ''])
  totalRow.getCell(6).font = { bold: true }
  totalRow.getCell(7).numFmt = '#,##0'
  totalRow.getCell(7).font = { bold: true }
  totalRow.getCell(7).alignment = { horizontal: 'right' }

  ws.columns = [{ width: 12 }, { width: 24 }, { width: 14 }, { width: 16 }, { width: 14 }, { width: 10 }, { width: 14 }, { width: 24 }]

  return Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer)
}

function buildMimeMessage(opts: {
  to: string; cc: string; subject: string; body: string
  attachmentBuffer: Buffer; attachmentFilename: string; attachmentMime?: string
}): string {
  const boundary = `boundary_${Date.now()}`
  const base64File = opts.attachmentBuffer.toString('base64')
  const encodedFilename = encodeURIComponent(opts.attachmentFilename)
  const mime = opts.attachmentMime ?? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

  const raw = [
    `MIME-Version: 1.0`,
    `To: ${opts.to}`,
    ...(opts.cc ? [`Cc: ${opts.cc}`] : []),
    `Subject: =?UTF-8?B?${Buffer.from(opts.subject).toString('base64')}?=`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=utf-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    Buffer.from(opts.body).toString('base64'),
    ``,
    `--${boundary}`,
    `Content-Type: ${mime}`,
    `Content-Disposition: attachment; filename*=UTF-8''${encodedFilename}`,
    `Content-Transfer-Encoding: base64`,
    ``,
    base64File,
    ``,
    `--${boundary}--`,
  ].join('\r\n')

  return Buffer.from(raw).toString('base64url')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      reportId?: string
      title?: string
      period?: string
      items?: ItemInput[]
      to?: string
      cc?: string
      subject?: string
      body?: string
      templateId?: string
      // Local file mode
      attachmentBase64?: string
      attachmentFilename?: string
      attachmentMime?: string
    }

    const { to, cc = '', subject, body: emailBody } = body

    if (!to || !subject) {
      return NextResponse.json({ error: 'to と subject は必須です' }, { status: 400 })
    }

    const accessToken = await getAccessToken(req)
    if (!accessToken) {
      return NextResponse.json({ error: 'Google認証が必要です', needsReauth: true }, { status: 401 })
    }

    // Determine attachment buffer
    let attachmentBuffer: Buffer
    let filename: string
    let attachmentMime: string | undefined

    if (body.attachmentBase64 && body.attachmentFilename) {
      // Local file mode: use provided base64 file
      attachmentBuffer = Buffer.from(body.attachmentBase64, 'base64')
      filename = body.attachmentFilename
      attachmentMime = body.attachmentMime
    } else {
      // Auto-generate from expense data
      const report = body.reportId
        ? await import('@/app/lib/prisma').then(m => m.prisma.expenseReport.findUnique({
            where: { id: body.reportId },
            include: { items: { orderBy: { date: 'asc' } } },
          }))
        : null

      if (!report && !body.title) {
        return NextResponse.json({ error: 'reportId または title/items が必要です' }, { status: 400 })
      }

      const title = body.title ?? report?.title ?? ''
      const period = body.period ?? report?.period ?? ''
      const items: ItemInput[] = body.items ?? report?.items?.map(i => ({
        date: i.date, purpose: i.purpose, departure: i.departure,
        destination: i.destination, transport: i.transport,
        category: i.category, amount: i.amount, notes: i.notes,
      })) ?? []

      attachmentBuffer = await buildExcelBuffer(title, period, items)
      filename = `旅費精算書_${period}.xlsx`
    }

    const raw = buildMimeMessage({ to, cc, subject, body: emailBody ?? '', attachmentBuffer, attachmentFilename: filename, attachmentMime })

    const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    })

    if (!sendRes.ok) {
      const err = await sendRes.json() as { error?: { message?: string; status?: string; code?: number } }
      const status = err.error?.status ?? ''
      if (status === 'PERMISSION_DENIED' || status === 'UNAUTHENTICATED' || sendRes.status === 403 || sendRes.status === 401) {
        return NextResponse.json({ error: 'Gmail送信の権限がありません。再認証が必要です。', needsReauth: true }, { status: 403 })
      }
      throw new Error(err.error?.message ?? `Gmail API error: ${sendRes.status}`)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[/api/expense/send]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
