'use client'

import { useState } from 'react'

export default function AdminPage() {
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const runMigration = async () => {
    setLoading(true)
    setResult(null)
    const res = await fetch('/api/admin/migrate-lectures', { method: 'POST' })
    const data = await res.json()
    setResult(JSON.stringify(data))
    setLoading(false)
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-100 gap-6">
      <div className="bg-white rounded-2xl shadow p-8 flex flex-col items-center gap-4 w-96">
        <h1 className="text-lg font-bold text-slate-800">移行ツール</h1>
        <p className="text-sm text-slate-500 text-center">
          既存の資料を「未分類」授業回に移行します。<br />
          一度だけ実行してください。
        </p>
        <button
          onClick={runMigration}
          disabled={loading}
          className="w-full py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? '処理中...' : '移行を実行する'}
        </button>
        {result && (
          <div className="w-full bg-slate-50 rounded-xl p-4 text-sm text-slate-700 font-mono break-all">
            {result}
          </div>
        )}
      </div>
    </div>
  )
}
