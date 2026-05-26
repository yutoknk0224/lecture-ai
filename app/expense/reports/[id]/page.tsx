'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ReportDetail from '@/app/expense/components/ReportDetail'
import EquipmentReportDetail from '@/app/expense/components/EquipmentReportDetail'

type ReportMeta = { reportType: string }

export default function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [reportType, setReportType] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/expense/reports/${id}`)
      .then(r => r.json())
      .then((data: ReportMeta) => setReportType(data.reportType ?? 'travel'))
  }, [id])

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3 shrink-0">
        <button
          onClick={() => router.push('/expense')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 transition-colors mr-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
          ホーム
        </button>
        <div className="w-px h-5 bg-slate-200"/>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${reportType === 'equipment' ? 'bg-amber-500' : 'bg-emerald-600'}`}>
          <span className="text-white text-xs font-bold">{reportType === 'equipment' ? '購' : '¥'}</span>
        </div>
        <h1 className="text-base font-bold text-slate-800">経費精算 AI</h1>
        {reportType && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${reportType === 'equipment' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-600'}`}>
            {reportType === 'equipment' ? '備品購入' : '旅費精算'}
          </span>
        )}
        <nav className="ml-auto flex items-center gap-4 text-sm text-slate-500">
          <a href="/" className="hover:text-indigo-600">講義資料管理</a>
          <a href="/expense" className="hover:text-emerald-600">経費精算</a>
          <a href="/expense/templates" className="hover:text-emerald-600">テンプレート管理</a>
        </nav>
      </header>

      <div className="flex-1 overflow-hidden p-5">
        {reportType === null ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-slate-300 border-t-transparent rounded-full animate-spin"/>
          </div>
        ) : reportType === 'equipment' ? (
          <EquipmentReportDetail
            reportId={id}
            onDeleted={() => router.push('/expense')}
            onUpdated={() => {}}
          />
        ) : (
          <ReportDetail
            reportId={id}
            onDeleted={() => router.push('/expense')}
            onUpdated={() => {}}
          />
        )}
      </div>
    </div>
  )
}
