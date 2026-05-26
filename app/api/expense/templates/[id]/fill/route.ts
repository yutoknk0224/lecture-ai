import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import ExcelJS from 'exceljs'
import path from 'path'
import { readFile } from 'fs/promises'

type CellEdit = { address: string; value: string }

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const template = await prisma.excelTemplate.findUnique({ where: { id } })
  if (!template?.filePath) return NextResponse.json({ error: 'No file' }, { status: 404 })

  const { edits }: { edits: CellEdit[] } = await req.json()

  const absPath = path.join(process.cwd(), 'public', template.filePath)
  let buffer: Buffer
  try { buffer = await readFile(absPath) }
  catch { return NextResponse.json({ error: 'File not found' }, { status: 404 }) }

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer)

  const ws = template.sheetName
    ? (wb.getWorksheet(template.sheetName) ?? wb.worksheets[0])
    : wb.worksheets[0]
  if (!ws) return NextResponse.json({ error: 'Sheet not found' }, { status: 400 })

  // 編集内容をセルに書き込む（スタイルは保持したまま値のみ更新）
  for (const { address, value } of edits) {
    const cell = ws.getCell(address)
    // 数値として解釈できる場合は数値で保存
    const num = Number(value)
    cell.value = (value !== '' && !isNaN(num) && value.trim() !== '') ? num : (value || null)
  }

  const outBuffer = await wb.xlsx.writeBuffer()
  const fileName = encodeURIComponent(`精算書_${template.name}.xlsx`)
  return new NextResponse(outBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${fileName}`,
    },
  })
}
