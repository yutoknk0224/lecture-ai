import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'

type ItemInput = {
  date: string; purpose: string; departure: string; destination: string
  transport: string; category: string; amount: number; notes: string
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
    total += Number(item.amount)
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { title?: string; period?: string; items?: ItemInput[] }
    const buf = await buildExcelBuffer(body.title ?? '', body.period ?? '', body.items ?? [])
    return new NextResponse(buf.buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''%E6%97%85%E8%B2%BB%E7%B2%BE%E7%AE%97%E6%9B%B8_preview.xlsx`,
      },
    })
  } catch (e) {
    console.error('[/api/expense/export/preview]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
