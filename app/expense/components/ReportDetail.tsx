'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import ItemForm from './ItemForm'
import Image from 'next/image'
import ExcelExportModal from './ExcelExportModal'
import ExcelMapper from './ExcelMapper'
import SendEmailPanel from './SendEmailPanel'

type Attachment = {
  id: string
  fileName: string
  filePath: string
  fileType: string
  fileSize: number
}

type Item = {
  id: string
  date: string
  purpose: string
  destination: string
  departure: string
  transport: string
  amount: number
  category: string
  notes: string
  sourceEmail: string
}

type CellMapping = { fieldKey: string; cellAddress: string }
type Template = {
  id: string
  name: string
  description: string
  filePath: string
  sheetName: string
  mappings: CellMapping[]
}

type Report = {
  id: string
  title: string
  period: string
  status: string
  dueDate: string | null
  items: Item[]
  attachments: Attachment[]
}

type Props = {
  reportId: string
  onDeleted: () => void
  onUpdated: () => void
}

const HEADER_FIELDS = [
  { key: 'REPORT_TITLE',    label: 'レポートタイトル', placeholder: '例：B2' },
  { key: 'REPORT_PERIOD',   label: '対象期間',         placeholder: '例：B3' },
  { key: 'SUBMITTER_NAME',  label: '氏名',             placeholder: '例：D2' },
  { key: 'DEPARTMENT',      label: '部署・所属',       placeholder: '例：D3' },
  { key: 'TOTAL_AMOUNT',    label: '合計金額',         placeholder: '例：G20' },
]

const TABLE_FIELDS = [
  { key: 'ITEMS_START_ROW',      label: 'データ開始行', placeholder: '例：8',  hint: '行番号' },
  { key: 'ITEM_DATE_COL',        label: '日付',         placeholder: '例：A',  hint: '列' },
  { key: 'ITEM_PURPOSE_COL',     label: '目的',         placeholder: '例：B',  hint: '列' },
  { key: 'ITEM_DEPARTURE_COL',   label: '出発地',       placeholder: '例：C',  hint: '列' },
  { key: 'ITEM_DESTINATION_COL', label: '目的地',       placeholder: '例：D',  hint: '列' },
  { key: 'ITEM_TRANSPORT_COL',   label: '交通手段',     placeholder: '例：E',  hint: '列' },
  { key: 'ITEM_CATEGORY_COL',    label: '費目',         placeholder: '例：F',  hint: '列' },
  { key: 'ITEM_AMOUNT_COL',      label: '金額',         placeholder: '例：G',  hint: '列' },
  { key: 'ITEM_NOTES_COL',       label: '備考',         placeholder: '例：H',  hint: '列' },
]

export default function ReportDetail({ reportId, onDeleted, onUpdated }: Props) {
  const [report, setReport] = useState<Report | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Item | null>(null)
  const [exporting, setExporting] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [periodDraft, setPeriodDraft] = useState('')
  const [dueDateDraft, setDueDateDraft] = useState('')
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState<Attachment | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // エクスポートドロワー
  const [showExcelExport, setShowExcelExport] = useState(false)
  const [showSendPanel, setShowSendPanel] = useState(false)
  const [showDrawer, setShowDrawer] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('default')
  const [drawerMappings, setDrawerMappings] = useState<Record<string, string>>({})
  const [mappingSaved, setMappingSaved] = useState(false)
  const [showMapper, setShowMapper] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/expense/reports/${reportId}`)
    setReport(await res.json())
  }, [reportId])

  useEffect(() => { load() }, [load])

  const openDrawer = async () => {
    const res = await fetch('/api/expense/templates')
    const tmpl: Template[] = await res.json()
    setTemplates(tmpl)
    setShowDrawer(true)
  }

  const selectTemplate = (id: string) => {
    setSelectedTemplateId(id)
    setMappingSaved(false)
    if (id === 'default') { setDrawerMappings({}); return }
    const t = templates.find((t) => t.id === id)
    if (t) {
      const map: Record<string, string> = {}
      for (const m of t.mappings) map[m.fieldKey] = m.cellAddress
      setDrawerMappings(map)
    }
  }

  const setMapping = (key: string, val: string) =>
    setDrawerMappings((prev) => ({ ...prev, [key]: val }))

  const doExport = async (templateId: string, mappingsToSave?: Record<string, string>) => {
    setExporting(true)
    try {
      if (templateId !== 'default' && mappingsToSave) {
        const payload = [...HEADER_FIELDS, ...TABLE_FIELDS].map(({ key }) => ({
          fieldKey: key,
          cellAddress: mappingsToSave[key] ?? '',
        }))
        await fetch(`/api/expense/templates/${templateId}/mappings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mappings: payload }),
        })
        setMappingSaved(true)
      }
      const url = templateId === 'default'
        ? `/api/expense/export/${reportId}`
        : `/api/expense/export/${reportId}?templateId=${templateId}`
      const res = await fetch(url)
      if (!res.ok) { alert('エクスポートに失敗しました'); return }
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = `精算書_${report?.period ?? ''}.xlsx`
      a.click()
      URL.revokeObjectURL(objectUrl)
      setShowDrawer(false)
      setShowMapper(false)
    } finally {
      setExporting(false)
    }
  }

  const handleSaveAndExport = () => doExport(selectedTemplateId, drawerMappings)

  const handleMapperDone = async (mappings: Record<string, string>) => {
    setDrawerMappings(mappings)
    await doExport(selectedTemplateId, mappings)
  }

  const handleSaveTitle = async () => {
    if (!titleDraft.trim() || !periodDraft.trim()) return
    await fetch(`/api/expense/reports/${reportId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: titleDraft, period: periodDraft, dueDate: dueDateDraft || null }),
    })
    setEditingTitle(false)
    load()
    onUpdated()
  }

  const handleDeleteItem = async (id: string) => {
    if (!confirm('この明細を削除しますか？')) return
    await fetch(`/api/expense/items/${id}`, { method: 'DELETE' })
    load()
  }

  const handleDeleteReport = async () => {
    if (!confirm('このレポートを削除しますか？（明細・添付ファイルもすべて削除されます）')) return
    await fetch(`/api/expense/reports/${reportId}`, { method: 'DELETE' })
    onDeleted()
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('reportId', reportId)
      await fetch('/api/expense/attachments', { method: 'POST', body: fd })
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
    load()
  }

  const handleDeleteAttachment = async (id: string) => {
    if (!confirm('この添付ファイルを削除しますか？')) return
    await fetch(`/api/expense/attachments/${id}`, { method: 'DELETE' })
    load()
  }

  const handleSaved = () => {
    setShowForm(false)
    setEditItem(null)
    load()
  }

  if (!report) return <div className="p-6 text-slate-400 text-sm">読み込み中...</div>

  const total = report.items.reduce((s, i) => s + i.amount, 0)
  const isImage = (type: string) => type.startsWith('image/')
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {showExcelExport && (
        <ExcelExportModal
          reportId={reportId}
          reportTitle={report.title}
          onClose={() => setShowExcelExport(false)}
        />
      )}
      {/* ヘッダー */}
      <div className="flex items-start justify-between mb-4 shrink-0 gap-4">
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <div className="flex flex-col gap-1.5">
              <input
                className="text-lg font-bold text-slate-800 border border-indigo-300 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-300 w-full"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') setEditingTitle(false) }}
                autoFocus
              />
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  className="text-sm text-slate-500 border border-indigo-300 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-300 w-48"
                  value={periodDraft}
                  placeholder="対象期間（例：2025年11月）"
                  onChange={(e) => setPeriodDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') setEditingTitle(false) }}
                />
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-slate-400 shrink-0">期日</label>
                  <input
                    type="date"
                    className="text-sm border border-indigo-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    value={dueDateDraft}
                    onChange={(e) => setDueDateDraft(e.target.value)}
                  />
                </div>
                <button onClick={handleSaveTitle} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700">保存</button>
                <button onClick={() => setEditingTitle(false)} className="text-xs bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-300">キャンセル</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <div>
                <h2 className="text-lg font-bold text-slate-800 truncate">{report.title}</h2>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-slate-400">{report.period}</p>
                  {report.dueDate && (() => {
                    const today = new Date(); today.setHours(0,0,0,0)
                    const due = new Date(report.dueDate); due.setHours(0,0,0,0)
                    const diff = Math.ceil((due.getTime() - today.getTime()) / 86400000)
                    const color = diff < 0 ? 'bg-red-100 text-red-600' : diff <= 3 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'
                    const label = diff < 0 ? `期日超過 ${Math.abs(diff)}日` : diff === 0 ? '期日: 今日' : `期日まであと${diff}日`
                    return <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${color}`}>{label}</span>
                  })()}
                </div>
              </div>
              <button
                onClick={() => { setTitleDraft(report.title); setPeriodDraft(report.period); setDueDateDraft(report.dueDate ?? ''); setEditingTitle(true) }}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-indigo-500 p-1 rounded"
                title="タイトルを編集"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {!editingTitle && (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => { setShowForm(true); setEditItem(null) }}
              className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700"
            >
              + 明細追加
            </button>
            <button
              onClick={() => setShowExcelExport(true)}
              disabled={report.items.length === 0}
              className="text-sm bg-teal-600 text-white px-3 py-1.5 rounded-lg hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              </svg>
              Excel出力
            </button>
            <button
              onClick={() => setShowSendPanel(true)}
              disabled={report.items.length === 0}
              className="text-sm bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
              </svg>
              送信 / 出力
            </button>
            <button
              onClick={handleDeleteReport}
              className="text-sm bg-red-100 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-200"
            >
              削除
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto flex flex-col gap-4">
        {/* 明細フォーム */}
        {(showForm || editItem) && (
          <ItemForm
            reportId={reportId}
            editItem={editItem}
            onSaved={handleSaved}
            onCancel={() => { setShowForm(false); setEditItem(null) }}
          />
        )}

        {/* 明細テーブル */}
        {report.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <p className="text-slate-400 text-sm">明細がありません</p>
            <p className="text-slate-300 text-xs mt-1">「+ 明細追加」から追加するか、Claudeにメール検索を依頼してください</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600 text-xs">
                  {['日付', '目的', '出発地', '目的地', '交通手段', '費目', '金額', '備考', ''].map((h) => (
                    <th key={h} className="text-left px-3 py-2 border-b border-slate-200 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.items.map((item, i) => (
                  <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap text-slate-600">{item.date}</td>
                    <td className="px-3 py-2 border-b border-slate-100">{item.purpose}</td>
                    <td className="px-3 py-2 border-b border-slate-100 text-slate-500">{item.departure}</td>
                    <td className="px-3 py-2 border-b border-slate-100">{item.destination}</td>
                    <td className="px-3 py-2 border-b border-slate-100 text-slate-500">{item.transport}</td>
                    <td className="px-3 py-2 border-b border-slate-100">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{item.category}</span>
                    </td>
                    <td className="px-3 py-2 border-b border-slate-100 text-right font-medium text-slate-800 whitespace-nowrap">
                      {item.amount === 0
                        ? <span className="text-amber-500 text-xs">要確認</span>
                        : `¥${item.amount.toLocaleString()}`}
                    </td>
                    <td className="px-3 py-2 border-b border-slate-100 text-slate-400 text-xs max-w-xs truncate">{item.notes}</td>
                    <td className="px-3 py-2 border-b border-slate-100">
                      <div className="flex gap-1">
                        <button onClick={() => { setEditItem(item); setShowForm(false) }} className="text-xs text-indigo-500 hover:text-indigo-700">編集</button>
                        <button onClick={() => handleDeleteItem(item.id)} className="text-xs text-red-400 hover:text-red-600">削除</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-indigo-50">
                  <td colSpan={6} className="px-3 py-2 text-right text-sm font-semibold text-slate-700">合計</td>
                  <td className="px-3 py-2 text-right text-sm font-bold text-indigo-700 whitespace-nowrap">¥{total.toLocaleString()}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* 添付ファイル */}
        <div className="border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">
              添付ファイル
              {report.attachments.length > 0 && (
                <span className="ml-2 text-xs text-slate-400 font-normal">{report.attachments.length}件</span>
              )}
            </h3>
            <label className={`text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${uploading ? 'bg-slate-200 text-slate-400' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {uploading ? 'アップロード中...' : '+ ファイルを追加'}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                multiple
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>
          </div>

          {report.attachments.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-3">領収書・チケット画像などを追加できます（画像・PDF対応）</p>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {report.attachments.map((att) => (
                <div key={att.id} className="group relative">
                  {isImage(att.fileType) ? (
                    <button
                      onClick={() => setLightbox(att)}
                      className="w-full aspect-square rounded-lg overflow-hidden border border-slate-200 hover:border-indigo-300 transition-colors bg-slate-50"
                    >
                      <Image src={att.filePath} alt={att.fileName} width={200} height={200} className="w-full h-full object-cover" />
                    </button>
                  ) : (
                    <a
                      href={att.filePath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center justify-center w-full aspect-square rounded-lg border border-slate-200 hover:border-indigo-300 transition-colors bg-slate-50 gap-1"
                    >
                      <span className="text-2xl">📄</span>
                      <span className="text-xs text-slate-500 px-1 text-center truncate w-full">{att.fileName}</span>
                    </a>
                  )}
                  <button
                    onClick={() => handleDeleteAttachment(att.id)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >×</button>
                  <p className="text-xs text-slate-400 mt-1 truncate text-center">{att.fileName}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Excel出力ドロワー ── */}
      {showDrawer && (
        <div className="fixed inset-0 z-40 flex">
          {/* 半透明オーバーレイ（左側） */}
          <div className="flex-1 bg-black/20" onClick={() => setShowDrawer(false)} />

          {/* ドロワー本体 */}
          <div className="w-[420px] bg-white shadow-2xl flex flex-col border-l border-slate-200">
            {/* ドロワーヘッダー */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Excel 出力設定</h3>
                <p className="text-xs text-slate-400 mt-0.5">{report.title} — {report.items.length}件 / ¥{total.toLocaleString()}</p>
              </div>
              <button onClick={() => setShowDrawer(false)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
            </div>

            {/* スクロール可能な中身 */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">

              {/* テンプレート選択 */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">フォーマットを選択</p>
                <div className="flex flex-col gap-1.5">
                  {/* デフォルト */}
                  <label className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${selectedTemplateId === 'default' ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <input type="radio" name="tmpl" value="default" checked={selectedTemplateId === 'default'} onChange={() => selectTemplate('default')} />
                    <div>
                      <p className="text-sm font-medium text-slate-700">デフォルト形式</p>
                      <p className="text-xs text-slate-400">シンプルな一覧表</p>
                    </div>
                  </label>

                  {templates.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-2">
                      テンプレートがありません。
                      <a href="/expense/templates" className="text-emerald-600 hover:underline ml-1">登録する →</a>
                    </p>
                  )}

                  {templates.map((t) => (
                    <label
                      key={t.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                        !t.filePath ? 'opacity-40 cursor-not-allowed' :
                        selectedTemplateId === t.id ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="tmpl"
                        value={t.id}
                        checked={selectedTemplateId === t.id}
                        onChange={() => selectTemplate(t.id)}
                        disabled={!t.filePath}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{t.name}</p>
                        {t.description && <p className="text-xs text-slate-400 truncate">{t.description}</p>}
                        {!t.filePath && <p className="text-xs text-amber-500">ファイル未設定</p>}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* マッピング設定（テンプレート選択時のみ） */}
              {selectedTemplateId !== 'default' && selectedTemplate && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">セルマッピング</p>
                    {mappingSaved && <span className="text-xs text-emerald-600">✓ 保存済み</span>}
                  </div>

                  {/* ファイルがある場合はビジュアルマッパーボタンを優先表示 */}
                  {selectedTemplate.filePath ? (
                    <button
                      onClick={() => setShowMapper(true)}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl hover:border-emerald-400 hover:bg-emerald-50 transition-colors text-left"
                    >
                      <span className="text-2xl">🗺️</span>
                      <div>
                        <p className="text-sm font-medium text-slate-700">ファイルを見ながら設定</p>
                        <p className="text-xs text-slate-400">スプレッドシートをプレビューして、セルをクリックしてマッピング</p>
                      </div>
                    </button>
                  ) : (
                    <p className="text-xs text-amber-500">ファイルが未設定のためプレビューできません</p>
                  )}

                  {/* 手動入力フォールバック（折りたたみ） */}
                  <details className="mt-3">
                    <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">手動でセルアドレスを入力する</summary>
                    <div className="mt-2 flex flex-col gap-1.5">
                      {HEADER_FIELDS.map(({ key, label, placeholder }) => (
                        <div key={key} className="flex items-center gap-2">
                          <label className="text-xs text-slate-600 w-28 shrink-0">{label}</label>
                          <input
                            className="flex-1 border border-slate-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-300"
                            placeholder={placeholder}
                            value={drawerMappings[key] ?? ''}
                            onChange={(e) => setMapping(key, e.target.value)}
                          />
                        </div>
                      ))}
                      {TABLE_FIELDS.map(({ key, label, placeholder, hint }) => (
                        <div key={key} className="flex items-center gap-2">
                          <label className="text-xs text-slate-600 w-28 shrink-0">{label}</label>
                          <input
                            className="flex-1 border border-slate-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-300"
                            placeholder={placeholder}
                            value={drawerMappings[key] ?? ''}
                            onChange={(e) => setMapping(key, e.target.value)}
                          />
                          <span className="text-xs text-slate-400 w-8 shrink-0">{hint}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}
            </div>

            {/* フッター：ダウンロードボタン */}
            <div className="px-5 py-4 border-t border-slate-200 shrink-0 flex flex-col gap-2">
              <button
                onClick={handleSaveAndExport}
                disabled={exporting}
                className="w-full bg-emerald-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {exporting
                  ? '生成中...'
                  : selectedTemplateId === 'default'
                    ? 'ダウンロード'
                    : 'マッピングを保存してダウンロード'}
              </button>
              {selectedTemplateId !== 'default' && (
                <p className="text-xs text-slate-400 text-center">
                  設定内容は次回も引き継がれます
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Send email panel */}
      {showSendPanel && (
        <SendEmailPanel report={report} onClose={() => setShowSendPanel(false)} />
      )}

      {/* Excel ビジュアルマッパー（直接編集） */}
      {showMapper && selectedTemplateId !== 'default' && selectedTemplate && (
        <ExcelMapper
          templateId={selectedTemplateId}
          templateName={selectedTemplate.name}
          reportTitle={report.title}
          reportPeriod={report.period}
          reportItems={report.items}
          onClose={() => setShowMapper(false)}
        />
      )}

      {/* ライトボックス */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setLightbox(null)}>
          <div className="relative max-w-3xl max-h-full" onClick={(e) => e.stopPropagation()}>
            <Image src={lightbox.filePath} alt={lightbox.fileName} width={900} height={700} className="rounded-xl object-contain max-h-[80vh]" />
            <p className="text-white text-sm text-center mt-2 opacity-70">{lightbox.fileName}</p>
            <button
              onClick={() => setLightbox(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white text-slate-700 rounded-full text-sm font-bold hover:bg-slate-100 flex items-center justify-center shadow"
            >×</button>
          </div>
        </div>
      )}
    </div>
  )
}
