'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { SearchResult } from '@/app/api/search/route'

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export default function GlobalSearch() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    if (!debouncedQuery) {
      setResults([])
      setOpen(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setResults(data)
          setOpen(true)
          setLoading(false)
        }
      })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [debouncedQuery])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = useCallback((result: SearchResult) => {
    setOpen(false)
    setQuery('')
    if (result.type === 'course') {
      router.push(`/courses/${result.id}`)
    } else if (result.type === 'lecture') {
      router.push(`/courses/${result.courseId}`)
    } else {
      router.push(`/courses/${result.courseId}`)
    }
  }, [router])

  const courses = results.filter((r) => r.type === 'course') as Extract<SearchResult, { type: 'course' }>[]
  const lectures = results.filter((r) => r.type === 'lecture') as Extract<SearchResult, { type: 'lecture' }>[]
  const materials = results.filter((r) => r.type === 'material') as Extract<SearchResult, { type: 'material' }>[]

  return (
    <div ref={containerRef} className="relative w-72">
      <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2 border border-transparent focus-within:border-indigo-300 focus-within:bg-white transition-colors">
        <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="text"
          placeholder="科目・資料・授業回を検索..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none"
        />
        {loading && (
          <svg className="w-3.5 h-3.5 text-slate-400 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        )}
        {query && !loading && (
          <button onClick={() => { setQuery(''); setResults([]); setOpen(false) }} className="text-slate-400 hover:text-slate-600">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden max-h-96 overflow-y-auto">
          {courses.length > 0 && (
            <section>
              <p className="px-4 pt-3 pb-1 text-xs font-bold text-slate-400 uppercase tracking-wider">科目</p>
              {courses.map((r) => (
                <button
                  key={r.id}
                  onClick={() => handleSelect(r)}
                  className="w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 transition-colors"
                >
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                    <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </span>
                  <span className="text-sm font-medium text-slate-800 truncate">{r.name}</span>
                </button>
              ))}
            </section>
          )}

          {lectures.length > 0 && (
            <section>
              <p className="px-4 pt-3 pb-1 text-xs font-bold text-slate-400 uppercase tracking-wider">授業回</p>
              {lectures.map((r) => (
                <button
                  key={r.id}
                  onClick={() => handleSelect(r)}
                  className="w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 transition-colors"
                >
                  <span className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                    <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{r.title}</p>
                    <p className="text-xs text-slate-400 truncate">{r.courseName}</p>
                  </div>
                </button>
              ))}
            </section>
          )}

          {materials.length > 0 && (
            <section>
              <p className="px-4 pt-3 pb-1 text-xs font-bold text-slate-400 uppercase tracking-wider">資料</p>
              {materials.map((r) => (
                <button
                  key={r.id}
                  onClick={() => handleSelect(r)}
                  className="w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 transition-colors"
                >
                  <span className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                    <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{r.title}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {r.courseName}{r.lectureTitle ? ` › ${r.lectureTitle}` : ''}
                    </p>
                  </div>
                </button>
              ))}
            </section>
          )}

          <div className="h-2" />
        </div>
      )}

      {open && query && results.length === 0 && !loading && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 px-4 py-6 text-center">
          <p className="text-sm text-slate-400">「{query}」の検索結果はありません</p>
        </div>
      )}
    </div>
  )
}
