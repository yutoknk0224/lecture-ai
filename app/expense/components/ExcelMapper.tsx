'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { PreviewData, CellOut } from '@/app/api/expense/templates/[id]/preview/route'

type Item = {
  date: string
  purpose: string
  departure: string
  destination: string
  transport: string
  category: string
  amount: number
  notes: string
}

type Props = {
  templateId: string
  templateName: string
  reportTitle: string
  reportPeriod: string
  reportItems: Item[]
  onClose: () => void
}

function colToLetter(c: number): string {
  let s = ''
  while (c > 0) { c--; s = String.fromCharCode(65 + (c % 26)) + s; c = Math.floor(c / 26) }
  return s
}

type GoogleAuthStatus = { authenticated: false } | { authenticated: true; email: string; name: string }

export default function ExcelMapper({ templateId, templateName, reportTitle, reportPeriod, reportItems, onClose }: Props) {
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // key: "r,c" → 編集後の値
  const [edits, setEdits] = useState<Map<string, string>>(new Map())
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number } | null>(null)
  const [editingCell, setEditingCell] = useState<{ r: number; c: number } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [googleAuth, setGoogleAuth] = useState<GoogleAuthStatus | null>(null)
  const [openingInSheets, setOpeningInSheets] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/expense/templates/${templateId}/preview`)
      .then((r) => r.json())
      .then((d: PreviewData) => { setPreview(d); setLoading(false) })
      .catch(() => { setError('プレビューの読み込みに失敗しました'); setLoading(false) })
  }, [templateId])

  useEffect(() => {
    fetch('/api/auth/google/status')
      .then(r => r.json())
      .then((d: GoogleAuthStatus) => setGoogleAuth(d))
      .catch(() => setGoogleAuth({ authenticated: false }))
  }, [])

  // セルを編集モードにする
  const startEdit = useCallback((r: number, c: number, initial?: string) => {
    const key = `${r},${c}`
    const cur = edits.get(key)
    const cell = preview?.cells.find(cl => cl.r === r && cl.c === c)
    setEditingCell({ r, c })
    setEditValue(initial ?? cur ?? cell?.v ?? '')
  }, [edits, preview])

  // 編集を確定
  const commitEdit = useCallback((r: number, c: number, value: string) => {
    setEdits(prev => {
      const next = new Map(prev)
      if (value === '') next.delete(`${r},${c}`)
      else next.set(`${r},${c}`, value)
      return next
    })
    setEditingCell(null)
    setEditValue('')
  }, [])

  useEffect(() => {
    if (editingCell && inputRef.current) inputRef.current.focus()
  }, [editingCell])

  // キーボード操作
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
    if (e.key === 'Enter') {
      commitEdit(r, c, editValue)
      setSelectedCell({ r: r + 1, c })
    } else if (e.key === 'Tab') {
      e.preventDefault()
      commitEdit(r, c, editValue)
      setSelectedCell({ r, c: c + 1 })
    } else if (e.key === 'Escape') {
      setEditingCell(null)
      setEditValue('')
    }
  }

  // 通常セルのキー入力でそのまま編集開始
  const handleCellKeyDown = (e: React.KeyboardEvent<HTMLTableCellElement>, r: number, c: number) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      setEdits(prev => { const n = new Map(prev); n.delete(`${r},${c}`); return n })
      return
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      startEdit(r, c, e.key)
    }
    if (e.key === 'F2' || e.key === 'Enter') startEdit(r, c)
  }

  const editsArr = Array.from(edits.entries()).map(([key, value]) => {
    const [r, c] = key.split(',').map(Number)
    return { address: `${colToLetter(c)}${r}`, value }
  })

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const res = await fetch(`/api/expense/templates/${templateId}/fill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edits: editsArr }),
      })
      if (!res.ok) { alert('ダウンロードに失敗しました'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `精算書_${reportPeriod}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  const handleOpenInSheets = async () => {
    if (!googleAuth?.authenticated) {
      const returnTo = encodeURIComponent(window.location.pathname + window.location.search)
      window.location.href = `/api/auth/google?returnTo=${returnTo}`
      return
    }
    setOpeningInSheets(true)
    try {
      const res = await fetch('/api/expense/drive/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, edits: editsArr }),
      })
      const data = await res.json() as { sheetsUrl?: string; error?: string; needsAuth?: boolean }
      if (data.needsAuth) {
        const returnTo = encodeURIComponent(window.location.pathname + window.location.search)
        window.location.href = `/api/auth/google?returnTo=${returnTo}`
        return
      }
      if (data.sheetsUrl) {
        window.open(data.sheetsUrl, '_blank')
      } else {
        alert(data.error ?? 'Google Sheetsを開けませんでした')
      }
    } finally {
      setOpeningInSheets(false)
    }
  }

  // ── グリッドデータ構築 ──────────────────────────────────────────────────────
  const cellMap = new Map<string, CellOut>()
  const skipSet = new Set<string>()
  if (preview) {
    for (const cell of preview.cells) {
      cellMap.set(`${cell.r},${cell.c}`, cell)
      if (cell.cs > 1 || cell.rs > 1) {
        for (let dr = 0; dr < cell.rs; dr++)
          for (let dc = 0; dc < cell.cs; dc++)
            if (dr !== 0 || dc !== 0) skipSet.add(`${cell.r + dr},${cell.c + dc}`)
      }
    }
  }

  const maxRow = preview?.maxRow ?? 0
  const maxCol = preview?.maxCol ?? 0

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col" style={{ fontFamily: 'Meiryo, "MS Gothic", sans-serif' }}>

      {/* ── ヘッダー ── */}
      <div className="h-11 border-b border-slate-200 flex items-center px-3 gap-3 shrink-0 bg-slate-50">
        <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-sm flex items-center gap-1">
          ← 戻る
        </button>
        <span className="text-sm font-semibold text-slate-700">{templateName}</span>
        <span className="text-xs text-slate-400 hidden sm:block">
          {edits.size > 0 ? `${edits.size}件 編集中` : 'セルをクリックして編集'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {edits.size > 0 && (
            <button
              onClick={() => setEdits(new Map())}
              className="text-xs text-slate-400 hover:text-red-500 px-2 py-1 rounded"
            >
              変更をリセット
            </button>
          )}
          <button
            onClick={handleOpenInSheets}
            disabled={openingInSheets}
            title={googleAuth?.authenticated ? `Google Sheets (${(googleAuth as { authenticated: true; email: string }).email})` : 'Googleアカウントでログインして開く'}
            className="flex items-center gap-1.5 bg-white border border-slate-300 text-slate-700 text-sm px-3 py-1.5 rounded-lg hover:bg-slate-50 disabled:opacity-40"
          >
            <svg width="14" height="14" viewBox="0 0 48 48">
              <path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            {openingInSheets ? 'アップロード中...' : googleAuth?.authenticated ? 'Google Sheetsで開く' : 'Google Sheetsで開く'}
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="bg-emerald-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-40"
          >
            {downloading ? '生成中...' : 'ダウンロード'}
          </button>
        </div>
      </div>

      {/* ── メインコンテンツ ── */}
      <div className="flex-1 flex min-h-0">

        {/* 左: Excelグリッド */}
        <div className="flex-1 overflow-auto bg-white">
          {loading && (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">
              プレビューを読み込み中...
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center h-full text-red-400 text-sm">{error}</div>
          )}
          {!loading && !error && preview && (
            <table
              className="border-collapse"
              style={{ fontSize: 11, tableLayout: 'fixed', borderSpacing: 0 }}
            >
              {/* 列幅定義 */}
              <colgroup>
                {/* 行番号列 */}
                <col style={{ width: 36, minWidth: 36 }} />
                {Array.from({ length: maxCol }, (_, i) => (
                  <col key={i} style={{ width: preview.colWidths[i] ?? 64, minWidth: 24 }} />
                ))}
              </colgroup>

              {/* 列ヘッダー */}
              <thead>
                <tr style={{ height: 20 }}>
                  <th
                    className="sticky top-0 left-0 z-30 bg-slate-100 border border-slate-300"
                    style={{ fontSize: 10, color: '#94a3b8' }}
                  />
                  {Array.from({ length: maxCol }, (_, i) => {
                    const c = i + 1
                    const isSelected = selectedCell?.c === c
                    return (
                      <th
                        key={c}
                        className="sticky top-0 z-20 border border-slate-300 text-center select-none"
                        style={{
                          backgroundColor: isSelected ? '#dbeafe' : '#f1f5f9',
                          color: isSelected ? '#1d4ed8' : '#64748b',
                          fontSize: 10,
                          fontWeight: isSelected ? 700 : 400,
                          padding: '1px 2px',
                        }}
                      >
                        {colToLetter(c)}
                      </th>
                    )
                  })}
                </tr>
              </thead>

              {/* データ行 */}
              <tbody>
                {Array.from({ length: maxRow }, (_, rowIdx) => {
                  const r = rowIdx + 1
                  const rowH = preview.rowHeights[rowIdx] ?? 20
                  const isSelectedRow = selectedCell?.r === r

                  const tds: React.ReactNode[] = [
                    // 行番号
                    <td
                      key="rn"
                      className="sticky left-0 z-10 border border-slate-300 text-center select-none"
                      style={{
                        backgroundColor: isSelectedRow ? '#dbeafe' : '#f8fafc',
                        color: isSelectedRow ? '#1d4ed8' : '#94a3b8',
                        fontSize: 10,
                        fontWeight: isSelectedRow ? 700 : 400,
                        minWidth: 36,
                        width: 36,
                        height: rowH,
                        padding: '1px 4px',
                      }}
                    >
                      {r}
                    </td>,
                  ]

                  for (let c = 1; c <= maxCol; c++) {
                    const key = `${r},${c}`
                    if (skipSet.has(key)) continue
                    const cell = cellMap.get(key)
                    const editedValue = edits.get(key)
                    const isEditing = editingCell?.r === r && editingCell?.c === c
                    const isSelected = selectedCell?.r === r && selectedCell?.c === c
                    const isEdited = edits.has(key)
                    const displayValue = editedValue ?? cell?.v ?? ''

                    // セル背景色の決定
                    let bgColor = cell?.bg ?? '#ffffff'
                    if (isEdited) bgColor = '#fefce8'   // 編集済み → 薄黄
                    if (isSelected && !isEditing) bgColor = isEdited ? '#fef08a' : '#eff6ff'

                    // 罫線スタイル
                    const borderStyle: React.CSSProperties = {}
                    if (cell?.bt) borderStyle.borderTop = cell.bt
                    if (cell?.bb) borderStyle.borderBottom = cell.bb
                    if (cell?.bl) borderStyle.borderLeft = cell.bl
                    if (cell?.br) borderStyle.borderRight = cell.br
                    if (!cell?.bt && !cell?.bb && !cell?.bl && !cell?.br) {
                      borderStyle.border = '1px solid #e2e8f0'
                    }

                    tds.push(
                      <td
                        key={c}
                        colSpan={cell?.cs ?? 1}
                        rowSpan={cell?.rs ?? 1}
                        tabIndex={0}
                        onClick={() => {
                          if (editingCell && (editingCell.r !== r || editingCell.c !== c)) {
                            commitEdit(editingCell.r, editingCell.c, editValue)
                          }
                          setSelectedCell({ r, c })
                          if (isSelected) startEdit(r, c)
                        }}
                        onDoubleClick={() => startEdit(r, c)}
                        onKeyDown={(e) => handleCellKeyDown(e, r, c)}
                        style={{
                          backgroundColor: bgColor,
                          height: rowH,
                          padding: isEditing ? 0 : '1px 4px',
                          fontWeight: cell?.bold ? 700 : undefined,
                          fontStyle: cell?.italic ? 'italic' : undefined,
                          fontSize: cell?.fontSize ?? 11,
                          color: cell?.fontColor,
                          textAlign: (cell?.align as React.CSSProperties['textAlign']) ?? 'left',
                          verticalAlign: cell?.valign === 'top' ? 'top' : cell?.valign === 'bottom' ? 'bottom' : 'middle',
                          whiteSpace: cell?.wrap ? 'pre-wrap' : 'nowrap',
                          overflow: 'hidden',
                          outline: isSelected && !isEditing ? '2px solid #3b82f6' : undefined,
                          outlineOffset: '-2px',
                          cursor: 'cell',
                          position: 'relative',
                          ...borderStyle,
                        }}
                      >
                        {isEditing ? (
                          <input
                            ref={inputRef}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => commitEdit(r, c, editValue)}
                            onKeyDown={(e) => handleKeyDown(e, r, c)}
                            style={{
                              width: '100%',
                              height: '100%',
                              border: 'none',
                              outline: 'none',
                              background: '#fefce8',
                              padding: '1px 4px',
                              fontSize: cell?.fontSize ?? 11,
                              fontWeight: cell?.bold ? 700 : undefined,
                              fontFamily: 'inherit',
                              boxSizing: 'border-box',
                            }}
                          />
                        ) : (
                          displayValue
                        )}
                      </td>
                    )
                  }

                  return <tr key={r}>{tds}</tr>
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* 右: 精算データ参照パネル */}
        <div className="w-56 border-l border-slate-200 bg-slate-50 overflow-y-auto flex flex-col text-xs shrink-0">
          <div className="p-3 border-b border-slate-200">
            <p className="font-semibold text-slate-600 mb-1">精算データ（参照）</p>
            <p className="text-slate-500 truncate">{reportTitle}</p>
            <p className="text-slate-400">{reportPeriod}</p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {reportItems.length === 0 ? (
              <p className="text-slate-400 p-3">明細がありません</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {reportItems.map((item, i) => (
                  <div key={i} className="p-2 hover:bg-slate-100">
                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-500 font-mono">{item.date}</span>
                      <span className="font-semibold text-slate-700">¥{item.amount.toLocaleString()}</span>
                    </div>
                    <p className="text-slate-600 truncate">{item.purpose}</p>
                    {item.departure && item.destination && (
                      <p className="text-slate-400 truncate">{item.departure} → {item.destination}</p>
                    )}
                    {item.transport && (
                      <p className="text-slate-400">{item.transport} / {item.category}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 border-t border-slate-200 bg-white">
            <p className="text-slate-400 mb-2 leading-tight">
              セルをクリックして選択し、そのまま入力できます。Enterで確定・移動。
            </p>
            {edits.size > 0 && (
              <p className="text-emerald-600 font-medium">{edits.size}件 入力済み</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
