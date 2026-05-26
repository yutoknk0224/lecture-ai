'use client'

import { useState, useMemo } from 'react'

type Report = {
  id: string
  title: string
  dueDate: string | null
  folderId?: string | null
}

type Folder = {
  id: string
  name: string
  color: string
}

type CalendarNote = {
  id: string
  date: string
  content: string
  color: string
}

type Props = {
  reports: Report[]
  folders?: Folder[]
  notes?: CalendarNote[]
  selectedId: string | null
  onSelect: (id: string) => void
  onDateClick?: (dateStr: string) => void
}

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export default function DeadlineCalendar({ reports, folders = [], notes = [], selectedId, onSelect, onDateClick }: Props) {
  const today = new Date()
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate())

  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay()

  const folderMap = useMemo(() => new Map(folders.map(f => [f.id, f])), [folders])

  const deadlineMap = useMemo(() => {
    const map = new Map<string, Report[]>()
    for (const r of reports) {
      if (!r.dueDate) continue
      const key = r.dueDate.slice(0, 10)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    return map
  }, [reports])

  const noteMap = useMemo(() => {
    const map = new Map<string, CalendarNote[]>()
    for (const n of notes) {
      if (!map.has(n.date)) map.set(n.date, [])
      map.get(n.date)!.push(n)
    }
    return map
  }, [notes])

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const upcomingReports = useMemo(() =>
    reports
      .filter(r => r.dueDate && r.dueDate >= todayStr)
      .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
      .slice(0, 5),
    [reports, todayStr]
  )

  const getReportColor = (report: Report, isPast: boolean) => {
    if (report.folderId) {
      const folder = folderMap.get(report.folderId)
      if (folder) return folder.color
    }
    return isPast ? '#f87171' : '#fb923c'
  }

  return (
    <div>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
          </div>
          <span className="text-base font-bold text-slate-700">期日カレンダー</span>
          {onDateClick && (
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">日付をクリックしてメモ追加</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <span className="text-sm font-semibold text-slate-600 w-20 text-center">
            {viewYear}/{String(viewMonth + 1).padStart(2, '0')}
          </span>
          <button onClick={nextMonth} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      </div>

      {/* 横並びレイアウト：左=カレンダー（広め）、右=期日リスト（狭め） */}
      <div className="flex gap-5 items-start">
        {/* カレンダーグリッド */}
        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-7 bg-slate-50 rounded-xl p-3 gap-y-1">
            {['日', '月', '火', '水', '木', '金', '土'].map(d => (
              <div key={d} className="text-center text-xs text-indigo-400 pb-2 font-bold">{d}</div>
            ))}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`empty-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dateStr = toDateStr(viewYear, viewMonth, day)
              const dayReports = deadlineMap.get(dateStr) ?? []
              const dayNotes = noteMap.get(dateStr) ?? []
              const isToday = dateStr === todayStr
              const isPast = dateStr < todayStr
              const hasDeadline = dayReports.length > 0
              const hasNote = dayNotes.length > 0
              const isSelected = dayReports.some(r => r.id === selectedId)

              return (
                <div key={day} className="flex flex-col items-center gap-0.5 py-0.5">
                  <button
                    onClick={() => onDateClick?.(dateStr)}
                    title={hasNote ? dayNotes.map(n => n.content).join(' / ') : dateStr}
                    className={`text-xs w-8 h-8 flex items-center justify-center rounded-full font-medium transition-colors
                      ${isToday ? 'bg-indigo-600 text-white font-bold shadow-sm' : ''}
                      ${!isToday && hasDeadline && isPast ? 'text-red-500 font-bold' : ''}
                      ${!isToday && hasDeadline && !isPast ? 'text-orange-500 font-bold' : ''}
                      ${!isToday && !hasDeadline ? 'text-slate-500' : ''}
                      ${isSelected ? 'ring-2 ring-indigo-400' : ''}
                      ${onDateClick ? 'hover:bg-indigo-50 cursor-pointer' : ''}
                    `}
                  >
                    {day}
                  </button>
                  {/* 期日ドット */}
                  {hasDeadline && (
                    <div className="flex gap-0.5 h-1.5">
                      {dayReports.slice(0, 3).map(r => (
                        <button
                          key={r.id}
                          onClick={e => { e.stopPropagation(); onSelect(r.id) }}
                          title={r.title}
                          className={`w-1.5 h-1.5 rounded-full transition-transform hover:scale-125 ${r.id === selectedId ? 'ring-1 ring-indigo-500' : ''}`}
                          style={{ backgroundColor: getReportColor(r, isPast) }}
                        />
                      ))}
                    </div>
                  )}
                  {/* メモインジケーター */}
                  {hasNote && (
                    <div className="flex gap-0.5 h-1.5">
                      {dayNotes.slice(0, 3).map(n => (
                        <div
                          key={n.id}
                          className="w-1.5 h-1.5 rounded-sm"
                          style={{ backgroundColor: n.color }}
                          title={n.content}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* 凡例 */}
          <div className="flex items-center gap-4 mt-2 px-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <div className="w-2 h-2 rounded-full bg-orange-400"/>
              期日
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <div className="w-2 h-2 rounded-sm bg-indigo-400"/>
              メモ
            </div>
          </div>
        </div>

        {/* 期日が近いレポート（狭め） */}
        <div className="w-44 shrink-0">
          {upcomingReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[120px] text-center">
              <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center mb-2">
                <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
              </div>
              <p className="text-xs text-slate-400">期日が設定された<br/>レポートはありません</p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-indigo-500 font-bold mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-400 inline-block shrink-0" />
                期日が近い
              </p>
              <div className="space-y-1.5">
                {upcomingReports.map(r => {
                  const due = new Date(r.dueDate!)
                  const diffDays = Math.ceil((due.setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000)
                  const urgent = diffDays <= 3
                  const dotColor = getReportColor(r, false)
                  return (
                    <button
                      key={r.id}
                      onClick={() => onSelect(r.id)}
                      className={`w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-colors
                        ${r.id === selectedId
                          ? 'bg-white border-indigo-200 shadow-sm'
                          : 'bg-white/70 border-transparent hover:bg-white hover:border-indigo-100'}
                      `}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: urgent ? '#f87171' : dotColor }} />
                      <span className="text-xs text-slate-700 truncate flex-1 leading-tight">{r.title}</span>
                      <span className={`text-[10px] ml-auto shrink-0 font-bold ${urgent ? 'text-red-500' : 'text-orange-500'}`}>
                        {diffDays === 0 ? '今日' : `${diffDays}日`}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
