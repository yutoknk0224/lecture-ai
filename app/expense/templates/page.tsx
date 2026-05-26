'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import MappingEditor from './MappingEditor'

type CellMapping = { fieldKey: string; cellAddress: string }
type Template = {
  id: string
  name: string
  description: string
  fileName: string
  filePath: string
  sheetName: string
  createdAt: string
  mappings: CellMapping[]
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [sheetName, setSheetName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/expense/templates')
    setTemplates(await res.json())
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('name', name)
      fd.append('description', description)
      fd.append('sheetName', sheetName)
      if (file) fd.append('file', file)
      const res = await fetch('/api/expense/templates', { method: 'POST', body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'サーバーエラー' }))
        alert(`登録に失敗しました: ${err.error}`)
        return
      }
      const created = await res.json()
      setShowForm(false)
      setName(''); setDescription(''); setSheetName(''); setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      load()
      setExpandedId(created.id)
    } catch (e) {
      alert(`エラーが発生しました: ${e}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このテンプレートを削除しますか？')) return
    await fetch(`/api/expense/templates/${id}`, { method: 'DELETE' })
    if (expandedId === id) setExpandedId(null)
    load()
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
          <span className="text-white text-sm font-bold">¥</span>
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-800">Excel テンプレート管理</h1>
          <p className="text-xs text-slate-400">書き出し用フォーマットを登録・設定</p>
        </div>
        <nav className="ml-auto flex gap-4 text-sm text-slate-500">
          <a href="/" className="hover:text-indigo-600">講義資料管理</a>
          <a href="/expense" className="hover:text-emerald-600">経費精算</a>
          <span className="text-emerald-600 font-medium">テンプレート管理</span>
        </nav>
      </header>

      <div className="flex-1 overflow-auto p-6 max-w-4xl mx-auto w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-700">登録済みテンプレート</h2>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="text-sm bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700"
          >
            + テンプレート追加
          </button>
        </div>

        {/* 新規追加フォーム */}
        {showForm && (
          <div className="bg-white rounded-xl border border-emerald-200 p-4 mb-4 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">テンプレート名 *</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  placeholder="例：大学旅費精算書"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">シート名（空欄=先頭シート）</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  placeholder="例：Sheet1"
                  value={sheetName}
                  onChange={(e) => setSheetName(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">説明（任意）</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                placeholder="例：○○大学指定様式"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">テンプレートファイル（.xlsx）</label>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="text-sm text-slate-600"
              />
              <p className="text-xs text-slate-400 mt-0.5">後でマッピング設定を行います。ファイルなしでも登録できます。</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={!name.trim() || saving}
                className="text-sm bg-emerald-600 text-white px-4 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-40"
              >
                {saving ? '保存中...' : '登録'}
              </button>
              <button
                onClick={() => { setShowForm(false); setName(''); setDescription(''); setSheetName(''); setFile(null) }}
                className="text-sm bg-slate-200 text-slate-600 px-4 py-1.5 rounded-lg hover:bg-slate-300"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {/* テンプレート一覧 */}
        {templates.length === 0 && !showForm && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-slate-500 text-sm font-medium">テンプレートがありません</p>
            <p className="text-slate-400 text-xs mt-1">「+ テンプレート追加」から登録してください</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {templates.map((t) => (
            <div key={t.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{t.name}</p>
                  {t.description && <p className="text-xs text-slate-400 mt-0.5">{t.description}</p>}
                  <div className="flex gap-3 mt-1 text-xs text-slate-400">
                    {t.filePath ? (
                      <span className="text-emerald-600">✓ ファイルあり</span>
                    ) : (
                      <span className="text-amber-500">ファイル未設定</span>
                    )}
                    {t.sheetName && <span>シート: {t.sheetName}</span>}
                    <span>マッピング: {t.mappings.length}項目</span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                    className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                      expandedId === t.id
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {expandedId === t.id ? '閉じる' : 'マッピング設定'}
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="text-xs bg-red-100 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-200"
                  >
                    削除
                  </button>
                </div>
              </div>

              {expandedId === t.id && (
                <MappingEditor templateId={t.id} initialMappings={t.mappings} onSaved={load} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
