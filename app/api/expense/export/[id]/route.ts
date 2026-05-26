import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import ExcelJS from 'exceljs'
import path from 'path'
import { readFile } from 'fs/promises'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const templateId = req.nextUrl.searchParams.get('templateId')

  const report = await prisma.expenseReport.findUnique({
    where: { id },
    include: { items: { orderBy: { date: 'asc' } } },
  })
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (templateId) {
    return exportWithTemplate(report, templateId)
  }
  return exportDefault(report)
}

type ReportWithItems = NonNullable<Awaited<ReturnType<typeof prisma.expenseReport.findUnique>>> & {
  items: Awaited<ReturnType<typeof prisma.expenseItem.findMany>>
}

async function exportWithTemplate(report: ReportWithItems, templateId: string) {
  const template = await prisma.excelTemplate.findUnique({
    where: { id: templateId },
    include: { mappings: true },
  })
  if (!template || !template.filePath) {
    return NextResponse.json({ error: 'テンプレートファイルが見つかりません' }, { status: 404 })
  }

  const absPath = path.join(process.cwd(), 'public', template.filePath)
  const fileBuffer = await readFile(absPath)

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(fileBuffer as unknown as ExcelJS.Buffer)

  const ws = template.sheetName
    ? (wb.getWorksheet(template.sheetName) ?? wb.worksheets[0])
    : wb.worksheets[0]

  if (!ws) return NextResponse.json({ error: 'シートが見つかりません' }, { status: 400 })

  const m: Record<string, string> = {}
  for (const mapping of template.mappings) m[mapping.fieldKey] = mapping.cellAddress

  // ヘッダー固定セル
  if (m['REPORT_TITLE'])   ws.getCell(m['REPORT_TITLE']).value = report.title
  if (m['REPORT_PERIOD'])  ws.getCell(m['REPORT_PERIOD']).value = report.period
  if (m['SUBMITTER_NAME']) ws.getCell(m['SUBMITTER_NAME']).value = ''
  if (m['DEPARTMENT'])     ws.getCell(m['DEPARTMENT']).value = ''

  // 明細テーブル
  const startRow = m['ITEMS_START_ROW'] ? parseInt(m['ITEMS_START_ROW'], 10) : null
  const colMap = {
    date:        m['ITEM_DATE_COL'],
    purpose:     m['ITEM_PURPOSE_COL'],
    departure:   m['ITEM_DEPARTURE_COL'],
    destination: m['ITEM_DESTINATION_COL'],
    transport:   m['ITEM_TRANSPORT_COL'],
    category:    m['ITEM_CATEGORY_COL'],
    amount:      m['ITEM_AMOUNT_COL'],
    notes:       m['ITEM_NOTES_COL'],
  }

  if (startRow) {
    report.items.forEach((item, i) => {
      const row = startRow + i
      if (colMap.date)        ws.getCell(`${colMap.date}${row}`).value = item.date
      if (colMap.purpose)     ws.getCell(`${colMap.purpose}${row}`).value = item.purpose
      if (colMap.departure)   ws.getCell(`${colMap.departure}${row}`).value = item.departure
      if (colMap.destination) ws.getCell(`${colMap.destination}${row}`).value = item.destination
      if (colMap.transport)   ws.getCell(`${colMap.transport}${row}`).value = item.transport
      if (colMap.category)    ws.getCell(`${colMap.category}${row}`).value = item.category
      if (colMap.amount)      ws.getCell(`${colMap.amount}${row}`).value = item.amount
      if (colMap.notes)       ws.getCell(`${colMap.notes}${row}`).value = item.notes
    })
  }

  // 合計
  const total = report.items.reduce((s, i) => s + i.amount, 0)
  if (m['TOTAL_AMOUNT']) ws.getCell(m['TOTAL_AMOUNT']).value = total

  const buffer = await wb.xlsx.writeBuffer()
  const fileName = encodeURIComponent(`精算書_${report.period}.xlsx`)
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${fileName}`,
    },
  })
}

async function exportDefault(report: ReportWithItems) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('旅費精算書')

  ws.mergeCells('A1:H1')
  const titleCell = ws.getCell('A1')
  titleCell.value = '旅費精算書'
  titleCell.font = { size: 16, bold: true }
  titleCell.alignment = { horizontal: 'center' }

  ws.mergeCells('A2:H2')
  const subCell = ws.getCell('A2')
  subCell.value = `${report.title}　対象期間：${report.period}`
  subCell.alignment = { horizontal: 'center' }
  subCell.font = { size: 11 }

  ws.addRow([])

  const headerRow = ws.addRow(['日付', '目的', '出発地', '目的地', '交通手段', '費目', '金額（円）', '備考'])
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true }
    cell.alignment = { horizontal: 'center' }
    cell.border = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' },
    }
  })

  let totalAmount = 0
  for (const item of report.items) {
    const row = ws.addRow([
      item.date, item.purpose, item.departure, item.destination,
      item.transport, item.category, item.amount, item.notes,
    ])
    totalAmount += item.amount
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' },
      }
      cell.alignment = { horizontal: 'left' }
    })
    const amountCell = row.getCell(7)
    amountCell.numFmt = '#,##0'
    amountCell.alignment = { horizontal: 'right' }
  }

  ws.addRow([])
  const totalRow = ws.addRow(['', '', '', '', '', '合計', totalAmount, ''])
  totalRow.getCell(6).font = { bold: true }
  totalRow.getCell(7).numFmt = '#,##0'
  totalRow.getCell(7).font = { bold: true }
  totalRow.getCell(7).alignment = { horizontal: 'right' }

  ws.columns = [
    { width: 12 }, { width: 24 }, { width: 14 }, { width: 16 },
    { width: 14 }, { width: 10 }, { width: 14 }, { width: 24 },
  ]

  const buffer = await wb.xlsx.writeBuffer()
  const fileName = encodeURIComponent(`旅費精算書_${report.period}.xlsx`)
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${fileName}`,
    },
  })
}
