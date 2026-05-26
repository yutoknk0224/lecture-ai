'use client'

import { useState } from 'react'

type ExpenseItem = { id: string; amount: number }

type Report = {
  id: string
  title: string
  period: string
  status: string
  dueDate: string | null
  items: ExpenseItem[]
}

type Props = {
  reports: Report[]
  selectedId: string | null
  onSelect: (id: string) => void
  onCreated: () => void
}

function dueBadge(dueDate: string | null) {
  if (!dueDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / 86400000)

  if (diffDays < 0) return <span className="text-[9px] px-1 py-0.5 bg-red-100 text-red-600 rounded font-medium shrink-0">{Math.abs(diffDays)}日超過</span>
  if (diffDays === 0) return <span className="text-[9px] px-1 py-0.5 bg-red-100 text-red-600 rounded font-medium shrink-0">今日</span>
  if (diffDays <= 3) return <span className="text-[9px] px-1 py-0.5 bg-orange-100 text-orange-600 rounded font-medium shrink-0">あと{diffDays}日</span>
  return <span className="text-[9px] px-1 py-0.5 bg-slate-100 text-slate-500 rounded shrink-0">{dueDate.slice(5).replace('-', '/')}</span>
}

export default function ReportList({ reports, selectedId, onSelect, onCreated }: Props) {
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [period, setPeriod] = useState('')
  const [dueDate, setDueDate] = useState('')

  const handleCreate = async () => {
    if (!title.trim() || !period.trim()) return
    await fetch('/api/expense/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, period, dueDate: dueDate || null }),
    })
    setTitle('')
    setPeriod('')
    setDueDate('')
    setCreating(false)
    onCreated()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-700">精算レポート</h2>
        <button
          onClick={() => setCreating(true)}
          className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700"
        >
          + 新規
        </button>
      </div>

      {creating && (
        <div className="mb-3 p-3 bg-indigo-50 rounded-lg border border-indigo-200 space-y-2">
          <input
            className="w-full text-xs border border-slate-200 rounded px-2 py-1"
            placeholder="タイトル（例：2025年4月出張）"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <input
            className="w-full text-xs border border-slate-200 rounded px-2 py-1"
            placeholder="対象期間（例：2025年4月）"
            value={period}
            onChange={e => setPeriod(e.target.value)}
          />
          <div>
            <label className="text-[11px] text-slate-500 block mb-0.5">提出期日（任意）</label>
            <input
              type="date"
              className="w-full text-xs border border-slate-200 rounded px-2 py-1"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              className="flex-1 text-xs bg-indigo-600 text-white rounded px-2 py-1 hover:bg-indigo-700"
            >
              作成
            </button>
            <button
              onClick={() => setCreating(false)}
              className="flex-1 text-xs bg-slate-200 text-slate-600 rounded px-2 py-1 hover:bg-slate-300"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1 overflow-y-auto">
        {reports.map(r => {
          const total = r.items.reduce((s, i) => s + i.amount, 0)
          const isSelected = r.id === selectedId
          return (
            <button
              key={r.id}
              onClick={() => onSelect(r.id)}
              className={`text-left px-3 py-2.5 rounded-lg border transition-colors ${
                isSelected
                  ? 'bg-indigo-50 border-indigo-300'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-start gap-1.5">
                <p className={`text-xs font-medium truncate flex-1 ${isSelected ? 'text-indigo-700' : 'text-slate-700'}`}>
                  {r.title}
                </p>
                {dueBadge(r.dueDate)}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{r.period}</p>
              <p className={`text-xs font-semibold mt-0.5 ${isSelected ? 'text-indigo-600' : 'text-slate-500'}`}>
                ¥{total.toLocaleString()}
              </p>
            </button>
          )
        })}
        {reports.length === 0 && (
          <p className="text-xs text-slate-400 text-center mt-4">レポートがありません</p>
        )}
      </div>
    </div>
  )
}
