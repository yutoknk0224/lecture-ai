'use client'

import { useState, useEffect, useCallback } from 'react'

type Memo = { id: string; date: string; content: string }

export default function CalendarPanel() {
  const today = new Date()
  const [current, setCurrent] = useState({ year: today.getFullYear(), month: today.getMonth() })
  const [memos, setMemos] = useState<Memo[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [saving, setSaving] = useState(false)

  const monthStr = `${current.year}-${String(current.month + 1).padStart(2, '0')}`

  const loadMemos = useCallback(async () => {
    const res = await fetch(`/api/memos?month=${monthStr}`)
    const data = await res.json()
    setMemos(data)
  }, [monthStr])

  useEffect(() => { loadMemos() }, [loadMemos])

  const daysInMonth = new Date(current.year, current.month + 1, 0).getDate()
  const firstDay = new Date(current.year, current.month, 1).getDay()

  const toDateStr = (day: number) =>
    `${current.year}-${String(current.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const memoMap = Object.fromEntries(memos.map((m) => [m.date, m]))

  const handleDayClick = (day: number) => {
    const dateStr = toDateStr(day)
    setSelectedDate(dateStr)
    setEditText(memoMap[dateStr]?.content ?? '')
  }

  const handleSave = async () => {
    if (!selectedDate) return
    setSaving(true)
    await fetch('/api/memos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: selectedDate, content: editText }),
    })
    await loadMemos()
    window.dispatchEvent(new Event('memo-updated'))
    setSaving(false)
    setSelectedDate(null)
  }

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

  return (
    <div className="flex flex-col h-full p-3 gap-2">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <button
          onClick={() => setCurrent((c) => {
            const d = new Date(c.year, c.month - 1)
            return { year: d.getFullYear(), month: d.getMonth() }
          })}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-500"
        >‹</button>
        <span className="text-xs font-bold text-slate-700">{current.year}年{current.month + 1}月</span>
        <button
          onClick={() => setCurrent((c) => {
            const d = new Date(c.year, c.month + 1)
            return { year: d.getFullYear(), month: d.getMonth() }
          })}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-500"
        >›</button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 shrink-0">
        {DAY_LABELS.map((d, i) => (
          <div key={d} className={`text-center text-[10px] font-medium pb-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-400'}`}>
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-y-0.5 flex-1">
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const dateStr = toDateStr(day)
          const hasMemo = !!memoMap[dateStr]
          const isToday = dateStr === todayStr
          const dow = (firstDay + i) % 7
          return (
            <button
              key={day}
              onClick={() => handleDayClick(day)}
              className={`relative flex flex-col items-center justify-center rounded text-[11px] font-medium py-0.5 transition-colors
                ${isToday ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100'}
                ${dow === 0 ? 'text-red-400' : dow === 6 ? 'text-blue-400' : 'text-slate-700'}
                ${isToday ? '!text-white' : ''}
              `}
            >
              {day}
              {hasMemo && (
                <span className={`absolute bottom-0.5 w-1 h-1 rounded-full ${isToday ? 'bg-white' : 'bg-indigo-400'}`} />
              )}
            </button>
          )
        })}
      </div>

      {/* Memo editor */}
      {selectedDate && (
        <div className="shrink-0 border-t border-slate-200 pt-2">
          <p className="text-[10px] text-slate-400 mb-1">{selectedDate}</p>
          <textarea
            className="w-full text-xs border border-slate-200 rounded p-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-300"
            rows={2}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            placeholder="メモを入力..."
            autoFocus
          />
          <div className="flex gap-1 mt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 text-[10px] bg-indigo-600 text-white rounded py-1 hover:bg-indigo-700 disabled:opacity-50"
            >保存</button>
            <button
              onClick={() => setSelectedDate(null)}
              className="flex-1 text-[10px] bg-slate-100 text-slate-600 rounded py-1 hover:bg-slate-200"
            >キャンセル</button>
          </div>
        </div>
      )}
    </div>
  )
}
