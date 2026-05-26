'use client'

import { useState, useRef } from 'react'

type Item = {
  id: string; date: string; purpose: string; departure: string
  destination: string; transport: string; category: string; amount: number; notes: string
}
type EquipmentItem = {
  id: string; itemName: string; quantity: number; unitPrice: number; amount: number
  category: string; purchaseDate: string; vendor: string; notes: string
}
type Template = { id: string; name: string; description: string }
type Report = {
  id: string; title: string; period: string; dueDate: string | null
  items: Item[]
  equipmentItems?: EquipmentItem[]
}
type Props = { report: Report; reportType?: string; onClose: () => void }
type AttachMode = 'auto' | 'template' | 'local'

export default function SendEmailPanel({ report, reportType = 'travel', onClose }: Props) {
  const isEquipment = reportType === 'equipment'
  const total = isEquipment
    ? (report.equipmentItems ?? []).reduce((s, i) => s + i.amount, 0)
    : report.items.reduce((s, i) => s + i.amount, 0)
  const itemCount = isEquipment ? (report.equipmentItems ?? []).length : report.items.length

  const defaultBody = isEquipment
    ? `お世話になっております。\n\n${report.title}の備品購入申請書をお送りします。\nご確認のほど、よろしくお願いいたします。\n\n対象期間：${report.period}\n合計金額：¥${total.toLocaleString()}\n品目数：${itemCount}件`
    : `お世話になっております。\n\n${report.title}の旅費精算書をお送りします。\nご確認のほど、よろしくお願いいたします。\n\n対象期間：${report.period}\n合計金額：¥${total.toLocaleString()}`

  // Email fields
  const [to, setTo] = useState('')
  const [cc, setCc] = useState('')
  const [subject, setSubject] = useState(`【精算書】${report.title}`)
  const [bodyText, setBodyText] = useState(defaultBody)

  // Attachment mode: equipment uses 'template' by default (no 'auto' for equipment)
  const [mode, setMode] = useState<AttachMode>(isEquipment ? 'template' : 'auto')
  const [templates, setTemplates] = useState<Template[] | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [localFile, setLocalFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Editable items for auto mode
  const [editableItems, setEditableItems] = useState(report.items.map(i => ({ ...i })))
  const editableTotal = editableItems.reduce((s, i) => s + Number(i.amount), 0)

  const updateItem = (idx: number, field: string, value: string | number) => {
    setEditableItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }
  const addItem = () => {
    setEditableItems(prev => [...prev, {
      id: `new-${Date.now()}`, date: '', purpose: '', departure: '',
      destination: '', transport: '', category: '', amount: 0, notes: '',
    }])
  }
  const removeItem = (idx: number) => {
    setEditableItems(prev => prev.filter((_, i) => i !== idx))
  }

  // Send state
  const [sending, setSending] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [sendResult, setSendResult] = useState<{ ok?: boolean; error?: string } | null>(null)

  // Load templates when tab is clicked
  const handleModeChange = async (m: AttachMode) => {
    setMode(m)
    setSendResult(null)
    if (m === 'template' && templates === null) {
      const res = await fetch('/api/expense/templates')
      const data: Template[] = await res.json()
      setTemplates(data)
      if (data.length > 0) setSelectedTemplateId(data[0].id)
    }
  }

  // Download preview of generated Excel
  const handlePreviewDownload = async () => {
    setDownloading(true)
    try {
      let res: Response
      if (mode === 'auto') {
        res = await fetch('/api/expense/export/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: report.title, period: report.period, items: editableItems }),
        })
      } else {
        const params = new URLSearchParams()
        if (mode === 'template' && selectedTemplateId) params.set('templateId', selectedTemplateId)
        res = await fetch(`/api/expense/export/${report.id}${params.size ? `?${params}` : ''}`)
      }
      if (!res.ok) { alert('生成に失敗しました'); return }
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = `旅費精算書_${report.period}.xlsx`
      a.click()
      URL.revokeObjectURL(objectUrl)
    } finally {
      setDownloading(false)
    }
  }

  const handleSend = async () => {
    if (!to.trim()) return
    setSending(true)
    setSendResult(null)

    try {
      let body: Record<string, unknown>

      if (mode === 'local' && localFile) {
        // Read file as base64
        const arrayBuf = await localFile.arrayBuffer()
        const uint8 = new Uint8Array(arrayBuf)
        let binary = ''
        const chunk = 8192
        for (let i = 0; i < uint8.length; i += chunk) {
          binary += String.fromCharCode(...uint8.subarray(i, i + chunk))
        }
        const base64 = btoa(binary)
        body = {
          to, cc, subject, body: bodyText,
          attachmentBase64: base64,
          attachmentFilename: localFile.name,
          attachmentMime: localFile.type || 'application/octet-stream',
        }
      } else if (mode === 'template') {
        body = {
          to, cc, subject, body: bodyText,
          reportId: report.id,
          templateId: selectedTemplateId,
        }
      } else {
        // auto mode: send edited items
        body = {
          to, cc, subject, body: bodyText,
          title: report.title,
          period: report.period,
          items: editableItems.map(i => ({
            date: i.date, purpose: i.purpose, departure: i.departure,
            destination: i.destination, transport: i.transport,
            category: i.category, amount: Number(i.amount), notes: i.notes,
          })),
        }
      }

      const res = await fetch('/api/expense/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json() as { ok?: boolean; error?: string; needsReauth?: boolean }
      if (data.needsReauth) {
        setSendResult({ error: 'Gmail送信の権限がありません。下の「再認証する」から再認証してください。' })
      } else {
        setSendResult(data)
      }
    } catch (e) {
      setSendResult({ error: String(e) })
    } finally {
      setSending(false)
    }
  }

  const attachmentLabel = () => {
    if (mode === 'local') return localFile?.name ?? '（ファイル未選択）'
    if (mode === 'template') return `テンプレートで生成: ${templates?.find(t => t.id === selectedTemplateId)?.name ?? '...'}`
    return `${isEquipment ? '備品購入申請書' : '旅費精算書'}_${report.period}.xlsx（自動生成）`
  }

  const canSend = to.trim() !== '' && (mode !== 'local' || localFile !== null)

  const TAB = (m: AttachMode, label: string) => (
    <button
      onClick={() => handleModeChange(m)}
      className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
        mode === m
          ? 'bg-white text-indigo-700 shadow-sm border border-indigo-200'
          : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-200 bg-white shrink-0">
        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
        <div className="w-px h-5 bg-slate-200"/>
        <span className="text-sm font-semibold text-slate-700">{report.title}</span>
        <span className="text-xs text-slate-400">— {report.period}</span>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="text-slate-500">合計</span>
          <span className="font-bold text-slate-800">¥{total.toLocaleString()}</span>
          <span className="text-xs text-slate-400">({itemCount}件)</span>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">

        {/* ── Left: attachment selector ── */}
        <div className="flex-1 flex flex-col overflow-hidden p-6 min-w-0">

          {/* Mode tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit mb-5">
            {!isEquipment && TAB('auto', '自動生成')}
            {TAB('template', 'テンプレートを使う')}
            {TAB('local', 'ファイルを選択')}
          </div>

          {/* ─── AUTO mode ─── */}
          {mode === 'auto' && (
            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-bold text-slate-700">明細データから自動生成</p>
                  <p className="text-xs text-slate-400 mt-0.5">現在の明細 {report.items.length} 件を元にExcelを作成します</p>
                </div>
                <button
                  onClick={handlePreviewDownload}
                  disabled={downloading}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 hover:border-indigo-300 hover:text-indigo-600 transition-colors disabled:opacity-40"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                  </svg>
                  {downloading ? '生成中...' : 'Excelをダウンロードして確認'}
                </button>
              </div>

              {/* Editable table */}
              <div className="flex-1 overflow-auto">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="bg-indigo-600 px-5 py-3 text-center">
                    <p className="text-white font-bold text-sm">旅費精算書</p>
                    <p className="text-indigo-200 text-xs mt-0.5">{report.title}　対象期間：{report.period}</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-700 text-white">
                          {['日付', '目的', '出発地', '目的地', '交通手段', '費目', '金額（円）', '備考', ''].map((h, idx) => (
                            <th key={idx} className="text-left px-2 py-2.5 font-semibold border-r border-slate-600 last:border-r-0 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {editableItems.length === 0 ? (
                          <tr><td colSpan={9} className="text-center py-8 text-slate-400">明細がありません</td></tr>
                        ) : editableItems.map((item, i) => (
                          <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="px-1 py-1 border-b border-r border-slate-100">
                              <input type="date" value={item.date} onChange={e => updateItem(i, 'date', e.target.value)} className="w-full text-xs px-1 py-0.5 bg-transparent focus:outline-none focus:bg-indigo-50 focus:ring-1 focus:ring-indigo-300 rounded min-w-[100px]"/>
                            </td>
                            <td className="px-1 py-1 border-b border-r border-slate-100">
                              <input type="text" value={item.purpose} onChange={e => updateItem(i, 'purpose', e.target.value)} placeholder="目的" className="w-full text-xs px-1 py-0.5 bg-transparent focus:outline-none focus:bg-indigo-50 focus:ring-1 focus:ring-indigo-300 rounded min-w-[80px]"/>
                            </td>
                            <td className="px-1 py-1 border-b border-r border-slate-100">
                              <input type="text" value={item.departure} onChange={e => updateItem(i, 'departure', e.target.value)} placeholder="出発地" className="w-full text-xs px-1 py-0.5 bg-transparent focus:outline-none focus:bg-indigo-50 focus:ring-1 focus:ring-indigo-300 rounded min-w-[70px]"/>
                            </td>
                            <td className="px-1 py-1 border-b border-r border-slate-100">
                              <input type="text" value={item.destination} onChange={e => updateItem(i, 'destination', e.target.value)} placeholder="目的地" className="w-full text-xs px-1 py-0.5 bg-transparent focus:outline-none focus:bg-indigo-50 focus:ring-1 focus:ring-indigo-300 rounded min-w-[70px]"/>
                            </td>
                            <td className="px-1 py-1 border-b border-r border-slate-100">
                              <input type="text" value={item.transport} onChange={e => updateItem(i, 'transport', e.target.value)} placeholder="交通手段" className="w-full text-xs px-1 py-0.5 bg-transparent focus:outline-none focus:bg-indigo-50 focus:ring-1 focus:ring-indigo-300 rounded min-w-[70px]"/>
                            </td>
                            <td className="px-1 py-1 border-b border-r border-slate-100">
                              <input type="text" value={item.category} onChange={e => updateItem(i, 'category', e.target.value)} placeholder="費目" className="w-full text-xs px-1 py-0.5 bg-transparent focus:outline-none focus:bg-indigo-50 focus:ring-1 focus:ring-indigo-300 rounded min-w-[60px]"/>
                            </td>
                            <td className="px-1 py-1 border-b border-r border-slate-100">
                              <input type="number" value={item.amount} onChange={e => updateItem(i, 'amount', e.target.value)} className="w-full text-xs px-1 py-0.5 bg-transparent focus:outline-none focus:bg-indigo-50 focus:ring-1 focus:ring-indigo-300 rounded text-right min-w-[70px]"/>
                            </td>
                            <td className="px-1 py-1 border-b border-r border-slate-100">
                              <input type="text" value={item.notes} onChange={e => updateItem(i, 'notes', e.target.value)} placeholder="備考" className="w-full text-xs px-1 py-0.5 bg-transparent focus:outline-none focus:bg-indigo-50 focus:ring-1 focus:ring-indigo-300 rounded min-w-[80px]"/>
                            </td>
                            <td className="px-1 py-1 border-b border-slate-100 text-center">
                              <button onClick={() => removeItem(i)} className="text-slate-300 hover:text-red-400 transition-colors text-base leading-none">×</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-indigo-50 border-t-2 border-indigo-200">
                          <td colSpan={6} className="px-3 py-3 text-right font-bold text-slate-700">合計</td>
                          <td className="px-3 py-3 text-right font-bold text-indigo-700">¥{editableTotal.toLocaleString()}</td>
                          <td colSpan={2}/>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[11px] text-slate-400 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                    セルをクリックして編集できます。編集内容は送信するExcelに反映されます。
                  </p>
                  <button onClick={addItem} className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors shrink-0 ml-3">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                    </svg>
                    行を追加
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── TEMPLATE mode ─── */}
          {mode === 'template' && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-bold text-slate-700 mb-1">テンプレートを選択</p>
                <p className="text-xs text-slate-400 mb-3">登録済みテンプレートにデータを流し込んで送信します。</p>

                {templates === null ? (
                  <p className="text-xs text-slate-400">読み込み中...</p>
                ) : templates.length === 0 ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-sm text-amber-700 font-medium mb-1">テンプレートが登録されていません</p>
                    <p className="text-xs text-amber-600 mb-2">先にテンプレートページでExcelファイルを登録してください。</p>
                    <a href="/expense/templates" target="_blank" className="text-xs text-amber-700 underline hover:text-amber-900">
                      テンプレート管理ページを開く →
                    </a>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 max-w-lg">
                    {templates.map(t => (
                      <label
                        key={t.id}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
                          selectedTemplateId === t.id
                            ? 'border-indigo-400 bg-indigo-50'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="template"
                          value={t.id}
                          checked={selectedTemplateId === t.id}
                          onChange={() => setSelectedTemplateId(t.id)}
                          className="accent-indigo-600"
                        />
                        <div>
                          <p className="text-sm font-medium text-slate-700">{t.name}</p>
                          {t.description && <p className="text-xs text-slate-400 mt-0.5">{t.description}</p>}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {templates && templates.length > 0 && selectedTemplateId && (
                <button
                  onClick={handlePreviewDownload}
                  disabled={downloading}
                  className="flex items-center gap-2 w-fit text-sm px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 hover:border-indigo-300 hover:text-indigo-600 transition-colors disabled:opacity-40"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                  </svg>
                  {downloading ? '生成中...' : 'このテンプレートで生成してダウンロード確認'}
                </button>
              )}

              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl max-w-lg">
                <p className="text-xs text-blue-700 font-medium mb-1">確認・編集の手順</p>
                <ol className="text-xs text-blue-600 space-y-1 list-decimal list-inside">
                  <li>「ダウンロード確認」でExcelを開いて内容を確認</li>
                  <li>修正が必要な場合はExcelで編集して保存</li>
                  <li>「ファイルを選択」タブに切り替えて修正済みファイルを選択して送信</li>
                </ol>
              </div>
            </div>
          )}

          {/* ─── LOCAL FILE mode ─── */}
          {mode === 'local' && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-bold text-slate-700 mb-1">ローカルファイルを選択</p>
                <p className="text-xs text-slate-400 mb-4">送信したいファイルを直接選択します。Excel・PDF・画像など任意のファイルが添付できます。</p>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center w-full max-w-md h-36 border-2 border-dashed border-slate-300 rounded-2xl text-slate-400 hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50 transition-all"
                >
                  <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                  </svg>
                  <span className="text-sm font-medium">クリックしてファイルを選択</span>
                  <span className="text-xs mt-1 text-slate-300">.xlsx / .pdf / 画像など</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.pdf,.csv,image/*"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0] ?? null
                    setLocalFile(f)
                    if (f) {
                      setSubject(`【精算書】${report.title}`)
                    }
                  }}
                />
              </div>

              {localFile && (
                <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl max-w-md">
                  <svg className="w-8 h-8 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-emerald-800 truncate">{localFile.name}</p>
                    <p className="text-xs text-emerald-600">{(localFile.size / 1024).toFixed(0)} KB</p>
                  </div>
                  <button
                    onClick={() => { setLocalFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                    className="text-emerald-400 hover:text-emerald-700 shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              )}

              {!localFile && (
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl max-w-md">
                  <p className="text-xs text-blue-700 font-medium mb-1">ヒント</p>
                  <p className="text-xs text-blue-600">「自動生成」または「テンプレート」タブからExcelをダウンロードして確認→編集した後、ここから選択して送信できます。</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right: email form ── */}
        <div className="w-80 border-l border-slate-200 bg-white flex flex-col shrink-0">
          <div className="px-5 pt-4 pb-3 border-b border-slate-100 shrink-0">
            <p className="text-sm font-bold text-slate-700">メール送信</p>
            <p className="text-xs text-slate-400 mt-0.5">Gmailから直接送信します</p>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">宛先 <span className="text-red-400">*</span></label>
              <input type="email" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="recipient@example.com" value={to} onChange={e => setTo(e.target.value)}/>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">CC（任意）</label>
              <input type="email" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="cc@example.com" value={cc} onChange={e => setCc(e.target.value)}/>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">件名</label>
              <input type="text" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" value={subject} onChange={e => setSubject(e.target.value)}/>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">本文</label>
              <textarea rows={7} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" value={bodyText} onChange={e => setBodyText(e.target.value)}/>
            </div>

            {/* Attachment badge */}
            <div className="flex items-start gap-2 px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-200">
              <svg className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
              </svg>
              <span className="text-xs text-slate-600 break-all">{attachmentLabel()}</span>
            </div>

            {/* Reauth notice */}
            <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-lg">
              <svg className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
              <div>
                <p className="text-[11px] text-amber-700">初回は <a href="/api/auth/google?returnTo=/expense" className="underline font-semibold hover:text-amber-900">Googleアカウントを再認証</a> してください（gmail.send スコープの追加が必要）</p>
              </div>
            </div>

            {sendResult?.ok && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                </svg>
                <span className="text-sm text-emerald-700 font-medium">送信完了しました</span>
              </div>
            )}
            {sendResult?.error && (
              <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs text-red-600">{sendResult.error}</p>
              </div>
            )}
          </div>

          <div className="px-5 py-4 border-t border-slate-100 space-y-2 shrink-0">
            <button
              onClick={handleSend}
              disabled={!canSend || sending || sendResult?.ok}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {sending
                ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>送信中...</>
                : sendResult?.ok
                  ? <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>送信済み</>
                  : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>メールで送信</>
              }
            </button>
            {mode !== 'local' && (
              <button
                onClick={handlePreviewDownload}
                disabled={downloading || (mode === 'template' && !selectedTemplateId)}
                className="w-full flex items-center justify-center gap-2 text-sm text-slate-600 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-40"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
                ダウンロードして確認
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
