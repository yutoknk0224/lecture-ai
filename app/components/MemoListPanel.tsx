'use client'

import { useState, useEffect, useCallback } from 'react'

type Memo = { id: string; date: string; content: string }

export default function MemoListPanel() {
  const [memos, setMemos] = useState<Memo[]>([])

  const load = useCallback(async () => {
    const res = await fetch('/api/memos')
    const data = await res.json()
    setMemos(data)
  }, [])

  useEffect(() => {
    load()
    const handler = () => load()
    window.addEventListener('memo-updated', handler)
    return () => window.removeEventListener('memo-updated', handler)
  }, [load])

  const fmt = (date: string) => {
    const [, m, d] = date.split('-')
    return `${Number(m)}/${Number(d)}`
  }

  return (
    <div className="flex flex-col h-full p-3 gap-2">
      <div className="flex items-center justify-between shrink-0">
        <span className="text-xs font-bold text-slate-700">メモ一覧</span>
        <button onClick={load} className="text-[10px] text-slate-400 hover:text-slate-600">↺</button>
      </div>
      <div className="flex-1 overflow-y-auto flex flex-col gap-1">
        {memos.length === 0 ? (
          <p className="text-[10px] text-slate-400 text-center mt-3">メモはありません</p>
        ) : (
          memos.map((memo) => (
            <div key={memo.id} className="flex gap-2 text-[11px] leading-tight">
              <span className="shrink-0 text-slate-400 font-medium w-10">{fmt(memo.date)}</span>
              <span className="text-slate-700 truncate">{memo.content}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
