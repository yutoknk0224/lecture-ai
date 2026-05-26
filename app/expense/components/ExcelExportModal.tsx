'use client'

import { useState, useEffect } from 'react'

type Template = { id: string; name: string; mappings: { fieldKey: string }[] }

const TRAVEL_PROFILE_FIELDS = [
  { key: 'student_name',           label: '氏名' },
  { key: 'student_name_kana',      label: '氏名フリガナ' },
  { key: 'student_id',             label: '学籍番号' },
  { key: 'supervisor_name',        label: '担当教員氏名' },
  { key: 'supervisor_affiliation', label: '担当教員所属' },
  { key: 'address_zip',            label: '郵便番号' },
  { key: 'address',                label: '住所' },
  { key: 'email',                  label: 'メールアドレス' },
  { key: 'tel_1',                  label: '電話番号' },
  { key: 'bank_name',              label: '銀行名' },
  { key: 'bank_name_kana',         label: '銀行名フリガナ' },
  { key: 'branch_name',            label: '支店名' },
  { key: 'branch_name_kana',       label: '支店名フリガナ' },
  { key: 'account_number',         label: '口座番号' },
  { key: 'account_holder',         label: '口座名義（カナ）' },
]

const EQUIPMENT_PROFILE_FIELDS = [
  { key: 'student_name',           label: '申請者名' },
  { key: 'supervisor_affiliation', label: '所属部署' },
  { key: 'supervisor_name',        label: '承認者名' },
  { key: 'eq_payment_method',      label: '支払方法' },
]

type Props = {
  reportId: string
  reportTitle: string
  reportType?: string
  onClose: () => void
}

export default function ExcelExportModal({ reportId, reportTitle, onClose }: Props) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [profile, setProfile] = useState<Record<string, string>>({})
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const selectedTemplate = templates.find(t => t.id === selectedId)
  const isEquipmentTemplate = selectedTemplate?.mappings.some(m => m.fieldKey.startsWith('eq_')) ?? false
  const PROFILE_FIELDS = isEquipmentTemplate ? EQUIPMENT_PROFILE_FIELDS : TRAVEL_PROFILE_FIELDS

  useEffect(() => {
    fetch('/api/expense/templates')
      .then((r) => r.json())
      .then((data: Template[]) => {
        const withMap = data.filter((t) => t.mappings.length > 0)
        setTemplates(withMap)
        if (withMap.length > 0) setSelectedId(withMap[0].id)
      })
    fetch('/api/expense/settings')
      .then((r) => r.json())
      .then((data: Record<string, string>) => setProfile(data))
  }, [])

  const handleSaveProfile = async () => {
    setProfileSaving(true)
    await fetch('/api/expense/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    })
    setProfileSaving(false)
    setProfileSaved(true)
    setTimeout(() => setProfileSaved(false), 2000)
  }

  const handleGenerate = async () => {
    if (!selectedId) return
    setGenerating(true)
    setError('')
    try {
      const res = await fetch(`/api/expense/templates/${selectedId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId, personalInfo: profile }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({ error: 'エラー' }))
        setError(e.error ?? 'エラーが発生しました')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const cd = res.headers.get('Content-Disposition') ?? ''
      const fn = decodeURIComponent(cd.match(/filename\*=UTF-8''(.+)/)?.[1] ?? `精算書_${reportTitle}.xlsx`)
      a.download = fn
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(String(e))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-800">Excel 出力</h2>
            <p className="text-xs text-slate-400 mt-0.5">{reportTitle}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* テンプレート選択 */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">テンプレート</label>
            {templates.length === 0 ? (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                マッピング設定済みのテンプレートがありません。テンプレート管理ページで設定してください。
              </p>
            ) : (
              <select
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}（{t.mappings.length}項目）
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 個人情報 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-600">個人情報</label>
              <div className="flex items-center gap-2">
                {profileSaved && <span className="text-xs text-emerald-600">✓ 保存済み</span>}
                <button
                  onClick={handleSaveProfile}
                  disabled={profileSaving}
                  className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg hover:bg-slate-200 disabled:opacity-40"
                >
                  {profileSaving ? '保存中...' : '次回のために保存'}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PROFILE_FIELDS.map(({ key, label }) => (
                <div key={key}>
                  <label className="text-[11px] text-slate-400 block mb-0.5">{label}</label>
                  <input
                    className="w-full border border-slate-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    value={profile[key] ?? ''}
                    onChange={(e) => setProfile((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* フッター */}
        <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="text-sm text-slate-500 px-4 py-2 rounded-lg hover:bg-slate-100"
          >
            キャンセル
          </button>
          <button
            onClick={handleGenerate}
            disabled={!selectedId || generating}
            className="text-sm bg-emerald-600 text-white px-5 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-40 flex items-center gap-2"
          >
            {generating ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                生成中...
              </>
            ) : '生成してダウンロード'}
          </button>
        </div>
      </div>
    </div>
  )
}
