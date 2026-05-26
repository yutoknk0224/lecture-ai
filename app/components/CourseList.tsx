'use client'

import { useState } from 'react'

type Material = {
  id: string
  title: string
  fileType: string
  createdAt: string
}

type Course = {
  id: string
  name: string
  description: string | null
  materials: Material[]
  createdAt: string
}

type Props = {
  courses: Course[]
  selectedCourseId: string | null
  onSelectCourse: (id: string) => void
  onCourseCreated: () => void
  onCourseDeleted: () => void
}

const COURSE_COLORS = [
  'bg-indigo-500',
  'bg-violet-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-pink-500',
  'bg-teal-500',
]

export default function CourseList({
  courses,
  selectedCourseId,
  onSelectCourse,
  onCourseCreated,
  onCourseDeleted,
}: Props) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) return
    setLoading(true)
    await fetch('/api/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    })
    setName('')
    setDescription('')
    setShowForm(false)
    setLoading(false)
    onCourseCreated()
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('この科目と関連する全資料を削除しますか？')) return
    await fetch(`/api/courses/${id}`, { method: 'DELETE' })
    onCourseDeleted()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">科目一覧</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="w-7 h-7 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center transition-colors"
            title="科目を追加"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="mx-3 mt-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
          <input
            type="text"
            placeholder="科目名（例：線形代数）"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <input
            type="text"
            placeholder="説明（省略可）"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={loading || !name.trim()}
              className="flex-1 bg-indigo-600 text-white py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
            >
              {loading ? '作成中...' : '作成'}
            </button>
            <button
              onClick={() => { setShowForm(false); setName(''); setDescription('') }}
              className="flex-1 bg-white text-slate-600 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-50 border border-slate-200 transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* Course list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {courses.length === 0 && !showForm && (
          <div className="text-center py-10">
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <p className="text-xs text-slate-400">＋ボタンで科目を追加</p>
          </div>
        )}
        {courses.map((course, index) => {
          const color = COURSE_COLORS[index % COURSE_COLORS.length]
          const isSelected = selectedCourseId === course.id
          return (
            <div
              key={course.id}
              onClick={() => onSelectCourse(course.id)}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                isSelected
                  ? 'bg-indigo-50 shadow-sm'
                  : 'hover:bg-slate-50'
              }`}
            >
              <div className={`w-8 h-8 ${color} rounded-lg flex items-center justify-center shrink-0 shadow-sm`}>
                <span className="text-white text-xs font-bold">
                  {course.name.charAt(0)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${isSelected ? 'text-indigo-700' : 'text-slate-700'}`}>
                  {course.name}
                </p>
                <p className="text-xs text-slate-400">
                  {course.materials.length} 件の資料
                </p>
              </div>
              <button
                onClick={(e) => handleDelete(course.id, e)}
                className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center text-slate-300 hover:text-red-400 transition-all rounded-md hover:bg-red-50"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
