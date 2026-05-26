'use client'

import { useState, useRef } from 'react'
import MaterialDetail from './MaterialDetail'

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
  course: Course
  onClose: () => void
  onMaterialUploaded: () => void
  onMaterialDeleted: () => void
}

const DAYS = ['月', '火', '水', '木', '金']

function fileTypeIcon(type: string) {
  if (type.includes('pdf')) return '📄'
  if (type.includes('text')) return '📝'
  return '📁'
}

export default function CoursePanel({ course, onClose, onMaterialUploaded, onMaterialDeleted }: Props) {
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const uploadFile = async (file: File) => {
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    form.append('courseId', course.id)
    form.append('title', file.name)
    await fetch('/api/materials', { method: 'POST', body: form })
    setUploading(false)
    onMaterialUploaded()
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

  const handleDeleteMaterial = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('この資料を削除しますか？')) return
    await fetch(`/api/materials/${id}`, { method: 'DELETE' })
    if (selectedMaterialId === id) setSelectedMaterialId(null)
    onMaterialDeleted()
  }

  // Material detail view
  if (selectedMaterialId) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 shrink-0 bg-white">
          <button
            onClick={() => setSelectedMaterialId(null)}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm text-slate-500 truncate">{course.name}</span>
          <button
            onClick={onClose}
            className="ml-auto w-7 h-7 flex items-center justify-center text-slate-300 hover:text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <MaterialDetail materialId={selectedMaterialId} />
        </div>
      </div>
    )
  }

  // Material list view
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 shrink-0 bg-white">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-800 truncate">{course.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                {course.year !== null && course.semester && (
                  <span className="text-xs text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full font-medium">
                    {course.year}年 {course.semester}
                  </span>
                )}
                {course.year === null && (
                  <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                    共通科目
                  </span>
                )}
                {course.day !== null && course.period !== null && (
                  <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-medium">
                    {DAYS[course.day]}曜 {course.period}限
                  </span>
                )}
              </div>
              {course.description && (
                <span className="text-xs text-slate-400 truncate">{course.description}</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-2 w-7 h-7 flex items-center justify-center text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

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
          <div className="px-4 py-3 space-y-2">
            <p className="text-xs text-slate-400 font-medium mb-2">{course.materials.length}件の資料</p>
            {course.materials.map((m) => (
              <div
                key={m.id}
                onClick={() => setSelectedMaterialId(m.id)}
                className="group flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-slate-200 cursor-pointer hover:border-indigo-200 hover:shadow-sm transition-all"
              >
                <span className="text-lg shrink-0">{fileTypeIcon(m.fileType)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{m.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(m.createdAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => handleDeleteMaterial(m.id, e)}
                    className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center text-slate-300 hover:text-red-400 transition-all rounded-lg hover:bg-red-50"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <svg className="w-4 h-4 text-slate-200 group-hover:text-slate-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
