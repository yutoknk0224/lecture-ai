'use client'

import { useState, useEffect, useRef, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import MaterialDetail from '@/app/components/MaterialDetail'
import MultiWorkspace from '@/app/components/MultiWorkspace'

type MaterialSummary = {
  id: string
  title: string
  fileType: string
  createdAt: string
}

type Lecture = {
  id: string
  title: string
  date: string | null
  instructor: string | null
  notes: string | null
  order: number
  materials: MaterialSummary[]
}

type Course = {
  id: string
  name: string
  description: string | null
  day: number | null
  period: number | null
  year: number | null
  semester: string | null
  lectures: Lecture[]
  materials: MaterialSummary[] // lectureId null のもの
}

const DAYS = ['月', '火', '水', '木', '金']

function fileTypeIcon(type: string) {
  if (type.includes('pdf')) return '📄'
  if (type.includes('text')) return '📝'
  return '📁'
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null
  const [, m, d] = dateStr.split('-')
  return `${Number(m)}/${Number(d)}`
}

export default function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [course, setCourse] = useState<Course | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [uploading, setUploading] = useState<string | null>(null) // lectureId or 'none'
  const [dragOverLecture, setDragOverLecture] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [addingLecture, setAddingLecture] = useState(false)
  const [newLecture, setNewLecture] = useState({ title: '', date: '' })
  const [editingLecture, setEditingLecture] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ title: '', date: '', instructor: '', notes: '' })
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const loadCourse = useCallback(async () => {
    const res = await fetch(`/api/courses/${id}`)
    if (res.ok) setCourse(await res.json())
  }, [id])

  useEffect(() => { loadCourse() }, [loadCourse])

  // 全資料のフラットリスト（選択管理用）
  const allMaterials: MaterialSummary[] = course
    ? [...(course.materials ?? []), ...course.lectures.flatMap((l) => l.materials)]
    : []

  const toggleSelect = (materialId: string) => {
    setSelectedIds((prev) =>
      prev.includes(materialId) ? prev.filter((x) => x !== materialId) : [...prev, materialId]
    )
  }

  const uploadFile = async (file: File, lectureId: string | null) => {
    setUploading(lectureId ?? 'none')
    const form = new FormData()
    form.append('file', file)
    form.append('courseId', id)
    form.append('title', file.name)
    if (lectureId) form.append('lectureId', lectureId)
    await fetch('/api/materials', { method: 'POST', body: form })
    setUploading(null)
    loadCourse()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, lectureId: string | null) => {
    const file = e.target.files?.[0]
    if (file) await uploadFile(file, lectureId)
    const ref = fileRefs.current[lectureId ?? 'none']
    if (ref) ref.value = ''
  }

  const handleDrop = async (e: React.DragEvent, lectureId: string | null) => {
    e.preventDefault()
    setDragOverLecture(null)
    const file = e.dataTransfer.files[0]
    if (file) await uploadFile(file, lectureId)
  }

  const handleDeleteMaterial = async (materialId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('この資料を削除しますか？')) return
    await fetch(`/api/materials/${materialId}`, { method: 'DELETE' })
    setSelectedIds((prev) => prev.filter((x) => x !== materialId))
    loadCourse()
  }

  const handleAddLecture = async () => {
    if (!newLecture.title.trim()) return
    const nextNum = course ? course.lectures.filter((l) => l.title !== '未分類').length + 1 : 1
    await fetch('/api/lectures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId: id, title: newLecture.title || `第${nextNum}回`, date: newLecture.date }),
    })
    setNewLecture({ title: '', date: '' })
    setAddingLecture(false)
    loadCourse()
  }

  const handleDeleteLecture = async (lectureId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('この授業回を削除しますか？（資料は未分類に移動します）')) return
    await fetch(`/api/lectures/${lectureId}`, { method: 'DELETE' })
    loadCourse()
  }

  const startEditLecture = (lecture: Lecture, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingLecture(lecture.id)
    setEditForm({ title: lecture.title, date: lecture.date ?? '', instructor: lecture.instructor ?? '', notes: lecture.notes ?? '' })
  }

  const handleSaveLecture = async () => {
    if (!editingLecture) return
    await fetch(`/api/lectures/${editingLecture}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    setEditingLecture(null)
    loadCourse()
  }

  if (!course) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-100">
        <div className="w-6 h-6 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    )
  }

  const selectedMaterials = allMaterials.filter((m) => selectedIds.includes(m.id))

  return (
    <div className="flex flex-col h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 shrink-0 shadow-sm z-10">
        <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-sm shrink-0">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <h1 className="text-base font-bold text-slate-800 truncate">{course.name}</h1>
          {course.year !== null && course.semester && (
            <span className="text-xs text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full font-medium shrink-0">{course.year}年 {course.semester}</span>
          )}
          {course.year === null && (
            <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium shrink-0">共通科目</span>
          )}
          {course.day !== null && course.period !== null && (
            <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-medium shrink-0">{DAYS[course.day]}曜 {course.period}限</span>
          )}
        </div>
        <nav className="ml-auto flex gap-1 shrink-0">
          <a href="/" className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-sm font-medium rounded-lg">講義資料</a>
          <a href="/expense" className="px-3 py-1.5 text-slate-500 text-sm font-medium rounded-lg hover:bg-slate-100 transition-colors">経費精算</a>
        </nav>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: lecture tree */}
        <aside className="w-72 bg-white border-r border-slate-200 shrink-0 flex flex-col overflow-hidden">
          {/* Add lecture button */}
          <div className="px-4 py-3 border-b border-slate-100 shrink-0">
            {addingLecture ? (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="例：第1回"
                  value={newLecture.title}
                  onChange={(e) => setNewLecture((v) => ({ ...v, title: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddLecture()}
                  autoFocus
                />
                <input
                  type="date"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-slate-600"
                  value={newLecture.date}
                  onChange={(e) => setNewLecture((v) => ({ ...v, date: e.target.value }))}
                />
                <div className="flex gap-2">
                  <button onClick={handleAddLecture} className="flex-1 text-xs bg-indigo-600 text-white rounded-lg py-1.5 hover:bg-indigo-700">追加</button>
                  <button onClick={() => setAddingLecture(false)} className="flex-1 text-xs bg-slate-100 text-slate-600 rounded-lg py-1.5 hover:bg-slate-200">キャンセル</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingLecture(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-indigo-200 text-indigo-500 hover:border-indigo-400 hover:bg-indigo-50 transition-all text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                授業回を追加
              </button>
            )}
          </div>

          {/* Lecture list */}
          <div className="flex-1 overflow-y-auto">
            {course.lectures.length === 0 && (course.materials ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <p className="text-sm text-slate-400">まだ資料がありません</p>
                <p className="text-xs text-slate-300 mt-1">授業回を追加してアップロード</p>
              </div>
            ) : (
              <div className="py-2">
                {/* Lectures */}
                {course.lectures.map((lecture) => {
                  const isCollapsed = collapsed[lecture.id]
                  const isEditing = editingLecture === lecture.id
                  return (
                    <div key={lecture.id} className="mb-1">
                      {/* Lecture header */}
                      {isEditing ? (
                        <div className="px-3 py-2 flex flex-col gap-1.5">
                          <input type="text" value={editForm.title} onChange={(e) => setEditForm((v) => ({ ...v, title: e.target.value }))}
                            className="text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-300 w-full" />
                          <input type="date" value={editForm.date} onChange={(e) => setEditForm((v) => ({ ...v, date: e.target.value }))}
                            className="text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-300 w-full text-slate-600" />
                          <input type="text" value={editForm.instructor} onChange={(e) => setEditForm((v) => ({ ...v, instructor: e.target.value }))}
                            placeholder="担当教員（任意）"
                            className="text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-300 w-full" />
                          <textarea value={editForm.notes} onChange={(e) => setEditForm((v) => ({ ...v, notes: e.target.value }))}
                            placeholder="メモ（任意）" rows={2}
                            className="text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-300 w-full resize-none" />
                          <div className="flex gap-1">
                            <button onClick={handleSaveLecture} className="flex-1 text-xs bg-indigo-600 text-white rounded py-1 hover:bg-indigo-700">保存</button>
                            <button onClick={() => setEditingLecture(null)} className="flex-1 text-xs bg-slate-100 text-slate-600 rounded py-1 hover:bg-slate-200">キャンセル</button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="flex items-center gap-1 px-3 py-2 cursor-pointer hover:bg-slate-50 group"
                          onClick={() => setCollapsed((c) => ({ ...c, [lecture.id]: !c[lecture.id] }))}
                        >
                          <svg className={`w-3 h-3 text-slate-400 transition-transform shrink-0 ${isCollapsed ? '-rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                            <path d="M5 8l5 5 5-5H5z" />
                          </svg>
                          <span className="text-xs font-semibold text-slate-700 flex-1 truncate">{lecture.title}</span>
                          {lecture.date && <span className="text-[10px] text-slate-400 shrink-0">{formatDate(lecture.date)}</span>}
                          <span className="text-[10px] text-slate-300 shrink-0 ml-1">{lecture.materials.length}</span>
                          <button onClick={(e) => startEditLecture(lecture, e)} className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-indigo-500 shrink-0">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                          {lecture.title !== '未分類' && (
                            <button onClick={(e) => handleDeleteLecture(lecture.id, e)} className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center text-slate-300 hover:text-red-400 shrink-0">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Materials under lecture */}
                      {!isCollapsed && !isEditing && (
                        <div className="pl-5 pr-3 pb-1">
                          {/* Upload area for this lecture */}
                          <div
                            onDragOver={(e) => { e.preventDefault(); setDragOverLecture(lecture.id) }}
                            onDragLeave={() => setDragOverLecture(null)}
                            onDrop={(e) => handleDrop(e, lecture.id)}
                            onClick={() => !uploading && fileRefs.current[lecture.id]?.click()}
                            className={`mb-1 border border-dashed rounded-lg py-1.5 text-center cursor-pointer transition-all text-xs ${
                              dragOverLecture === lecture.id ? 'border-indigo-400 bg-indigo-50 text-indigo-500' :
                              uploading === lecture.id ? 'border-slate-200 text-slate-400' :
                              'border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-400'
                            }`}
                          >
                            <input ref={(el) => { fileRefs.current[lecture.id] = el }} type="file" accept=".pdf,.txt,.md" onChange={(e) => handleFileChange(e, lecture.id)} className="hidden" />
                            {uploading === lecture.id ? '処理中...' : '+ アップロード'}
                          </div>

                          {/* Material items */}
                          {lecture.materials.map((m) => {
                            const isSelected = selectedIds.includes(m.id)
                            return (
                              <div key={m.id} onClick={() => toggleSelect(m.id)}
                                className={`group flex items-center gap-2 px-2 py-2 rounded-lg border cursor-pointer transition-all mb-1 ${
                                  isSelected ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50'
                                }`}
                              >
                                <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                                  {isSelected && <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                </div>
                                <span className="text-xs shrink-0">{fileTypeIcon(m.fileType)}</span>
                                <p className={`text-xs flex-1 truncate ${isSelected ? 'text-indigo-800 font-medium' : 'text-slate-700'}`}>{m.title}</p>
                                <button onClick={(e) => handleDeleteMaterial(m.id, e)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all shrink-0">
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Unassigned materials (lectureId null) */}
                {(course.materials ?? []).length > 0 && (
                  <div className="mb-1">
                    <div className="flex items-center gap-1 px-3 py-2">
                      <span className="text-xs font-semibold text-slate-400">授業回未割り当て</span>
                    </div>
                    <div className="pl-5 pr-3">
                      {course.materials.map((m) => {
                        const isSelected = selectedIds.includes(m.id)
                        return (
                          <div key={m.id} onClick={() => toggleSelect(m.id)}
                            className={`group flex items-center gap-2 px-2 py-2 rounded-lg border cursor-pointer transition-all mb-1 ${
                              isSelected ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50'
                            }`}
                          >
                            <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                              {isSelected && <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <span className="text-xs shrink-0">{fileTypeIcon(m.fileType)}</span>
                            <p className={`text-xs flex-1 truncate ${isSelected ? 'text-indigo-800 font-medium' : 'text-slate-700'}`}>{m.title}</p>
                            <button onClick={(e) => handleDeleteMaterial(m.id, e)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all shrink-0">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Right: workspace */}
        <main className="flex-1 overflow-auto">
          {selectedIds.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-16 h-16 bg-white rounded-2xl border border-slate-200 flex items-center justify-center mb-4 shadow-sm">
                <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-slate-400 text-sm font-medium">資料を選択してください</p>
              <p className="text-slate-300 text-xs mt-1">左のリストから資料を選ぶと、<br />AI要約・復習問題・Q&Aが使えます</p>
            </div>
          ) : selectedIds.length === 1 ? (
            <div className="h-full"><MaterialDetail key={selectedIds[0]} materialId={selectedIds[0]} /></div>
          ) : (
            <div className="h-full"><MultiWorkspace key={selectedIds.join(',')} materialIds={selectedIds} selectedMaterials={selectedMaterials} /></div>
          )}
        </main>
      </div>
    </div>
  )
}
