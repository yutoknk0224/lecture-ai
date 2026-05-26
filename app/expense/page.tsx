'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DeadlineCalendar from './components/DeadlineCalendar'

type Item = { id: string; amount: number }
type EquipmentItem = { id: string; amount: number }
type Folder = { id: string; name: string; color: string }
type CalendarNote = { id: string; date: string; content: string; color: string }
type Report = {
  id: string
  title: string
  period: string
  status: string
  reportType: string
  dueDate: string | null
  createdAt: string
  folderId: string | null
  items: Item[]
  equipmentItems: EquipmentItem[]
}

const PRESET_COLORS = [
  '#6366f1', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
]

function dueBadge(dueDate: string | null) {
  if (!dueDate) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate); due.setHours(0, 0, 0, 0)
  const diff = Math.ceil((due.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return <span className="text-[9px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full font-medium whitespace-nowrap">{Math.abs(diff)}日超過</span>
  if (diff === 0) return <span className="text-[9px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full font-medium whitespace-nowrap">今日</span>
  if (diff <= 3) return <span className="text-[9px] px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded-full font-medium whitespace-nowrap">あと{diff}日</span>
  return <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full whitespace-nowrap">{dueDate.slice(5).replace('-', '/')}</span>
}

function statusBadge(status: string) {
  if (status === 'submitted') return <span className="text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">提出済み</span>
  return <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full">下書き</span>
}

function typeBadge(reportType: string) {
  if (reportType === 'equipment')
    return <span className="text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium whitespace-nowrap">備品購入</span>
  return <span className="text-[9px] px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded-full font-medium whitespace-nowrap">旅費精算</span>
}

function ReportCard({ report, onClick, onMoveClick }: {
  report: Report
  onClick: () => void
  onMoveClick: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const total = report.reportType === 'equipment'
    ? report.equipmentItems.reduce((s, i) => s + i.amount, 0)
    : report.items.reduce((s, i) => s + i.amount, 0)
  const itemCount = report.reportType === 'equipment' ? report.equipmentItems.length : report.items.length

  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className="w-full text-left p-4 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-xl transition-all shadow-sm hover:shadow"
      >
        <div className="flex items-center gap-1 mb-2.5">
          <svg className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <div className="flex items-center gap-1 ml-auto flex-wrap justify-end">
            {typeBadge(report.reportType)}
            {statusBadge(report.status)}
            {dueBadge(report.dueDate)}
          </div>
        </div>
        <p className="text-sm font-semibold text-slate-700 group-hover:text-indigo-700 truncate leading-snug transition-colors">{report.title}</p>
        <p className="text-xs text-slate-400 mt-0.5 truncate">{report.period}</p>
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
          <span className="text-[11px] text-slate-400">{itemCount}件</span>
          <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-700 transition-colors">
            {total === 0 ? <span className="text-slate-300 font-normal text-xs">未入力</span> : `¥${total.toLocaleString()}`}
          </span>
        </div>
      </button>

      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <div className="relative">
          <button
            onClick={e => { e.stopPropagation(); setMenuOpen(m => !m) }}
            className="w-6 h-6 rounded-md bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center shadow-sm"
          >
            <svg className="w-3.5 h-3.5 text-slate-500" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
            </svg>
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-7 bg-white border border-slate-200 rounded-lg shadow-lg z-20 w-40 py-1">
                <button
                  onClick={e => { e.stopPropagation(); setMenuOpen(false); onMoveClick() }}
                  className="w-full text-left text-xs px-3 py-2 hover:bg-slate-50 text-slate-700 flex items-center gap-2"
                >
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
                  </svg>
                  移動 / 複製
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function FolderCard({ folder, isOpen, reports, onToggle, onEdit, onAddReport }: {
  folder: Folder
  isOpen: boolean
  reports: Report[]
  onToggle: () => void
  onEdit?: () => void
  onAddReport: () => void
}) {
  const total = reports.reduce((s, r) =>
    s + r.items.reduce((ss, i) => ss + i.amount, 0)
      + r.equipmentItems.reduce((ss, i) => ss + i.amount, 0), 0)
  const hasDue = reports.some(r => {
    if (!r.dueDate) return false
    const d = new Date(r.dueDate); d.setHours(0, 0, 0, 0)
    return Math.ceil((d.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000) <= 3
  })

  return (
    <div className={`relative bg-white rounded-2xl shadow-sm overflow-hidden transition-all hover:shadow-md border-2 ${
      isOpen ? '' : 'border-transparent hover:border-slate-200'
    }`} style={isOpen ? { borderColor: folder.color } : {}}>
      {/* カラーストライプ */}
      <div className="h-1.5" style={{ backgroundColor: folder.color }} />

      <button onClick={onToggle} className="w-full p-4 text-left">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: isOpen ? folder.color : `${folder.color}22` }}
          >
            <svg className="w-5 h-5" style={{ color: isOpen ? 'white' : folder.color }} fill="currentColor" viewBox="0 0 24 24">
              {isOpen
                ? <path d="M2.5 6A2.5 2.5 0 015 3.5h4.379a2.5 2.5 0 011.767.732L12.5 5.5H19A2.5 2.5 0 0121.5 8v9A2.5 2.5 0 0119 19.5H5A2.5 2.5 0 012.5 17V6z"/>
                : <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
              }
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-slate-800 text-sm truncate">{folder.name}</h3>
              {hasDue && <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0"/>}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{reports.length}件のレポート</p>
          </div>
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <span className="text-xs text-slate-400">合計金額</span>
          <span className="text-base font-bold text-slate-700">
            {total === 0
              ? <span className="text-slate-300 font-normal text-xs">—</span>
              : `¥${total.toLocaleString()}`}
          </span>
        </div>
      </button>

      {/* アクションボタン */}
      <div className="absolute top-4 right-4 flex gap-1">
        <button
          onClick={e => { e.stopPropagation(); onAddReport() }}
          className="w-6 h-6 rounded-lg bg-white/90 hover:bg-slate-100 border border-slate-200 flex items-center justify-center transition-colors shadow-sm"
          title="レポートを追加"
        >
          <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
          </svg>
        </button>
        {onEdit && (
          <button
            onClick={e => { e.stopPropagation(); onEdit() }}
            className="w-6 h-6 rounded-lg bg-white/90 hover:bg-slate-100 border border-slate-200 flex items-center justify-center transition-colors shadow-sm"
            title="フォルダを編集"
          >
            <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

export default function ExpensePage() {
  const router = useRouter()
  const [reports, setReports] = useState<Report[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [calendarNotes, setCalendarNotes] = useState<CalendarNote[]>([])
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set(['__uncategorized__']))
  const [searchQuery, setSearchQuery] = useState('')

  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [folderColor, setFolderColor] = useState('#6366f1')
  const [creatingFolder, setCreatingFolder] = useState(false)

  const [showCreateReport, setShowCreateReport] = useState(false)
  const [createReportFolderId, setCreateReportFolderId] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newPeriod, setNewPeriod] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [newReportType, setNewReportType] = useState<'travel' | 'equipment'>('travel')
  const [creatingReport, setCreatingReport] = useState(false)

  const [moveTarget, setMoveTarget] = useState<Report | null>(null)
  const [moveAction, setMoveAction] = useState<'move' | 'copy'>('move')
  const [moveFolderId, setMoveFolderId] = useState<string | null>(null)
  const [movingReport, setMovingReport] = useState(false)

  const [editingFolder, setEditingFolder] = useState<Folder | null>(null)
  const [editFolderName, setEditFolderName] = useState('')
  const [editFolderColor, setEditFolderColor] = useState('#6366f1')

  // カレンダーメモ
  const [noteDate, setNoteDate] = useState<string | null>(null)
  const [noteInput, setNoteInput] = useState('')
  const [noteColor, setNoteColor] = useState('#6366f1')
  const [noteSaving, setNoteSaving] = useState(false)
  const [editNoteId, setEditNoteId] = useState<string | null>(null)
  const [editNoteContent, setEditNoteContent] = useState('')

  const loadAll = useCallback(async () => {
    const [rRes, fRes, nRes] = await Promise.all([
      fetch('/api/expense/reports'),
      fetch('/api/expense/folders'),
      fetch('/api/expense/calendar-notes'),
    ])
    const rData = rRes.ok ? await rRes.json() : []
    const fData = fRes.ok ? await fRes.json() : []
    const nData = nRes.ok ? await nRes.json() : []
    setReports(rData)
    setFolders(fData)
    setCalendarNotes(nData)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  useEffect(() => {
    if (!('Notification' in window) || reports.length === 0) return
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const urgent = reports.filter(r => {
      if (!r.dueDate) return false
      const due = new Date(r.dueDate); due.setHours(0, 0, 0, 0)
      return Math.ceil((due.getTime() - today.getTime()) / 86400000) <= 3
    })
    if (urgent.length === 0) return
    if (Notification.permission === 'granted') {
      new Notification('経費精算リマインダー', {
        body: urgent.map(r => {
          const due = new Date(r.dueDate!); due.setHours(0, 0, 0, 0)
          const diff = Math.ceil((due.getTime() - today.getTime()) / 86400000)
          return `「${r.title}」${diff === 0 ? '（今日が期日）' : diff < 0 ? `${Math.abs(diff)}日超過` : `あと${diff}日`}`
        }).join('\n'),
        icon: '/favicon.ico',
      })
    } else if (Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [reports])

  const handleCreateFolder = async () => {
    if (!folderName.trim()) return
    setCreatingFolder(true)
    await fetch('/api/expense/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: folderName, color: folderColor }),
    })
    setFolderName(''); setFolderColor('#6366f1'); setShowCreateFolder(false); setCreatingFolder(false)
    loadAll()
  }

  const handleCreateReport = async () => {
    if (!newTitle.trim() || !newPeriod.trim()) return
    setCreatingReport(true)
    const res = await fetch('/api/expense/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle, period: newPeriod, dueDate: newDueDate || null, folderId: createReportFolderId, reportType: newReportType }),
    })
    const created: Report = await res.json()
    setShowCreateReport(false); setNewTitle(''); setNewPeriod(''); setNewDueDate(''); setNewReportType('travel'); setCreatingReport(false)
    router.push(`/expense/reports/${created.id}`)
  }

  const handleMove = async () => {
    if (!moveTarget) return
    setMovingReport(true)
    await fetch(`/api/expense/reports/${moveTarget.id}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: moveAction, targetFolderId: moveFolderId }),
    })
    setMoveTarget(null); setMovingReport(false)
    loadAll()
  }

  const handleSaveFolder = async () => {
    if (!editingFolder || !editFolderName.trim()) return
    await fetch(`/api/expense/folders/${editingFolder.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editFolderName, color: editFolderColor }),
    })
    setEditingFolder(null); loadAll()
  }

  const handleAddNote = async () => {
    if (!noteDate || !noteInput.trim()) return
    setNoteSaving(true)
    const res = await fetch('/api/expense/calendar-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: noteDate, content: noteInput.trim(), color: noteColor }),
    })
    if (res.ok) {
      const created: CalendarNote = await res.json()
      setCalendarNotes(prev => [...prev, created])
      setNoteInput('')
    }
    setNoteSaving(false)
  }

  const handleDeleteNote = async (id: string) => {
    await fetch(`/api/expense/calendar-notes/${id}`, { method: 'DELETE' })
    setCalendarNotes(prev => prev.filter(n => n.id !== id))
  }

  const handleSaveNoteEdit = async (id: string) => {
    if (!editNoteContent.trim()) return
    const res = await fetch(`/api/expense/calendar-notes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editNoteContent.trim() }),
    })
    if (res.ok) {
      const updated: CalendarNote = await res.json()
      setCalendarNotes(prev => prev.map(n => n.id === id ? updated : n))
      setEditNoteId(null)
    }
  }

  const handleDeleteFolder = async (folder: Folder) => {
    if (!confirm(`「${folder.name}」を削除しますか？\n（フォルダ内のレポートは未分類に移動されます）`)) return
    await fetch(`/api/expense/folders/${folder.id}`, { method: 'DELETE' })
    setEditingFolder(null); loadAll()
  }

  const toggleFolder = (key: string) => {
    setOpenFolders(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  const openFolderAndCreate = (folderId: string | null) => {
    if (folderId) {
      setOpenFolders(prev => { const next = new Set(prev); next.add(folderId); return next })
    }
    setCreateReportFolderId(folderId)
    setNewTitle('')
    setNewPeriod('')
    setNewDueDate('')
    setNewReportType('travel')
    setShowCreateReport(true)
  }

  const folderMap = new Map(folders.map(f => [f.id, f]))
  const reportsByFolder = new Map<string | null, Report[]>()
  reportsByFolder.set(null, [])
  for (const f of folders) reportsByFolder.set(f.id, [])
  for (const r of reports) {
    const key = r.folderId && reportsByFolder.has(r.folderId) ? r.folderId : null
    reportsByFolder.get(key)!.push(r)
  }

  const filteredReports = searchQuery.trim()
    ? reports.filter(r =>
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) || r.period.includes(searchQuery)
      )
    : null

  const uncatReports = reportsByFolder.get(null) ?? []
  const UNCAT_FOLDER: Folder = { id: '__uncategorized__', name: '未分類', color: '#64748b' }

  // 開いているフォルダのレポートを取得
  const openFolderSections = [...openFolders].map(key => {
    const folder = key === '__uncategorized__' ? UNCAT_FOLDER : folders.find(f => f.id === key)
    if (!folder) return null
    const reps = key === '__uncategorized__' ? uncatReports : (reportsByFolder.get(key) ?? [])
    return { folder, reports: reps }
  }).filter(Boolean) as { folder: Folder; reports: Report[] }[]

  return (
    <div className="flex flex-col h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center shrink-0">
          <span className="text-white text-sm font-bold">¥</span>
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-800 leading-tight">経費精算 AI</h1>
          <p className="text-[11px] text-slate-400 leading-tight">期日管理・Excel出力対応</p>
        </div>
        <nav className="ml-auto flex items-center gap-4 text-sm text-slate-500">
          <a href="/" className="hover:text-indigo-600 transition-colors">講義資料管理</a>
          <span className="text-emerald-600 font-semibold">経費精算</span>
          <a href="/expense/templates" className="hover:text-emerald-600 transition-colors">テンプレート管理</a>
        </nav>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-6xl mx-auto space-y-5">

          {/* カレンダー（上部・大きめ） */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <DeadlineCalendar
              reports={reports}
              folders={folders}
              notes={calendarNotes}
              selectedId={null}
              onSelect={(id) => router.push(`/expense/reports/${id}`)}
              onDateClick={(dateStr) => { setNoteDate(dateStr); setNoteInput(''); setEditNoteId(null) }}
            />
          </div>

          {/* ツールバー */}
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-bold text-slate-800">精算レポート</h2>
              <p className="text-xs text-slate-400 mt-0.5">フォルダで整理</p>
            </div>
            <span className="text-xs text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-full shadow-sm">{reports.length}件</span>
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              <div className="relative">
                <svg className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <input
                  type="text"
                  placeholder="タイトル・期間で検索..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 w-52 shadow-sm"
                />
              </div>
              <button
                onClick={() => setShowCreateFolder(true)}
                className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-600 text-sm px-3 py-1.5 rounded-lg hover:bg-slate-50 shadow-sm transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                </svg>
                フォルダ作成
              </button>
              <button
                onClick={() => openFolderAndCreate(null)}
                className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-indigo-700 shadow-sm transition-colors font-semibold"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                </svg>
                新規レポート
              </button>
            </div>
          </div>

          {/* 検索結果 */}
          {filteredReports !== null ? (
            <div>
              <p className="text-xs text-slate-500 mb-3">「{searchQuery}」の検索結果（{filteredReports.length}件）</p>
              {filteredReports.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-12">一致するレポートが見つかりません</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredReports.map(r => (
                    <ReportCard
                      key={r.id}
                      report={r}
                      onClick={() => router.push(`/expense/reports/${r.id}`)}
                      onMoveClick={() => { setMoveTarget(r); setMoveFolderId(r.folderId); setMoveAction('move') }}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : folders.length === 0 && reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-20 h-20 bg-white rounded-3xl border border-slate-200 flex items-center justify-center mb-5 shadow-sm">
                <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
                </svg>
              </div>
              <p className="text-slate-600 font-semibold text-base">フォルダがありません</p>
              <p className="text-sm text-slate-400 mt-1 mb-5">「フォルダ作成」ボタンから始めましょう</p>
              <button
                onClick={() => setShowCreateFolder(true)}
                className="flex items-center gap-2 bg-indigo-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                </svg>
                最初のフォルダを作成
              </button>
            </div>
          ) : (
            <>
              {/* フォルダカードグリッド（3列） */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {folders.map(folder => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    isOpen={openFolders.has(folder.id)}
                    reports={reportsByFolder.get(folder.id) ?? []}
                    onToggle={() => toggleFolder(folder.id)}
                    onEdit={() => { setEditingFolder(folder); setEditFolderName(folder.name); setEditFolderColor(folder.color) }}
                    onAddReport={() => openFolderAndCreate(folder.id)}
                  />
                ))}
                {/* 未分類カード */}
                {(uncatReports.length > 0 || folders.length === 0) && (
                  <FolderCard
                    folder={UNCAT_FOLDER}
                    isOpen={openFolders.has('__uncategorized__')}
                    reports={uncatReports}
                    onToggle={() => toggleFolder('__uncategorized__')}
                    onAddReport={() => openFolderAndCreate(null)}
                  />
                )}
              </div>

              {/* 開いているフォルダのレポート一覧 */}
              {openFolderSections.map(({ folder, reports: folderReports }) => (
                <div key={folder.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div
                    className="flex items-center justify-between px-5 py-3 border-b"
                    style={{ borderColor: `${folder.color}30`, backgroundColor: `${folder.color}08` }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: folder.color }} />
                      <span className="font-bold text-slate-700 text-sm">{folder.name}</span>
                      <span className="text-xs text-slate-400">{folderReports.length}件</span>
                    </div>
                    <button
                      onClick={() => openFolderAndCreate(folder.id === '__uncategorized__' ? null : folder.id)}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium transition-colors text-white"
                      style={{ backgroundColor: folder.color }}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                      </svg>
                      レポートを追加
                    </button>
                  </div>
                  {folderReports.length === 0 ? (
                    <div className="py-10 text-center">
                      <p className="text-sm text-slate-400">レポートがありません</p>
                      <button
                        onClick={() => openFolderAndCreate(folder.id === '__uncategorized__' ? null : folder.id)}
                        className="mt-2 text-xs font-medium hover:underline"
                        style={{ color: folder.color }}
                      >
                        + レポートを追加する
                      </button>
                    </div>
                  ) : (
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {folderReports.map(r => (
                        <ReportCard
                          key={r.id}
                          report={r}
                          onClick={() => router.push(`/expense/reports/${r.id}`)}
                          onMoveClick={() => { setMoveTarget(r); setMoveFolderId(r.folderId); setMoveAction('move') }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

        </div>
      </main>

      {/* フォルダ作成モーダル */}
      {showCreateFolder && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: folderColor }}>
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2.5 6A2.5 2.5 0 015 3.5h4.379a2.5 2.5 0 011.767.732L12.5 5.5H19A2.5 2.5 0 0121.5 8v9A2.5 2.5 0 0119 19.5H5A2.5 2.5 0 012.5 17V6z"/>
                </svg>
              </div>
              <h3 className="text-base font-bold text-slate-800">新規フォルダ</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">フォルダ名 <span className="text-red-400">*</span></label>
                <input
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="例：2026年度出張費"
                  value={folderName}
                  onChange={e => setFolderName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && folderName.trim()) handleCreateFolder() }}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-2">カラー</label>
                <div className="flex gap-2 flex-wrap">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setFolderColor(c)}
                      className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${folderColor === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={handleCreateFolder}
                disabled={!folderName.trim() || creatingFolder}
                className="flex-1 text-white text-sm font-semibold py-2.5 rounded-xl disabled:opacity-40 transition-colors"
                style={{ backgroundColor: folderColor }}
              >
                {creatingFolder ? '作成中...' : '作成'}
              </button>
              <button
                onClick={() => { setShowCreateFolder(false); setFolderName(''); setFolderColor('#6366f1') }}
                className="flex-1 bg-slate-100 text-slate-600 text-sm py-2.5 rounded-xl hover:bg-slate-200 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* レポート作成モーダル */}
      {showCreateReport && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-2.5 mb-5">
              {createReportFolderId ? (
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: folderMap.get(createReportFolderId)?.color ?? '#6366f1' }}>
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                </div>
              ) : (
                <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                </div>
              )}
              <div>
                <h3 className="text-base font-bold text-slate-800">新規精算レポート</h3>
                {createReportFolderId && (
                  <p className="text-xs text-slate-400 mt-0.5">{folderMap.get(createReportFolderId)?.name} に追加</p>
                )}
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-2">レポートの種類 <span className="text-red-400">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setNewReportType('travel')}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${newReportType === 'travel' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-300'}`}
                  >
                    <svg className={`w-5 h-5 ${newReportType === 'travel' ? 'text-indigo-600' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span className={`text-xs font-semibold ${newReportType === 'travel' ? 'text-indigo-700' : 'text-slate-500'}`}>旅費精算</span>
                  </button>
                  <button
                    onClick={() => setNewReportType('equipment')}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${newReportType === 'equipment' ? 'border-amber-500 bg-amber-50' : 'border-slate-200 bg-white hover:border-amber-300'}`}
                  >
                    <svg className={`w-5 h-5 ${newReportType === 'equipment' ? 'text-amber-600' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10"/>
                    </svg>
                    <span className={`text-xs font-semibold ${newReportType === 'equipment' ? 'text-amber-700' : 'text-slate-500'}`}>備品購入</span>
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">タイトル <span className="text-red-400">*</span></label>
                <input
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder={newReportType === 'equipment' ? '例：2026年度 備品購入申請' : '例：2026年5月出張精算'}
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && newPeriod.trim()) handleCreateReport() }}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">対象期間 <span className="text-red-400">*</span></label>
                <input
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="例：2026年5月"
                  value={newPeriod}
                  onChange={e => setNewPeriod(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && newTitle.trim()) handleCreateReport() }}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">提出期日（任意）</label>
                <input
                  type="date"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  value={newDueDate}
                  onChange={e => setNewDueDate(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={handleCreateReport}
                disabled={!newTitle.trim() || !newPeriod.trim() || creatingReport}
                className="flex-1 bg-indigo-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors"
              >
                {creatingReport ? '作成中...' : '作成して開く'}
              </button>
              <button
                onClick={() => { setShowCreateReport(false); setNewTitle(''); setNewPeriod(''); setNewDueDate('') }}
                className="flex-1 bg-slate-100 text-slate-600 text-sm py-2.5 rounded-xl hover:bg-slate-200 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 移動・複製モーダル */}
      {moveTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-slate-800 mb-1">移動 / 複製</h3>
            <p className="text-xs text-slate-400 mb-4 truncate">「{moveTarget.title}」</p>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setMoveAction('move')}
                className={`flex-1 text-sm py-2 rounded-lg font-medium transition-colors ${moveAction === 'move' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                移動
              </button>
              <button
                onClick={() => setMoveAction('copy')}
                className={`flex-1 text-sm py-2 rounded-lg font-medium transition-colors ${moveAction === 'copy' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                複製して移動
              </button>
            </div>
            <p className="text-xs font-semibold text-slate-500 mb-2">移動先フォルダ</p>
            <div className="space-y-1 max-h-52 overflow-y-auto mb-4">
              <button
                onClick={() => setMoveFolderId(null)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${moveFolderId === null ? 'bg-indigo-50 border-indigo-300' : 'border-slate-200 hover:bg-slate-50'}`}
              >
                <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
                  </svg>
                </div>
                <span className="text-sm text-slate-700 font-medium flex-1">未分類</span>
                {moveFolderId === null && <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>}
              </button>
              {folders.map(f => (
                <button
                  key={f.id}
                  onClick={() => setMoveFolderId(f.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${moveFolderId === f.id ? 'bg-indigo-50 border-indigo-300' : 'border-slate-200 hover:bg-slate-50'}`}
                >
                  <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: f.color }}>
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M2.5 6A2.5 2.5 0 015 3.5h4.379a2.5 2.5 0 011.767.732L12.5 5.5H19A2.5 2.5 0 0121.5 8v9A2.5 2.5 0 0119 19.5H5A2.5 2.5 0 012.5 17V6z"/>
                    </svg>
                  </div>
                  <span className="text-sm text-slate-700 font-medium truncate flex-1">{f.name}</span>
                  {moveFolderId === f.id && <svg className="w-4 h-4 text-indigo-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleMove}
                disabled={movingReport}
                className="flex-1 bg-indigo-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors"
              >
                {movingReport ? '処理中...' : moveAction === 'move' ? '移動する' : '複製して移動'}
              </button>
              <button
                onClick={() => setMoveTarget(null)}
                className="flex-1 bg-slate-100 text-slate-600 text-sm py-2.5 rounded-xl hover:bg-slate-200 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* カレンダーメモモーダル */}
      {noteDate && (() => {
        const dateParts = noteDate.split('-')
        const dateLabel = `${dateParts[0]}年${Number(dateParts[1])}月${Number(dateParts[2])}日`
        const dateNotes = calendarNotes.filter(n => n.date === noteDate)
        const NOTE_COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b']
        return (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">{dateLabel}</h3>
                    <p className="text-xs text-slate-400">{dateNotes.length}件のメモ</p>
                  </div>
                </div>
                <button
                  onClick={() => setNoteDate(null)}
                  className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors text-slate-400 hover:text-slate-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>

              {/* 既存メモ一覧 */}
              {dateNotes.length > 0 && (
                <div className="space-y-2 mb-4 max-h-52 overflow-y-auto">
                  {dateNotes.map(n => (
                    <div
                      key={n.id}
                      className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-100 bg-slate-50"
                    >
                      <div className="w-2.5 h-2.5 rounded-sm mt-1 shrink-0" style={{ backgroundColor: n.color }} />
                      {editNoteId === n.id ? (
                        <div className="flex-1 flex gap-2">
                          <input
                            className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            value={editNoteContent}
                            onChange={e => setEditNoteContent(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveNoteEdit(n.id); if (e.key === 'Escape') setEditNoteId(null) }}
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveNoteEdit(n.id)}
                            className="text-xs text-indigo-600 font-semibold hover:text-indigo-700 shrink-0"
                          >保存</button>
                          <button
                            onClick={() => setEditNoteId(null)}
                            className="text-xs text-slate-400 hover:text-slate-600 shrink-0"
                          >取消</button>
                        </div>
                      ) : (
                        <>
                          <p className="flex-1 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">{n.content}</p>
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => { setEditNoteId(n.id); setEditNoteContent(n.content) }}
                              className="w-6 h-6 rounded-md hover:bg-slate-200 flex items-center justify-center transition-colors text-slate-400 hover:text-slate-600"
                              title="編集"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteNote(n.id)}
                              className="w-6 h-6 rounded-md hover:bg-red-100 flex items-center justify-center transition-colors text-slate-300 hover:text-red-500"
                              title="削除"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                              </svg>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 新規メモ入力 */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">新しいメモ</label>
                  <textarea
                    rows={3}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                    placeholder="予定・備考などを入力..."
                    value={noteInput}
                    onChange={e => setNoteInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleAddNote() }}
                    autoFocus
                  />
                  <p className="text-[10px] text-slate-300 mt-1 text-right">⌘Enter で追加</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-2">カラー</label>
                  <div className="flex gap-2 flex-wrap">
                    {NOTE_COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => setNoteColor(c)}
                        className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${noteColor === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : ''}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <button
                  onClick={handleAddNote}
                  disabled={!noteInput.trim() || noteSaving}
                  className="flex-1 bg-indigo-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                >
                  {noteSaving ? '追加中...' : '追加'}
                </button>
                <button
                  onClick={() => setNoteDate(null)}
                  className="flex-1 bg-slate-100 text-slate-600 text-sm py-2.5 rounded-xl hover:bg-slate-200 transition-colors"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* フォルダ編集モーダル */}
      {editingFolder && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: editFolderColor }}>
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2.5 6A2.5 2.5 0 015 3.5h4.379a2.5 2.5 0 011.767.732L12.5 5.5H19A2.5 2.5 0 0121.5 8v9A2.5 2.5 0 0119 19.5H5A2.5 2.5 0 012.5 17V6z"/>
                </svg>
              </div>
              <h3 className="text-base font-bold text-slate-800">フォルダを編集</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">フォルダ名</label>
                <input
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  value={editFolderName}
                  onChange={e => setEditFolderName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-2">カラー</label>
                <div className="flex gap-2 flex-wrap">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setEditFolderColor(c)}
                      className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${editFolderColor === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={handleSaveFolder}
                disabled={!editFolderName.trim()}
                className="flex-1 text-white text-sm font-semibold py-2.5 rounded-xl disabled:opacity-40 transition-colors"
                style={{ backgroundColor: editFolderColor }}
              >
                保存
              </button>
              <button
                onClick={() => handleDeleteFolder(editingFolder)}
                className="text-sm text-red-500 hover:text-red-600 px-3 py-2.5 rounded-xl hover:bg-red-50 transition-colors"
              >
                削除
              </button>
              <button
                onClick={() => setEditingFolder(null)}
                className="flex-1 bg-slate-100 text-slate-600 text-sm py-2.5 rounded-xl hover:bg-slate-200 transition-colors"
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
