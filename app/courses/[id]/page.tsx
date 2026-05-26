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

const DAYS = ['月', '火', '水', '木', '金']

function fileTypeIcon(type: string) {
  if (type.includes('pdf')) return '📄'
  if (type.includes('text')) return '📝'
  return '📁'
}

export default function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [course, setCourse] = useState<Course | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadCourse = useCallback(async () => {
    const res = await fetch(`/api/courses/${id}`)
    if (res.ok) setCourse(await res.json())
  }, [id])

  useEffect(() => {
    loadCourse()
  }, [loadCourse])

  const toggleSelect = (materialId: string) => {
    setSelectedIds((prev) =>
      prev.includes(materialId) ? prev.filter((x) => x !== materialId) : [...prev, materialId]
    )
  }

  const selectAll = () => {
    if (!course) return
    setSelectedIds(course.materials.map((m) => m.id))
  }

  const clearAll = () => setSelectedIds([])

  const allSelected =
    !!course && course.materials.length > 0 && selectedIds.length === course.materials.length

  const uploadFile = async (file: File) => {
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    form.append('courseId', id)
    form.append('title', file.name)
    await fetch('/api/materials', { method: 'POST', body: form })
    setUploading(false)
    loadCourse()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await uploadFile(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) await uploadFile(file)
  }

  const handleDeleteMaterial = async (materialId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('この資料を削除しますか？')) return
    await fetch(`/api/materials/${materialId}`, { method: 'DELETE' })
    setSelectedIds((prev) => prev.filter((x) => x !== materialId))
    loadCourse()
  }

  if (!course) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-100">
        <div className="w-6 h-6 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    )
  }

  const selectedMaterials = course.materials.filter((m) => selectedIds.includes(m.id))

  return (
    <div className="flex flex-col h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 shrink-0 shadow-sm z-10">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
          title="時間割に戻る"
        >
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
            <span className="text-xs text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full font-medium shrink-0">
              {course.year}年 {course.semester}
            </span>
          )}
          {course.year === null && (
            <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium shrink-0">
              共通科目
            </span>
          )}
          {course.day !== null && course.period !== null && (
            <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-medium shrink-0">
              {DAYS[course.day]}曜 {course.period}限
            </span>
          )}
          {course.description && (
            <span className="text-xs text-slate-400 truncate">{course.description}</span>
          )}
        </div>

        <nav className="ml-auto flex gap-1 shrink-0">
          <a href="/" className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-sm font-medium rounded-lg">
            講義資料
          </a>
          <a href="/expense" className="px-3 py-1.5 text-slate-500 text-sm font-medium rounded-lg hover:bg-slate-100 transition-colors">
            経費精算
          </a>
        </nav>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: material list + upload */}
        <aside className="w-72 bg-white border-r border-slate-200 shrink-0 flex flex-col overflow-hidden">
          {/* Upload area */}
          <div className="px-4 py-3 border-b border-slate-100 shrink-0 bg-slate-50">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !uploading && fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl py-4 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-indigo-400 bg-indigo-50'
                  : uploading
                  ? 'border-slate-200 bg-white'
                  : 'border-slate-300 bg-white hover:border-indigo-300 hover:bg-indigo-50'
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.txt,.md"
                onChange={handleFileChange}
                className="hidden"
              />
              {uploading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                  <span className="text-sm text-slate-500">アップロード中...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="text-sm font-medium text-indigo-500">資料をアップロード</span>
                  <span className="text-xs text-slate-400">PDF / TXT</span>
                </div>
              )}
            </div>
          </div>

          {/* Select all / clear controls */}
          {course.materials.length > 0 && (
            <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <span className="text-xs text-slate-400">
                {selectedIds.length > 0 ? (
                  <span className="text-indigo-600 font-semibold">{selectedIds.length}件選択中</span>
                ) : (
                  '資料を選択'
                )}
              </span>
              <button
                onClick={allSelected ? clearAll : selectAll}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
              >
                {allSelected ? '全解除' : '全選択'}
              </button>
            </div>
          )}

          {/* Material list */}
          <div className="flex-1 overflow-y-auto bg-slate-50">
            {course.materials.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-12 h-12 bg-white rounded-xl border border-slate-200 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-sm text-slate-400">まだ資料がありません</p>
                <p className="text-xs text-slate-300 mt-1">上のエリアからアップロード</p>
              </div>
            ) : (
              <div className="px-3 py-3 space-y-1.5">
                {course.materials.map((m) => {
                  const isSelected = selectedIds.includes(m.id)
                  return (
                    <div
                      key={m.id}
                      onClick={() => toggleSelect(m.id)}
                      className={`group flex items-center gap-3 px-3 py-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-50 border-indigo-300 shadow-sm'
                          : 'bg-white border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/50'
                      }`}
                    >
                      {/* Checkbox */}
                      <div
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600'
                            : 'border-slate-300 group-hover:border-indigo-400'
                        }`}
                      >
                        {isSelected && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>

                      <span className="text-base shrink-0">{fileTypeIcon(m.fileType)}</span>

                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isSelected ? 'text-indigo-800' : 'text-slate-700'}`}>
                          {m.title}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(m.createdAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>

                      <button
                        onClick={(e) => handleDeleteMaterial(m.id, e)}
                        className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center text-slate-300 hover:text-red-400 transition-all rounded-lg hover:bg-red-50 shrink-0"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )
                })}
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
              <p className="text-slate-300 text-xs mt-1">
                左のリストから資料を選ぶと、<br />AI要約・復習問題・Q&Aが使えます
              </p>
              <p className="text-slate-300 text-xs mt-3">
                複数選択すると資料を統合して<br />問題生成やQ&Aができます
              </p>
            </div>
          ) : selectedIds.length === 1 ? (
            <div className="h-full">
              <MaterialDetail key={selectedIds[0]} materialId={selectedIds[0]} />
            </div>
          ) : (
            <div className="h-full">
              <MultiWorkspace
                key={selectedIds.join(',')}
                materialIds={selectedIds}
                selectedMaterials={selectedMaterials}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
