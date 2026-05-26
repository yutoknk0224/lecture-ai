import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import ExcelJS from 'exceljs'
import path from 'path'
import { readFile } from 'fs/promises'

const WEEKDAY_JA = ['月', '火', '水', '木', '金', '土', '日']

function weekdayJa(y: number, m: number, d: number): string {
  const dt = new Date(y, m - 1, d)
  const dow = dt.getDay() // 0=Sun
  return WEEKDAY_JA[dow === 0 ? 6 : dow - 1]
}

function parsePeriod(period: string) {
  const m = period.match(/(\d{4})年(\d{1,2})月(\d{1,2})[〜~～\-](\d{1,2})日/)
  if (m) {
    const [, y, mo, d1, d2] = m.map(Number)
    return { dy: y, dm: mo, dd: d1, ry: y, rm: mo, rd: d2 }
  }
  const m2 = period.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/)
  if (m2) {
    const [, y, mo, d] = m2.map(Number)
    return { dy: y, dm: mo, dd: d, ry: y, rm: mo, rd: d }
  }
  return null
}

const CATEGORY_TO_FIELD: Record<string, string> = {
  '宿泊費': 'item_lodging',
  '日当':   'item_daily',
}
const TRANSPORT_TO_FIELD: Record<string, string> = {
  '航空': 'item_aviation', '飛行機': 'item_aviation',
  '新幹線': 'item_rail', '鉄道': 'item_rail', '電車': 'item_rail',
  '特急': 'item_express',
  'バス': 'item_bus',
}

function determineCostField(item: { category: string; transport: string }): string {
  if (CATEGORY_TO_FIELD[item.category]) return CATEGORY_TO_FIELD[item.category]
  for (const [kw, field] of Object.entries(TRANSPORT_TO_FIELD)) {
    if (item.transport.includes(kw)) return field
  }
  if (item.category.includes('交通')) return 'item_rail'
  return 'item_bus'
}

function buildRoute(item: { departure: string; destination: string; purpose: string }): string {
  const dep = item.departure.trim()
  const dest = item.destination.trim()
  if (dep && dest) return `${dep}→${dest}`
  if (dest) return dest
  return item.purpose
}

type ExpenseItem = {
  date: string; purpose: string; departure: string; destination: string
  transport: string; category: string; amount: number; notes: string
}

type EqItem = {
  itemName: string; quantity: number; unitPrice: number; amount: number
  category: string; purchaseDate: string; vendor: string; receiptNo: string; notes: string
}

function parsePeriodRange(period: string): { start: string; end: string } {
  // "2026年5月1日〜31日" / "2026年5月" / "2026年5月1日"
  const range = period.match(/(\d{4})年(\d{1,2})月(\d{1,2})[〜~～\-](\d{1,2})日/)
  if (range) {
    const [, y, mo, d1, d2] = range
    return {
      start: `${y}/${String(mo).padStart(2,'0')}/${String(d1).padStart(2,'0')}`,
      end:   `${y}/${String(mo).padStart(2,'0')}/${String(d2).padStart(2,'0')}`,
    }
  }
  const single = period.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/)
  if (single) {
    const [, y, mo, d] = single
    const s = `${y}/${String(mo).padStart(2,'0')}/${String(d).padStart(2,'0')}`
    return { start: s, end: s }
  }
  const month = period.match(/(\d{4})年(\d{1,2})月/)
  if (month) {
    const [, y, mo] = month
    return { start: `${y}/${String(mo).padStart(2,'0')}/01`, end: `${y}/${String(mo).padStart(2,'0')}/01` }
  }
  return { start: period, end: period }
}

function equipmentReportToFields(
  report: { title: string; period: string; equipmentItems: EqItem[] },
  personal: Record<string, string | number>
): Record<string, string | number> {
  const now = new Date()
  const applyDate = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')}`
  const { start, end } = parsePeriodRange(report.period)

  const fields: Record<string, string | number> = {
    eq_apply_date:     applyDate,
    eq_period_start:   start,
    eq_period_end:     end,
    eq_applicant_name: personal.student_name ?? personal.eq_applicant_name ?? '',
    eq_department:     personal.supervisor_affiliation ?? personal.eq_department ?? '',
    eq_approver:       personal.supervisor_name ?? personal.eq_approver ?? '',
    eq_payment_method: personal.eq_payment_method ?? '',
    ...personal,
  }

  const items = [...report.equipmentItems]
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    fields[`eq_date_${i}`]       = it.purchaseDate || ''
    fields[`eq_name_${i}`]       = it.itemName
    fields[`eq_category_${i}`]   = it.category || ''
    fields[`eq_qty_${i}`]        = it.quantity
    fields[`eq_price_${i}`]      = it.unitPrice
    fields[`eq_vendor_${i}`]     = it.vendor || ''
    fields[`eq_receipt_no_${i}`] = it.receiptNo || ''
    fields[`eq_notes_${i}`]      = it.notes || ''
  }
  return fields
}

function reportToFields(
  report: { title: string; period: string; items: ExpenseItem[] },
  personal: Record<string, string | number>
): Record<string, string | number> {
  const now = new Date()
  const fields: Record<string, string | number> = {
    created_year:  now.getFullYear(),
    created_month: now.getMonth() + 1,
    created_day:   now.getDate(),
    purpose: report.title,
    ...personal,
  }

  const parsed = parsePeriod(report.period)
  if (parsed) {
    const { dy, dm, dd, ry, rm, rd } = parsed
    fields.depart_year    = dy
    fields.depart_month   = dm
    fields.depart_day     = dd
    fields.depart_weekday = weekdayJa(dy, dm, dd)
    fields.depart_hour    = 9
    fields.depart_minute  = '00'
    fields.return_year    = ry
    fields.return_month   = rm
    fields.return_day     = rd
    fields.return_weekday = weekdayJa(ry, rm, rd)
    fields.return_hour    = 18
    fields.return_minute  = '00'
  }

  const items = [...report.items].sort((a, b) => a.date.localeCompare(b.date))
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const d = new Date(item.date + 'T00:00:00')
    const yy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd2 = String(d.getDate()).padStart(2, '0')
    fields[`item_date_${i}`]  = `${yy}/${mm}/${dd2}`
    fields[`item_route_${i}`] = buildRoute(item)
    const cf = determineCostField(item)
    fields[`${cf}_${i}`] = item.amount
    if (item.notes) fields[`item_notes_${i}`] = item.notes
  }

  return fields
}

// マージセルの主セルアドレスを返す
function getPrimaryAddress(ws: ExcelJS.Worksheet, addr: string): string {
  const wsModel = (ws as unknown as { model?: { merges?: string[] } }).model
  if (!wsModel?.merges) return addr

  const addrUpper = addr.toUpperCase()
  const toRC = (a: string) => {
    const m = a.match(/^([A-Z]+)(\d+)$/)
    if (!m) return null
    const c = m[1].split('').reduce((acc, ch) => acc * 26 + ch.charCodeAt(0) - 64, 0)
    return { r: parseInt(m[2]), c }
  }
  const target = toRC(addrUpper)
  if (!target) return addr

  for (const merge of wsModel.merges) {
    const [a, b] = merge.split(':')
    if (!a || !b) continue
    const start = toRC(a.toUpperCase())
    const end   = toRC(b.toUpperCase())
    if (!start || !end) continue
    if (target.r >= start.r && target.r <= end.r && target.c >= start.c && target.c <= end.c) {
      return a  // 主セルのアドレスを返す
    }
  }
  return addr
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const { id } = await params
  const template = await prisma.excelTemplate.findUnique({
    where: { id },
    include: { mappings: true },
  })
  if (!template?.filePath) return NextResponse.json({ error: 'No file' }, { status: 404 })

  const { reportId, personalInfo } = await req.json() as {
    reportId: string
    personalInfo?: Record<string, string | number>
  }

  const report = await prisma.expenseReport.findUnique({
    where: { id: reportId },
    include: { items: true, equipmentItems: true },
  })
  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

  // AppSettings はサーバー再起動後に有効になる。それまでは personalInfo のみ使用
  let savedProfile: Record<string, string | number> = {}
  try {
    const settings = await (prisma as unknown as { appSettings?: { findUnique: (a: unknown) => Promise<{ profileJson: string } | null> } }).appSettings?.findUnique({ where: { id: 'singleton' } })
    if (settings) savedProfile = JSON.parse(settings.profileJson)
  } catch { /* ignore: Prisma client restart needed */ }
  const personal = { ...savedProfile, ...(personalInfo ?? {}) }

  const fields = report.reportType === 'equipment'
    ? equipmentReportToFields(report, personal)
    : reportToFields(report, personal)

  const absPath = path.join(process.cwd(), 'public', template.filePath)
  let buffer: Buffer
  try { buffer = await readFile(absPath) }
  catch { return NextResponse.json({ error: 'File not found' }, { status: 404 }) }

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer)

  const written: string[] = []
  const writtenAddrs = new Set<string>()  // 同じセルへの重複書き込みを防ぐ

  for (const mapping of template.mappings) {
    const val = fields[mapping.fieldKey]
    if (val === undefined || val === null || val === '') continue

    const wsName = template.sheetName
    const ws = wsName ? (wb.getWorksheet(wsName) ?? wb.worksheets[0]) : wb.worksheets[0]
    if (!ws) continue

    // マージセルの場合は主セルに書き込む
    const primaryAddr = getPrimaryAddress(ws, mapping.cellAddress)
    const dedupeKey = `${wsName}!${primaryAddr}`
    if (writtenAddrs.has(dedupeKey)) continue
    writtenAddrs.add(dedupeKey)

    const cell = ws.getCell(primaryAddr)
    const num = typeof val === 'number' ? val : Number(val)
    cell.value = (!isNaN(num) && typeof val === 'number') ? num
      : (typeof val === 'string' && /^\d+$/.test(val.trim())) ? parseInt(val)
      : val

    written.push(`${primaryAddr}=${val}`)
  }

  const outBuf = await wb.xlsx.writeBuffer()
  const fileName = encodeURIComponent(`精算書_${report.title}.xlsx`)
  return new NextResponse(outBuf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${fileName}`,
    },
  })
  } catch (e) {
    console.error('[generate] error:', e)
    return NextResponse.json({ error: String(e), stack: e instanceof Error ? e.stack : undefined }, { status: 500 })
  }
}
