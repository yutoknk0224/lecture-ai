'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface ExpenseItem {
  date: string
  purpose: string
  destination: string
  departure: string
  transport: string
  amount: number
  category: string
  notes: string
  sourceEmail: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  items?: ExpenseItem[]
  searched?: boolean
  emailCount?: number
  totalScanned?: number
  accountCount?: number
}

interface GoogleAccount {
  id: string
  email: string
  name: string
}

interface Props {
  reportId: string | null
  onItemsAdded?: () => void
}

export default function GmailAssistant({ reportId, onItemsAdded }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'GmailからAIが経費情報を探してきます。例えば「今月の交通費メールを探して」「ホテルの予約確認を検索して」のように依頼してください。',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [addingItems, setAddingItems] = useState<Set<number>>(new Set())
  const [addedItems, setAddedItems] = useState<Set<number>>(new Set())
  const [accounts, setAccounts] = useState<GoogleAccount[]>([])
  const [showAccounts, setShowAccounts] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadAccounts = useCallback(async () => {
    const res = await fetch('/api/auth/google/accounts')
    if (res.ok) setAccounts(await res.json())
  }, [])

  useEffect(() => { loadAccounts() }, [loadAccounts])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Show account added toast
  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('account_added')) {
      loadAccounts()
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [loadAccounts])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { role: 'user', content: text }
    const history = messages.map(m => ({ role: m.role, content: m.content }))
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/expense/gmail/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      })
      const data = await res.json() as {
        reply?: string
        items?: ExpenseItem[]
        searched?: boolean
        emailCount?: number
        totalScanned?: number
        accountCount?: number
        needsAuth?: boolean
        error?: string
      }

      if (data.needsAuth) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Google認証が必要です。下の「アカウントを追加」からログインしてください。',
        }])
        return
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply ?? 'エラーが発生しました。',
        items: data.items,
        searched: data.searched,
        emailCount: data.emailCount,
        totalScanned: data.totalScanned,
        accountCount: data.accountCount,
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'エラーが発生しました。もう一度お試しください。',
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleAddItem = async (item: ExpenseItem, msgIndex: number, itemIndex: number) => {
    if (!reportId) {
      alert('先に精算レポートを選択してください。')
      return
    }
    const key = msgIndex * 1000 + itemIndex
    setAddingItems(prev => new Set([...prev, key]))
    try {
      const res = await fetch('/api/expense/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId, ...item }),
      })
      if (res.ok) {
        setAddedItems(prev => new Set([...prev, key]))
        onItemsAdded?.()
      }
    } finally {
      setAddingItems(prev => { const s = new Set(prev); s.delete(key); return s })
    }
  }

  const handleAddAll = async (items: ExpenseItem[], msgIndex: number) => {
    if (!reportId) { alert('先に精算レポートを選択してください。'); return }
    await Promise.all(items.map((item, i) => handleAddItem(item, msgIndex, i)))
  }

  const handleRemoveAccount = async (id: string) => {
    await fetch('/api/auth/google/accounts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    loadAccounts()
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100">
        <div className="w-6 h-6 bg-red-50 rounded-md flex items-center justify-center shrink-0">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
            <path d="M20 4H4C2.9 4 2 4.9 2 6v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z" fill="#EA4335" opacity="0.2"/>
            <path d="M20 4l-8 7-8-7" stroke="#EA4335" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <span className="text-sm font-semibold text-slate-800 flex-1">Gmail AI</span>
        <button
          onClick={() => setShowAccounts(v => !v)}
          className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
        >
          <span className="w-4 h-4 bg-slate-100 rounded-full text-center leading-4 text-xs font-medium">
            {accounts.length}
          </span>
          アカウント
        </button>
      </div>

      {/* Account manager */}
      {showAccounts && (
        <div className="border-b border-slate-100 p-3 bg-slate-50 space-y-2">
          <p className="text-xs font-medium text-slate-600">連携中のGmailアカウント</p>
          {accounts.length === 0 && (
            <p className="text-xs text-slate-400">まだアカウントが連携されていません</p>
          )}
          {accounts.map(acc => (
            <div key={acc.id} className="flex items-center gap-2 bg-white rounded-lg px-2.5 py-2 border border-slate-200">
              <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                <span className="text-xs text-red-600 font-bold">{acc.email[0].toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-700 truncate">{acc.name}</p>
                <p className="text-xs text-slate-400 truncate">{acc.email}</p>
              </div>
              <button
                onClick={() => handleRemoveAccount(acc.id)}
                className="text-slate-300 hover:text-red-400 transition-colors shrink-0"
                title="削除"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          ))}
          <a
            href="/api/auth/google?addAccount=1&returnTo=/expense"
            className="flex items-center justify-center gap-1.5 w-full text-xs py-2 border border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
            </svg>
            Googleアカウントを追加
          </a>
        </div>
      )}

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.map((msg, msgIdx) => (
          <div key={msgIdx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[88%]">
              <div
                className={`rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-sm'
                    : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                }`}
              >
                {msg.content}
              </div>

              {msg.searched && (
                <p className="text-[11px] text-slate-400 mt-0.5 ml-1">
                  {msg.totalScanned !== undefined && `${msg.totalScanned}件をスキャン → `}
                  {msg.emailCount !== undefined && msg.emailCount > 0
                    ? `${msg.emailCount}件を詳細解析`
                    : '経費メールなし'}
                  {msg.accountCount && msg.accountCount > 1 ? `（${msg.accountCount}アカウント）` : ''}
                </p>
              )}

              {msg.items && msg.items.length > 0 && (
                <div className="mt-1.5 space-y-1.5">
                  {msg.items.map((item, itemIdx) => {
                    const key = msgIdx * 1000 + itemIdx
                    const added = addedItems.has(key)
                    const adding = addingItems.has(key)
                    return (
                      <div key={itemIdx} className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-semibold text-slate-800">{item.purpose || item.destination}</span>
                              <span className="text-[10px] px-1 py-0.5 bg-emerald-50 text-emerald-700 rounded">{item.category}</span>
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-400 space-y-0.5">
                              {item.date && <p>📅 {item.date}</p>}
                              {item.destination && <p>📍 {item.destination}</p>}
                              {item.transport && <p>🚃 {item.transport}</p>}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className="text-xs font-bold text-slate-800">¥{item.amount.toLocaleString()}</span>
                            <button
                              onClick={() => handleAddItem(item, msgIdx, itemIdx)}
                              disabled={added || adding || !reportId}
                              className={`text-[11px] px-2 py-0.5 rounded-md transition-colors ${
                                added
                                  ? 'bg-emerald-100 text-emerald-700 cursor-default'
                                  : adding
                                  ? 'bg-slate-100 text-slate-400 cursor-wait'
                                  : !reportId
                                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
                              }`}
                            >
                              {added ? '追加済み' : adding ? '...' : '+ 追加'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {msg.items.length > 1 && (
                    <button
                      onClick={() => handleAddAll(msg.items!, msgIdx)}
                      disabled={!reportId || msg.items.every((_, i) => addedItems.has(msgIdx * 1000 + i))}
                      className="w-full text-[11px] py-1.5 border border-indigo-200 text-indigo-600 rounded-xl hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      すべて追加 ({msg.items.length}件)
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 rounded-2xl rounded-bl-sm px-3 py-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0ms]"/>
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]"/>
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]"/>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-2.5 border-t border-slate-100">
        {!reportId && (
          <p className="text-[11px] text-amber-600 mb-1.5 text-center">
            ※ レポートを選択すると明細を追加できます
          </p>
        )}
        <div className="flex gap-1.5">
          <input
            className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
            placeholder="「今月の交通費を探して」など..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="px-2.5 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
