'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import TimetableGrid from './components/TimetableGrid'
import CalendarPanel from './components/CalendarPanel'
import TaskPanel from './components/TaskPanel'

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
  createdAt: string
}

type View =
  | { type: 'semester'; year: number; semester: string }
  | { type: 'common' }

export default function Home() {
  const router = useRouter()
  const { data: session } = useSession()
  const [courses, setCourses] = useState<Course[]>([])
  const [view, setView] = useState<View>({ type: 'semester', year: 1, semester: '前期' })
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const loadCourses = useCallback(async () => {
    const res = await fetch('/api/courses')
    const data = await res.json()
    setCourses(data)
  }, [])

  useEffect(() => {
    loadCourses()
  }, [loadCourses])

  const filteredCourses =
    view.type === 'common'
      ? courses.filter((c) => c.year === null && c.semester === null)
      : courses.filter((c) => c.year === view.year && c.semester === view.semester)

  const handleSelectView = (newView: View) => {
    setView(newView)
  }

  const currentYear = view.type === 'semester' ? view.year : null
  const currentSemester = view.type === 'semester' ? view.semester : null

  const viewLabel =
    view.type === 'common'
      ? '共通科目'
      : `${view.year}年 ${view.semester}`

  return (
    <div className="flex flex-col h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 shrink-0 shadow-sm z-10">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="w-9 h-9 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
          title={sidebarOpen ? 'サイドバーを閉じる' : 'サイドバーを開く'}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-sm shrink-0">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>

        <div className="flex items-baseline gap-2">
          <h1 className="text-base font-bold text-slate-800">講義資料管理 AI</h1>
          <span className="text-sm text-slate-400">／</span>
          <span className="text-sm font-semibold text-indigo-600">{viewLabel}</span>
          <span className="text-xs text-slate-400">· {filteredCourses.length}科目</span>
        </div>

        <nav className="ml-auto flex items-center gap-1">
          <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-sm font-medium rounded-lg">講義資料</span>
          <a href="/expense" className="px-3 py-1.5 text-slate-500 text-sm font-medium rounded-lg hover:bg-slate-100 transition-colors">
            経費精算
          </a>
          {session?.user && (
            <div className="flex items-center gap-2 ml-2 pl-3 border-l border-slate-200">
              {session.user.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={session.user.image} alt="" className="w-7 h-7 rounded-full" referrerPolicy="no-referrer" />
              )}
              <span className="text-sm text-slate-600 font-medium max-w-[120px] truncate">{session.user.name}</span>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="text-xs text-slate-400 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                ログアウト
              </button>
            </div>
          )}
        </nav>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Collapsible sidebar */}
        <aside
          className={`bg-white border-r border-slate-200 shrink-0 transition-all duration-300 overflow-hidden ${
            sidebarOpen ? 'w-56' : 'w-0'
          }`}
        >
          <div className="w-56 h-full overflow-y-auto p-4 flex flex-col gap-5">
            {/* Year selection */}
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">学年</p>
              <div className="grid grid-cols-2 gap-2">
                {[1, 2, 3, 4].map((year) => {
                  const isActive = view.type === 'semester' && view.year === year
                  return (
                    <button
                      key={year}
                      onClick={() =>
                        handleSelectView({
                          type: 'semester',
                          year,
                          semester:
                            view.type === 'semester' && view.year === year
                              ? view.semester
                              : '前期',
                        })
                      }
                      className={`py-5 text-2xl font-black rounded-2xl transition-all ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-105'
                          : 'bg-slate-50 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200'
                      }`}
                    >
                      {year}年
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Semester selection */}
            <div
              className={`transition-all duration-200 ${
                view.type === 'semester' ? 'opacity-100' : 'opacity-30 pointer-events-none'
              }`}
            >
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">学期</p>
              <div className="flex gap-2">
                {['前期', '後期'].map((sem) => {
                  const isActive = view.type === 'semester' && view.semester === sem
                  return (
                    <button
                      key={sem}
                      onClick={() =>
                        view.type === 'semester' &&
                        handleSelectView({ type: 'semester', year: view.year, semester: sem })
                      }
                      className={`flex-1 py-3.5 text-sm font-bold rounded-xl transition-all ${
                        isActive
                          ? 'bg-indigo-100 text-indigo-700 shadow-sm'
                          : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {sem}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Common courses */}
            <div className="border-t border-slate-200 pt-4 mt-auto">
              <button
                onClick={() => handleSelectView({ type: 'common' })}
                className={`w-full py-4 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  view.type === 'common'
                    ? 'bg-emerald-100 text-emerald-700 shadow-sm'
                    : 'bg-slate-50 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 border border-slate-200 hover:border-emerald-200'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                共通科目
              </button>
              <p className="text-xs text-slate-400 text-center mt-2">
                複数学期にまたがる科目・<br />通年科目はこちらへ
              </p>
            </div>
          </div>
        </aside>

        {/* Main area: timetable + bottom panels */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          <main className="flex-1 overflow-auto p-6">
            <TimetableGrid
              courses={filteredCourses}
              currentYear={currentYear}
              currentSemester={currentSemester}
              onSelectCourse={(id) => router.push(`/courses/${id}`)}
              onCourseCreated={loadCourses}
              onCourseDeleted={loadCourses}
            />
          </main>

          {/* Calendar + Task bottom panel */}
          <div className="h-72 shrink-0 border-t border-slate-200 bg-white flex min-w-0">
            <div className="w-56 shrink-0 border-r border-slate-200 overflow-hidden">
              <CalendarPanel />
            </div>
            <div className="flex-1 overflow-hidden">
              <TaskPanel />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
