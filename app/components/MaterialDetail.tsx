'use client'

import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import QuizSection from './QuizSection'

type ChatMessage = {
  id: string
  role: string
  content: string
}

type Material = {
  id: string
  title: string
  fileName: string
  filePath: string
  fileType: string
  fileSize: number
  summary: string | null
  extractedText: string | null
  chatMessages: ChatMessage[]
  createdAt: string
}

type Props = {
  materialId: string
}

type Tab = 'summary' | 'quiz' | 'chat' | 'view'

export default function MaterialDetail({ materialId }: Props) {
  const [material, setMaterial] = useState<Material | null>(null)
  const [loading, setLoading] = useState(true)
  const [reprocessing, setReprocessing] = useState(false)
  const [tab, setTab] = useState<Tab>('summary')

  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadMaterial()
  }, [materialId])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const loadMaterial = async () => {
    setLoading(true)
    const res = await fetch(`/api/materials/${materialId}`)
    const data = await res.json()
    setMaterial(data)
    setChatMessages(data.chatMessages || [])
    setLoading(false)
  }

  const reprocess = async () => {
    setReprocessing(true)
    await fetch(`/api/materials/${materialId}/reprocess`, { method: 'POST' })
    await loadMaterial()
    setReprocessing(false)
  }

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return
    const question = chatInput.trim()
    setChatInput('')
    setChatMessages((prev) => [...prev, { role: 'user', content: question }])
    setChatLoading(true)

    const res = await fetch(`/api/chat/${materialId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    })
    const data = await res.json()
    setChatMessages((prev) => [...prev, { role: 'assistant', content: data.answer }])
    setChatLoading(false)
  }

  const clearChat = async () => {
    if (!confirm('チャット履歴を削除しますか？')) return
    await fetch(`/api/chat/${materialId}`, { method: 'DELETE' })
    setChatMessages([])
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-400">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!material) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        資料が見つかりません
      </div>
    )
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'summary',
      label: '要約・整理',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      id: 'quiz',
      label: '復習問題',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      id: 'chat',
      label: 'Q&Aチャット',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
    {
      id: 'view' as Tab,
      label: '資料閲覧',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Material header */}
      <div className="px-6 py-4 border-b border-slate-100 shrink-0">
        <h2 className="text-lg font-bold text-slate-800 leading-tight">{material.title}</h2>
        <p className="text-xs text-slate-400 mt-1">
          {material.fileName} · {(material.fileSize / 1024).toFixed(1)} KB ·{' '}
          {new Date(material.createdAt).toLocaleDateString('ja-JP')}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100 shrink-0 px-6">
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
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {/* Summary tab */}
        {tab === 'summary' && (
          <div className="p-6">
            {material.summary ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 bg-violet-100 rounded-lg flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <span className="text-sm font-semibold text-slate-700">AI要約</span>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{material.summary}</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
                <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="text-slate-600 font-medium mb-1">テキスト抽出・要約が完了していません</p>
                <p className="text-sm text-slate-400 mb-5">AIで再処理すると要約が生成されます</p>
                <button
                  onClick={reprocess}
                  disabled={reprocessing}
                  className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
                >
                  {reprocessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      AI処理中...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      AIで再処理する
                    </>
                  )}
                </button>
              </div>
            )}

            {material.extractedText && (
              <div className="mt-4">
                <details className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <summary className="px-5 py-3.5 text-sm font-medium text-slate-500 cursor-pointer hover:text-slate-700 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                    </svg>
                    抽出されたテキスト全文を表示
                  </summary>
                  <div className="px-5 pb-5 text-xs text-slate-500 whitespace-pre-wrap max-h-60 overflow-y-auto border-t border-slate-100 pt-4">
                    {material.extractedText}
                  </div>
                </details>
              </div>
            )}
          </div>
        )}

        {/* Quiz tab */}
        {tab === 'quiz' && (
          <QuizSection materialId={materialId} hasText={!!material.extractedText} />
        )}

        {/* Chat tab */}
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
                  <p className="text-slate-500 font-medium text-sm mb-1">資料について質問してみましょう</p>
                  <p className="text-slate-400 text-xs mb-5">AIが資料の内容をもとに回答します</p>
                  <div className="space-y-2 max-w-xs mx-auto">
                    {[
                      'この資料の重要な概念を教えてください',
                      'キーワードを解説してください',
                      'この内容を初心者向けに説明してください',
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
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
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
                          thead: ({ children }) => (
                            <thead className="bg-slate-100">{children}</thead>
                          ),
                          th: ({ children }) => (
                            <th className="border border-slate-300 px-3 py-1.5 text-left font-semibold text-slate-700">
                              {children}
                            </th>
                          ),
                          td: ({ children }) => (
                            <td className="border border-slate-200 px-3 py-1.5 text-slate-600">
                              {children}
                            </td>
                          ),
                          tr: ({ children }) => (
                            <tr className="even:bg-slate-50">{children}</tr>
                          ),
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
                    onClick={clearChat}
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

        {/* View tab */}
        {tab === 'view' && (
          <div className="h-full flex flex-col">
            {material.fileType.includes('pdf') ? (
              <iframe
                src={material.filePath}
                className="flex-1 w-full border-0"
                title={material.title}
              />
            ) : (
              <div className="flex-1 overflow-y-auto p-6">
                {material.extractedText ? (
                  <pre className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-sans bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                    {material.extractedText}
                  </pre>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <p className="text-slate-400 text-sm">テキストを抽出できませんでした</p>
                    <p className="text-slate-300 text-xs mt-1">「要約・整理」タブから再処理を試みてください</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
