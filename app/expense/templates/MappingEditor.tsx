'use client'

import { useState, useEffect, useRef } from 'react'

type CellMapping = { fieldKey: string; cellAddress: string }

type CandidateCell = {
  address: string
  row: number
  col: number
  confidence: number
  reasons: string[]
  exampleValue: string
}

type ItemRange = {
  col: string
  startRow: number
  endRow: number
  count: number
}

type Props = {
  templateId: string
  initialMappings: CellMapping[]
  onSaved: () => void
}

export default function MappingEditor({ templateId, initialMappings, onSaved }: Props) {
  const [mappingCount, setMappingCount] = useState(initialMappings.length)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // AI自然言語
  const [showAi, setShowAi] = useState(false)
  const [aiText, setAiText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  // JSONインポート
  const jsonRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState('')

  // 自動解析
  const [analyzing, setAnalyzing] = useState(false)
  const [candidates, setCandidates] = useState<CandidateCell[]>([])
  const [itemRanges, setItemRanges] = useState<ItemRange[]>([])
  const [showAnalysis, setShowAnalysis] = useState(false)

  useEffect(() => {
    setMappingCount(initialMappings.length)
  }, [initialMappings])

  // ─── AI自然言語 ───────────────────────────────────────────────────
  const handleAiParse = async () => {
    if (!aiText.trim()) return
    setAiLoading(true)
    setAiError('')
    try {
      const res = await fetch(`/api/expense/templates/${templateId}/ai-mapping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: aiText }),
      })
      const data = await res.json()
      if (!res.ok) { setAiError(data.error ?? 'エラー'); return }
      // AI結果をそのまま保存
      const mappings = (data.mappings ?? []).filter((m: { cellAddress?: string }) => m.cellAddress)
      await saveMappings(mappings)
    } catch {
      setAiError('通信エラー')
    } finally {
      setAiLoading(false)
    }
  }

  // ─── JSONインポート ────────────────────────────────────────────────
  const handleJsonImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult('')
    try {
      const text = await file.text()
      const entries = JSON.parse(text)
      const res = await fetch(`/api/expense/templates/${templateId}/import-map`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entries),
      })
      const data = await res.json()
      if (!res.ok) { setImportResult(`エラー: ${data.error}`); return }
      setImportResult(`✓ ${data.imported}件をインポートしました`)
      setMappingCount(data.imported)
      onSaved()
    } catch {
      setImportResult('JSONの解析に失敗しました')
    } finally {
      setImporting(false)
      if (jsonRef.current) jsonRef.current.value = ''
    }
  }

  // ─── 自動解析 ─────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    setAnalyzing(true)
    setCandidates([])
    setItemRanges([])
    try {
      const res = await fetch(`/api/expense/templates/${templateId}/analyze`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? '解析に失敗しました'); return }
      setCandidates(data.candidates ?? [])
      setItemRanges(data.itemRanges ?? [])
      setShowAnalysis(true)
    } catch {
      alert('解析エラーが発生しました')
    } finally {
      setAnalyzing(false)
    }
  }

  // ─── マッピング保存 ───────────────────────────────────────────────
  const saveMappings = async (mappings: { fieldKey: string; cellAddress: string }[]) => {
    setSaving(true)
    const res = await fetch(`/api/expense/templates/${templateId}/mappings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mappings }),
    })
    const data = await res.json()
    setMappingCount(Array.isArray(data) ? data.length : 0)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onSaved()
  }

  const confidenceStars = (n: number) =>
    '★'.repeat(n) + '☆'.repeat(Math.max(0, 3 - n))

  return (
    <div className="border-t border-slate-100 bg-slate-50 p-4 space-y-4">

      {/* ステータス */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span className={mappingCount > 0 ? 'text-emerald-600 font-semibold' : 'text-amber-500'}>
          {mappingCount > 0 ? `✓ ${mappingCount}項目のマッピング設定済み` : '未設定'}
        </span>
        {saved && <span className="text-emerald-600">— 保存しました</span>}
        {saving && <span className="text-slate-400">保存中...</span>}
      </div>

      {/* アクションボタン群 */}
      <div className="flex flex-wrap gap-2">

        {/* 自動解析 */}
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="flex items-center gap-1.5 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-40"
        >
          {analyzing ? (
            <>
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              解析中...
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
              Excelを自動解析
            </>
          )}
        </button>

        {/* JSONインポート */}
        <label className="flex items-center gap-1.5 text-xs bg-teal-600 text-white px-3 py-1.5 rounded-lg hover:bg-teal-700 cursor-pointer">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
          </svg>
          {importing ? 'インポート中...' : 'cell_map_fields.json をインポート'}
          <input
            ref={jsonRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleJsonImport}
            disabled={importing}
          />
        </label>

        {/* AI自然言語 */}
        <button
          onClick={() => setShowAi((v) => !v)}
          className="flex items-center gap-1.5 text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700"
        >
          <span className="text-[10px] font-bold">AI</span>
          自然言語で設定
        </button>
      </div>

      {importResult && (
        <p className={`text-xs px-3 py-1.5 rounded-lg ${importResult.startsWith('✓') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
          {importResult}
        </p>
      )}

      {/* AI自然言語パネル */}
      {showAi && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex flex-col gap-2">
          <p className="text-xs text-purple-600">Excelの構造を自然言語で説明してください。AIがセルアドレスに変換します。</p>
          <textarea
            className="w-full border border-purple-200 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white resize-none"
            rows={3}
            placeholder="例：タイトルはB2、期間はB3、氏名はD2、明細は8行目から始まり日付A列、金額G列..."
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
          />
          {aiError && <p className="text-xs text-red-500">{aiError}</p>}
          <button
            onClick={handleAiParse}
            disabled={aiLoading || !aiText.trim()}
            className="self-start text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 disabled:opacity-40"
          >
            {aiLoading ? '解析中...' : 'AIで解析して保存'}
          </button>
        </div>
      )}

      {/* 解析結果パネル */}
      {showAnalysis && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-indigo-700">解析結果（入力セル候補: {candidates.length}件）</p>
            <button onClick={() => setShowAnalysis(false)} className="text-xs text-indigo-400 hover:text-indigo-600">閉じる</button>
          </div>

          {itemRanges.length > 0 && (
            <div className="text-xs text-indigo-600">
              <p className="font-medium mb-1">明細行（繰り返し）:</p>
              {itemRanges.map((r, i) => (
                <span key={i} className="mr-3">行{r.startRow}〜{r.endRow}（列{r.col}、SUM{r.count}件）</span>
              ))}
            </div>
          )}

          <div className="max-h-60 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-indigo-500 border-b border-indigo-200">
                  <th className="text-left pb-1 w-16">セル</th>
                  <th className="text-left pb-1 w-16">信頼度</th>
                  <th className="text-left pb-1">入力例</th>
                  <th className="text-left pb-1">手がかり</th>
                </tr>
              </thead>
              <tbody>
                {candidates.slice(0, 100).map((c) => (
                  <tr key={c.address} className="border-b border-indigo-100 hover:bg-indigo-100">
                    <td className="py-0.5 font-mono">{c.address}</td>
                    <td className="py-0.5 text-amber-500">{confidenceStars(c.confidence)}</td>
                    <td className="py-0.5 truncate max-w-[120px]">{c.exampleValue}</td>
                    <td className="py-0.5 text-indigo-500 truncate max-w-[180px]">{c.reasons.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-indigo-400">
            この結果をもとに cell_map_fields.json を作成し、上の「JSONインポート」でマッピングを登録してください。
          </p>
        </div>
      )}
    </div>
  )
}
