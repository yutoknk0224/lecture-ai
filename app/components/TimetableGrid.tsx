'use client'

import { useState, Fragment } from 'react'

type MaterialSummary = {
  id: string
  title: string
  fileType: string
  createdAt: string
}

type Course = {
  id: string
  name: string
  description: string | null
  day: number | null
  period: number | null
  year: number | null
  semester: string | null
  materials: MaterialSummary[]
}

type Props = {
  courses: Course[]
  currentYear: number | null
  currentSemester: string | null
  onSelectCourse: (id: string) => void
  onCourseCreated: () => void
  onCourseDeleted: (id: string) => void
}

const DAYS = ['月', '火', '水', '木', '金']
const PERIODS = [1, 2, 3, 4, 5]

const COLORS = [
  { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-300', ring: 'ring-indigo-400' },
  { bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-300', ring: 'ring-violet-400' },
  { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300', ring: 'ring-emerald-400' },
  { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300', ring: 'ring-amber-400' },
  { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-300', ring: 'ring-rose-400' },
  { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-300', ring: 'ring-cyan-400' },
  { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-300', ring: 'ring-pink-400' },
  { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-300', ring: 'ring-teal-400' },
]

export default function TimetableGrid({
  courses,
  currentYear,
  currentSemester,
  onSelectCourse,
  onCourseCreated,
  onCourseDeleted,
}: Props) {
  const [modal, setModal] = useState<{ day: number; period: number } | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)

  // Build lookup map: "day-period" → {course, colorIndex}
  const courseMap = new Map<string, { course: Course; colorIndex: number }>()
  courses.forEach((c, i) => {
    if (c.day !== null && c.period !== null) {
      courseMap.set(`${c.day}-${c.period}`, { course: c, colorIndex: i })
    }
  })

  const getColor = (index: number) => COLORS[index % COLORS.length]

  const handleCellClick = (day: number, period: number) => {
    const entry = courseMap.get(`${day}-${period}`)
    if (entry) {
      onSelectCourse(entry.course.id)
    } else {
      setModal({ day, period })
    }
  }

  const handleCreate = async () => {
    if (!name.trim() || !modal) return
    setCreating(true)
    await fetch('/api/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description,
        day: modal.day,
        period: modal.period,
        year: currentYear,
        semester: currentSemester,
      }),
    })
    setName('')
    setDescription('')
    setModal(null)
    setCreating(false)
    onCourseCreated()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('この科目と関連する全資料を削除しますか？')) return
    await fetch(`/api/courses/${id}`, { method: 'DELETE' })
    onCourseDeleted(id)
  }

  // Courses without day/period (show below grid)
  const unscheduled = courses.filter((c) => c.day === null || c.period === null)

  const isCommonView = currentYear === null

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Grid */}
      <div className="grid gap-2" style={{ gridTemplateColumns: '44px repeat(5, 1fr)' }}>
        {/* Header row */}
        <div />
        {DAYS.map((day) => (
          <div
            key={day}
            className="text-center py-2.5 text-sm font-bold text-slate-600 bg-white rounded-xl border border-slate-200"
          >
            {day}曜
          </div>
        ))}

        {/* Period rows */}
        {PERIODS.map((period) => (
          <Fragment key={period}>
            <div
              className="flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200 py-2"
            >
              <span className="text-xs font-bold text-slate-500">{period}</span>
              <span className="text-xs text-slate-400">限</span>
            </div>
            {DAYS.map((_, dayIdx) => {
              const entry = courseMap.get(`${dayIdx}-${period}`)
              const course = entry?.course
              const color = entry ? getColor(entry.colorIndex) : null

              return (
                <div
                  key={`${dayIdx}-${period}`}
                  onClick={() => handleCellClick(dayIdx, period)}
                  className={`group relative min-h-[90px] rounded-xl border-2 cursor-pointer transition-all flex flex-col p-3 ${
                    course
                      ? `${color!.bg} ${color!.border} hover:shadow-md hover:scale-[1.02]`
                      : 'bg-white border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'
                  }`}
                >
                  {course ? (
                    <>
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <p className={`text-xs font-bold leading-snug flex-1 ${color!.text}`}>
                          {course.name}
                        </p>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(course.id) }}
                          className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center text-slate-400 hover:text-red-500 transition-all rounded shrink-0"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      {course.description && (
                        <p className={`text-xs opacity-60 line-clamp-1 ${color!.text}`}>
                          {course.description}
                        </p>
                      )}
                      <div className="mt-auto flex items-center gap-1">
                        <span className={`text-xs opacity-50 ${color!.text}`}>
                          📄 {course.materials.length}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <span className="text-indigo-300 text-2xl opacity-0 group-hover:opacity-100 transition-opacity">＋</span>
                    </div>
                  )}
                </div>
              )
            })}
          </Fragment>
        ))}
      </div>

      {/* Unscheduled courses */}
      {unscheduled.length > 0 && (
        <div className="mt-4 bg-white rounded-2xl border border-slate-200 p-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            {isCommonView ? '曜日・時限未設定' : '曜日・時限未設定'}
          </h3>
          <div className="flex flex-wrap gap-2">
            {unscheduled.map((course) => {
              const globalIdx = courses.indexOf(course)
              const color = getColor(globalIdx)
              return (
                <button
                  key={course.id}
                  onClick={() => onSelectCourse(course.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all hover:shadow-sm ${color.bg} ${color.text} ${color.border}`}
                >
                  {course.name}
                  <span className="text-xs opacity-50">{course.materials.length}件</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {courses.length === 0 && (
        <div className="mt-8 text-center py-8">
          <p className="text-slate-400 text-sm">空きコマをクリックして科目を追加できます</p>
        </div>
      )}

      {/* Add course modal */}
      {modal && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => { setModal(null); setName(''); setDescription('') }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 w-80 mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">科目を追加</h3>
                <p className="text-xs text-slate-400">
                  {isCommonView ? '共通科目' : `${currentYear}年 ${currentSemester}`}
                  {' · '}
                  {DAYS[modal.day]}曜 {modal.period}限
                </p>
              </div>
            </div>

            <input
              type="text"
              placeholder="科目名（例：線形代数）"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <input
              type="text"
              placeholder="説明・担当教員など（省略可）"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={creating || !name.trim()}
                className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
              >
                {creating ? '追加中...' : '追加'}
              </button>
              <button
                onClick={() => { setModal(null); setName(''); setDescription('') }}
                className="flex-1 bg-slate-100 text-slate-600 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
