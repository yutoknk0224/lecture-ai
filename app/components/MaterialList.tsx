'use client'

import { useState, useRef } from 'react'

type MaterialSummary = {
  id: string
  title: string
  fileType: string
  createdAt: string
}

type Props = {
  courseId: string
  materials: MaterialSummary[]
  selectedMaterialId: string | null
  onSelectMaterial: (id: string) => void
  onMaterialUploaded: () => void
  onMaterialDeleted: () => void
}

function fileTypeLabel(type: string) {
  if (type.includes('pdf')) return 'PDF'
  if (type.includes('text')) return 'TXT'
  return type.split('/')[1]?.toUpperCase() || 'FILE'
}

function fileTypeStyle(type: string) {
  if (type.includes('pdf')) return { bg: 'bg-red-50', text: 'text-red-600', icon: '📄' }
  if (type.includes('text')) return { bg: 'bg-blue-50', text: 'text-blue-600', icon: '📝' }
  return { bg: 'bg-slate-100', text: 'text-slate-600', icon: '📁' }
}

export default function MaterialList({
  courseId,
  materials,
  selectedMaterialId,
  onSelectMaterial,
  onMaterialUploaded,
  onMaterialDeleted,
}: Props) {
  const [uploading, setUploading] = useState(false)
  const [title, setTitle] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [showTitleInput, setShowTitleInput] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const uploadFile = async (file: File) => {
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    form.append('courseId', courseId)
    form.append('title', title || file.name)
    await fetch('/api/materials', { method: 'POST', body: form })
    setTitle('')
    setShowTitleInput(false)
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

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('この資料を削除しますか？')) return
    await fetch(`/api/materials/${id}`, { method: 'DELETE' })
    onMaterialDeleted()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b border-slate-200">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">資料一覧</h3>
      </div>

      {/* Upload area */}
      <div className="px-3 pt-3 pb-2">
        {showTitleInput && (
          <input
            type="text"
            placeholder="資料タイトル（省略するとファイル名になります）"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          />
        )}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer ${
            dragOver
              ? 'border-indigo-400 bg-indigo-50'
              : uploading
              ? 'border-slate-200 bg-slate-50'
              : 'border-slate-300 bg-white hover:border-indigo-300 hover:bg-indigo-50'
          }`}
          onClick={() => !uploading && fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.txt,.md"
            onChange={handleFileChange}
            className="hidden"
            id={`file-upload-${courseId}`}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
              <p className="text-sm text-slate-500 font-medium">アップロード中...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-indigo-600">クリックまたはドロップ</p>
                <p className="text-xs text-slate-400 mt-0.5">PDF · TXT · MD</p>
              </div>
            </div>
          )}
        </div>
        <button
          onClick={() => setShowTitleInput(!showTitleInput)}
          className="mt-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors w-full text-center"
        >
          {showTitleInput ? '▲ タイトル入力を隠す' : '▼ タイトルを指定する（任意）'}
        </button>
      </div>

      {/* Material list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5">
        {materials.length === 0 && (
          <div className="text-center py-8">
            <p className="text-xs text-slate-400">資料をアップロードしてください</p>
          </div>
        )}
        {materials.map((m) => {
          const style = fileTypeStyle(m.fileType)
          const isSelected = selectedMaterialId === m.id
          return (
            <div
              key={m.id}
              onClick={() => onSelectMaterial(m.id)}
              className={`group flex items-start gap-3 px-3 py-3 rounded-xl cursor-pointer border transition-all ${
                isSelected
                  ? 'bg-indigo-50 border-indigo-200 shadow-sm'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              <div className={`w-9 h-9 ${style.bg} rounded-lg flex items-center justify-center shrink-0 text-base`}>
                {style.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate leading-snug ${isSelected ? 'text-indigo-700' : 'text-slate-700'}`}>
                  {m.title}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs font-medium ${style.text}`}>
                    {fileTypeLabel(m.fileType)}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(m.createdAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
              <button
                onClick={(e) => handleDelete(m.id, e)}
                className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center text-slate-300 hover:text-red-400 transition-all rounded-md hover:bg-red-50 shrink-0"
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
