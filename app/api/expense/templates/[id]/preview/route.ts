import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import ExcelJS from 'exceljs'
import path from 'path'
import { readFile } from 'fs/promises'

export type BorderEdge = { style?: string; color?: string }

export type CellOut = {
  r: number
  c: number
  v: string
  cs: number      // colSpan
  rs: number      // rowSpan
  bold?: boolean
  italic?: boolean
  fontSize?: number
  fontColor?: string
  bg?: string
  align?: string  // left | center | right | fill
  valign?: string // top | middle | bottom
  wrap?: boolean
  bt?: string     // border-top css value
  bb?: string
  bl?: string
  br?: string
}

export type PreviewData = {
  cells: CellOut[]
  maxRow: number
  maxCol: number
  colWidths: number[]  // px, index 0 = col 1
  rowHeights: number[] // px, index 0 = row 1
}

function addrToRC(addr: string): { r: number; c: number } {
  const m = addr.match(/^([A-Z]+)(\d+)$/)
  if (!m) return { r: 0, c: 0 }
  const c = m[1].split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0)
  return { r: parseInt(m[2]), c }
}

function borderCss(edge: ExcelJS.Border | undefined): string | undefined {
  if (!edge?.style) return undefined
  const s = edge.style as string
  const color = edge.color?.argb ? `#${edge.color.argb.slice(2)}` : '#9ca3af'
  const width = ['medium', 'thick', 'double'].includes(s) ? '2px' : '1px'
  const lineStyle = s === 'dashed' || s === 'dashDot' ? 'dashed'
    : s === 'dotted' ? 'dotted'
    : s === 'double' ? 'double'
    : 'solid'
  return `${width} ${lineStyle} ${color}`
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const template = await prisma.excelTemplate.findUnique({ where: { id } })
  if (!template?.filePath) return NextResponse.json({ error: 'No file' }, { status: 404 })

  const absPath = path.join(process.cwd(), 'public', template.filePath)
  let buffer: Buffer
  try { buffer = await readFile(absPath) }
  catch { return NextResponse.json({ error: 'File not found on disk' }, { status: 404 }) }

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer)

  const ws = template.sheetName
    ? (wb.getWorksheet(template.sheetName) ?? wb.worksheets[0])
    : wb.worksheets[0]
  if (!ws) return NextResponse.json({ error: 'Sheet not found' }, { status: 400 })

  const MAX_ROW = 100
  const MAX_COL = 30

  // ── マージセル解析 ──────────────────────────────────────────────────────────
  const mergeMap = new Map<string, { cs: number; rs: number }>()
  const skipSet = new Set<string>()
  const wsModel = (ws as unknown as { model?: { merges?: string[] } }).model
  if (wsModel?.merges) {
    for (const ms of wsModel.merges) {
      const [a, b] = ms.split(':')
      if (!a || !b) continue
      const s = addrToRC(a), e = addrToRC(b)
      const cs = e.c - s.c + 1, rs = e.r - s.r + 1
      mergeMap.set(`${s.r},${s.c}`, { cs, rs })
      for (let r = s.r; r <= e.r; r++)
        for (let c = s.c; c <= e.c; c++)
          if (r !== s.r || c !== s.c) skipSet.add(`${r},${c}`)
    }
  }

  // ── セルデータ収集 ─────────────────────────────────────────────────────────
  const cells: CellOut[] = []
  let maxRow = 0, maxCol = 0

  ws.eachRow({ includeEmpty: false }, (row, r) => {
    if (r > MAX_ROW) return
    row.eachCell({ includeEmpty: false }, (cell, c) => {
      if (c > MAX_COL) return
      if (skipSet.has(`${r},${c}`)) return
      maxRow = Math.max(maxRow, r)
      maxCol = Math.max(maxCol, c)

      // セル値
      let v = ''
      const val = cell.value
      if (val !== null && val !== undefined) {
        if (typeof val === 'object') {
          const o = val as unknown as Record<string, unknown>
          if ('richText' in o) v = (o.richText as { text: string }[]).map(t => t.text).join('')
          else if ('result' in o) v = String(o.result ?? '')
          else if ('text' in o) v = String(o.text)
          else if (val instanceof Date) v = val.toLocaleDateString('ja-JP')
          else v = String(val)
        } else {
          v = String(val)
        }
      }

      const merge = mergeMap.get(`${r},${c}`)
      const out: CellOut = { r, c, v, cs: merge?.cs ?? 1, rs: merge?.rs ?? 1 }

      // フォント
      if (cell.font?.bold) out.bold = true
      if (cell.font?.italic) out.italic = true
      if (cell.font?.size) out.fontSize = cell.font.size
      if (cell.font?.color?.argb) {
        const fg = cell.font.color.argb
        if (!['FF000000', '00000000'].includes(fg)) out.fontColor = `#${fg.slice(2)}`
      }

      // 背景色
      if (cell.fill?.type === 'pattern') {
        const fg = (cell.fill as unknown as { fgColor?: { argb?: string } }).fgColor?.argb
        if (fg && !['FF000000', '00000000', 'FFFFFFFF', '00FFFFFF'].includes(fg))
          out.bg = `#${fg.slice(2)}`
      }

      // 配置
      if (cell.alignment?.horizontal) out.align = cell.alignment.horizontal as string
      if (cell.alignment?.vertical) out.valign = cell.alignment.vertical as string
      if (cell.alignment?.wrapText) out.wrap = true

      // 罫線
      if (cell.border) {
        const border = cell.border as Record<string, ExcelJS.Border | undefined>
        const bt = borderCss(border.top)
        const bb = borderCss(border.bottom)
        const bl = borderCss(border.left)
        const br = borderCss(border.right)
        if (bt) out.bt = bt
        if (bb) out.bb = bb
        if (bl) out.bl = bl
        if (br) out.br = br
      }

      cells.push(out)
    })
  })

  // ── 列幅・行高 ─────────────────────────────────────────────────────────────
  const colWidths: number[] = []
  for (let c = 1; c <= Math.min(maxCol, MAX_COL); c++) {
    const col = ws.getColumn(c)
    colWidths.push(Math.max(Math.round((col.width ?? 8.43) * 8), 32))
  }

  const rowHeights: number[] = []
  for (let r = 1; r <= Math.min(maxRow, MAX_ROW); r++) {
    const row = ws.getRow(r)
    rowHeights.push(Math.max(Math.round((row.height ?? 15) * 1.5), 18))
  }

  return NextResponse.json({
    cells,
    maxRow: Math.min(maxRow, MAX_ROW),
    maxCol: Math.min(maxCol, MAX_COL),
    colWidths,
    rowHeights,
  } satisfies PreviewData)
}
