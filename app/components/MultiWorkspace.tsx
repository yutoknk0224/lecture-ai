'use client'

import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import QuizSection from './QuizSection'

type MaterialSummary = {
  id: string
  title: string
  fileType: string
}

type Props = {
  materialIds: string[]
  selectedMaterials: MaterialSummary[]
}

type Tab = 'quiz' | 'chat'

export default function MultiWorkspace({ materialIds, selectedMaterials }: Props) {
  const [tab, setTab] = useState<Tab>('quiz')
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return
    const question = chatInput.trim()
    setChatInput('')
    setChatMessages((prev) => [...prev, { role: 'user', content: question }])
    setChatLoading(true)
    try {
      const res = await fetch('/api/chat/multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materialIds, question, history: chatMessages }),
      })
      const data = await res.json()
      setChatMessages((prev) => [...prev, { role: 'assistant', content: data.answer ?? 'エラーが発生しました' }])
    } catch {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: '通信エラーが発生しました' }])
    } finally {
      setChatLoading(false)
    }
  }

  const tabs = [
    { id: 'quiz' as Tab, label: '復習問題' },
    { id: 'chat' as Tab, label: 'Q&Aチャット' },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Selected materials header */}
      <div className="px-6 py-3 border-b border-slate-100 shrink-0 bg-indigo-50">
        <p className="text-xs font-semibold text-indigo-500 mb-1.5">
          {selectedMaterials.length}件の資料を統合して使用中
        </p>
        <div className="flex flex-wrap gap-1.5">
          {selectedMaterials.map((m) => (
            <span
              key={m.id}
              className="text-xs bg-white text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full max-w-[180px] truncate"
              title={m.title}
            >
              {m.title}
            </span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100 shrink-0 px-6 bg-white">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'quiz' && (
          <QuizSection materialIds={materialIds} hasText={true} />
        )}

        {tab === 'chat' && (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {chatMessages.length === 0 && (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p className="text-slate-500 font-medium text-sm mb-1">
                    {selectedMaterials.length}件の資料をまとめて質問できます
                  </p>
                  <p className="text-slate-400 text-xs mb-5">すべての資料の内容をもとにAIが回答します</p>
                  <div className="space-y-2 max-w-xs mx-auto">
                    {[
                      '各資料の共通点・相違点を教えてください',
                      'これらの資料から試験に出そうなポイントは？',
                      '全資料のキーワードをまとめてください',
                    ].map((hint) => (
                      <button
                        key={hint}
                        onClick={() => setChatInput(hint)}
                        className="block w-full text-left text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl px-4 py-2.5 transition-colors border border-indigo-100"
                      >
                        {hint}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role !== 'user' && (
                    <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0 mr-2 mt-0.5">
                      <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-sm'
                        : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm shadow-sm'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <span className="whitespace-pre-wrap">{msg.content}</span>
                    ) : (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          table: ({ children }) => (
                            <div className="overflow-x-auto my-2">
                              <table className="border-collapse text-xs w-full">{children}</table>
                            </div>
                          ),
                          thead: ({ children }) => <thead className="bg-slate-100">{children}</thead>,
                          th: ({ children }) => (
                            <th className="border border-slate-300 px-3 py-1.5 text-left font-semibold text-slate-700">
                              {children}
                            </th>
                          ),
                          td: ({ children }) => (
                            <td className="border border-slate-200 px-3 py-1.5 text-slate-600">{children}</td>
                          ),
                          tr: ({ children }) => <tr className="even:bg-slate-50">{children}</tr>,
                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
                          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                          code: ({ children }) => (
                            <code className="bg-slate-100 px-1 py-0.5 rounded text-xs font-mono">{children}</code>
                          ),
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    )}
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex justify-start">
                  <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0 mr-2 mt-0.5">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat input */}
            <div className="px-6 py-4 border-t border-slate-100 bg-white shrink-0">
              {chatMessages.length > 0 && (
                <div className="flex justify-end mb-2">
                  <button
                    onClick={() => setChatMessages([])}
                    className="text-xs text-slate-400 hover:text-red-400 transition-colors"
                  >
                    履歴を削除
                  </button>
                </div>
              )}
              <div className="flex gap-2 items-end">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault()
                      sendChat()
                    }
                  }}
                  placeholder="質問を入力... （Enterで送信・Shift+Enterで改行）"
                  rows={2}
                  className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50"
                />
                <button
                  onClick={sendChat}
                  disabled={!chatInput.trim() || chatLoading}
                  className="bg-indigo-600 text-white w-10 h-10 rounded-xl flex items-center justify-center hover:bg-indigo-700 disabled:opacity-40 transition-colors shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
