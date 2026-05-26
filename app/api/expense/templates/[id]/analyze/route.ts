import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import ExcelJS from 'exceljs'
import path from 'path'
import { readFile } from 'fs/promises'

export type CandidateCell = {
  address: string
  row: number
  col: number
  confidence: number   // 1–3
  reasons: string[]
  exampleValue: string
  currentValue: string
}

export type ItemRange = {
  col: string
  startRow: number
  endRow: number
  count: number
}

export type AnalyzeResult = {
  candidates: CandidateCell[]
  itemRanges: ItemRange[]
  sheetNames: string[]
}

function addrToRC(addr: string): { r: number; c: number } | null {
  const m = addr.match(/^([A-Z]+)(\d+)$/)
  if (!m) return null
  const c = m[1].split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0)
  return { r: parseInt(m[2]), c }
}

function colLetter(n: number): string {
  let s = ''
  while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) }
  return s
}

// ─── 手がかり①: 数式参照 ─────────────────────────────────────────────────────
function findFormulaRefs(wb: ExcelJS.Workbook, targetSheet: ExcelJS.Worksheet): Set<string> {
  const refs = new Set<string>()
  const targetName = targetSheet.name

  for (const ws of wb.worksheets) {
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        let formula = ''
        const v = cell.value
        if (typeof v === 'object' && v !== null && 'formula' in v) {
          formula = (v as { formula: string }).formula ?? ''
        }
        if (!formula) return

        // 他シート参照: ='Sheet'!A1 または =Sheet!A1
        const crossRe = /(?:'([^']+)'|(\w[\w ]*))!([A-Z]+\d+)/g
        let m: RegExpExecArray | null
        while ((m = crossRe.exec(formula)) !== null) {
          const sname = m[1] ?? m[2]
          if (sname === targetName) refs.add(m[3])
        }

        // 同一シート参照
        if (ws.name === targetName) {
          const sameRe = /(?<![A-Z!:])([A-Z]+\d+)(?!\d)/g
          while ((m = sameRe.exec(formula)) !== null) {
            refs.add(m[1])
          }
        }
      })
    })
  }
  return refs
}

// ─── 手がかり②: 入力例シートの値 ────────────────────────────────────────────
const EXAMPLE_KEYWORDS = ['入力例', '記入例', 'サンプル', 'example', 'sample']

function findExampleSheet(wb: ExcelJS.Workbook): ExcelJS.Worksheet | null {
  for (const ws of wb.worksheets) {
    if (EXAMPLE_KEYWORDS.some((k) => ws.name.toLowerCase().includes(k.toLowerCase()))) return ws
  }
  return null
}

function getExampleValues(exWs: ExcelJS.Worksheet, targetWs: ExcelJS.Worksheet): Map<string, string> {
  const result = new Map<string, string>()
  exWs.eachRow({ includeEmpty: false }, (row, r) => {
    row.eachCell({ includeEmpty: false }, (cell, c) => {
      if (typeof cell.value === 'object' && cell.value !== null && 'formula' in cell.value) return
      const addr = `${colLetter(c)}${r}`
      const targetCell = targetWs.getCell(addr)
      const exVal = String(cell.value ?? '').trim()
      const tVal = String(targetCell.value ?? '').trim()
      if (exVal && exVal !== tVal) result.set(addr, exVal)
    })
  })
  return result
}

// ─── 手がかり③: SUM範囲から明細行を特定 ─────────────────────────────────────
function findItemRows(ws: ExcelJS.Worksheet): ItemRange[] {
  const found = new Map<string, number>()  // "col,r1,r2" -> count
  const SUM_RE = /SUM\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)/gi

  ws.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      let formula = ''
      const v = cell.value
      if (typeof v === 'object' && v !== null && 'formula' in v) {
        formula = (v as { formula: string }).formula ?? ''
      }
      if (!formula) return
      let m: RegExpExecArray | null
      while ((m = SUM_RE.exec(formula)) !== null) {
        const [, c1, r1, c2, r2] = m
        if (c1 !== c2) continue  // 同一列のSUMのみ
        const key = `${c1},${r1},${r2}`
        found.set(key, (found.get(key) ?? 0) + 1)
      }
    })
  })

  const seenRanges = new Set<string>()
  const results: ItemRange[] = []
  for (const [key, count] of [...found.entries()].sort((a, b) => b[1] - a[1])) {
    const [col, r1, r2] = key.split(',')
    const rangeKey = `${r1},${r2}`
    if (seenRanges.has(rangeKey)) continue
    seenRanges.add(rangeKey)
    results.push({ col, startRow: parseInt(r1), endRow: parseInt(r2), count })
  }
  return results
}

// ─── 手がかり④: 単位ラベル隣接 ──────────────────────────────────────────────
const UNIT_LABELS = new Set(['年', '月', '日', '曜日', '：', '時', '分'])

function findAdjacentInputs(ws: ExcelJS.Worksheet): Set<string> {
  const result = new Set<string>()
  ws.eachRow({ includeEmpty: false }, (row, r) => {
    row.eachCell({ includeEmpty: false }, (cell, c) => {
      if (UNIT_LABELS.has(String(cell.value ?? ''))) {
        if (c > 1) result.add(`${colLetter(c - 1)}${r}`)
      }
    })
  })
  return result
}

// ─── メイン解析 ──────────────────────────────────────────────────────────────
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const template = await prisma.excelTemplate.findUnique({ where: { id } })
  if (!template?.filePath) return NextResponse.json({ error: 'No file' }, { status: 404 })

  const absPath = path.join(process.cwd(), 'public', template.filePath)
  let buffer: Buffer
  try { buffer = await readFile(absPath) }
  catch { return NextResponse.json({ error: 'File not found' }, { status: 404 }) }

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer)

  const targetWs = template.sheetName
    ? (wb.getWorksheet(template.sheetName) ?? wb.worksheets[0])
    : wb.worksheets[0]
  if (!targetWs) return NextResponse.json({ error: 'Sheet not found' }, { status: 400 })

  const formulaRefs  = findFormulaRefs(wb, targetWs)
  const exampleWs    = findExampleSheet(wb)
  const exampleVals  = exampleWs ? getExampleValues(exampleWs, targetWs) : new Map<string, string>()
  const itemRanges   = findItemRows(targetWs)
  const adjacent     = findAdjacentInputs(targetWs)

  const candidateAddrs = new Set<string>([
    ...formulaRefs,
    ...exampleVals.keys(),
    ...adjacent,
  ])

  // マージセルの主セルセット
  const wsModel = (targetWs as unknown as { model?: { merges?: string[] } }).model
  const primaryCells = new Set<string>()
  const nonPrimaryCells = new Set<string>()
  if (wsModel?.merges) {
    for (const merge of wsModel.merges) {
      const [a] = merge.split(':')
      primaryCells.add(a.toUpperCase())
      const [start, end] = merge.split(':').map((x) => addrToRC(x.toUpperCase()))
      if (!start || !end) continue
      for (let r = start.r; r <= end.r; r++) {
        for (let c = start.c; c <= end.c; c++) {
          const addr = `${colLetter(c)}${r}`
          if (r !== start.r || c !== start.c) nonPrimaryCells.add(addr)
        }
      }
    }
  }

  const candidates: CandidateCell[] = []
  for (const addr of candidateAddrs) {
    const addrUpper = addr.toUpperCase()
    if (nonPrimaryCells.has(addrUpper)) continue  // マージ非主セルはスキップ

    const cell = targetWs.getCell(addr)
    const v = cell.value
    if (typeof v === 'object' && v !== null && 'formula' in v) continue  // 数式セルはスキップ

    const reasons: string[] = []
    if (formulaRefs.has(addr))      reasons.push('数式参照')
    if (exampleVals.has(addr))      reasons.push(`入力例: ${exampleVals.get(addr)?.slice(0, 20)}`)
    if (adjacent.has(addr))         reasons.push('単位ラベル隣接')

    const rc = addrToRC(addrUpper)
    candidates.push({
      address:      addrUpper,
      row:          rc?.r ?? 0,
      col:          rc?.c ?? 0,
      confidence:   reasons.length,
      reasons,
      exampleValue: exampleVals.get(addr) ?? '',
      currentValue: String(v ?? ''),
    })
  }

  candidates.sort((a, b) => a.row - b.row || a.col - b.col)

  return NextResponse.json({
    candidates,
    itemRanges,
    sheetNames: wb.worksheets.map((ws) => ws.name),
  } satisfies AnalyzeResult)
}
