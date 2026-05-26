'use client'

import { useState, useEffect, useCallback } from 'react'
import EquipmentItemForm from './EquipmentItemForm'
import ExcelExportModal from './ExcelExportModal'
import SendEmailPanel from './SendEmailPanel'

type EquipmentItem = {
  id: string
  itemName: string
  quantity: number
  unitPrice: number
  amount: number
  category: string
  purchaseDate: string
  vendor: string
  receiptNo: string
  modelNumber: string
  purpose: string
  notes: string
  url: string
  quotationNo: string
}

type Report = {
  id: string
  title: string
  period: string
  status: string
  dueDate: string | null
  reportType: string
  equipmentItems: EquipmentItem[]
}

type Props = {
  reportId: string
  onDeleted: () => void
  onUpdated: () => void
}

function statusBadge(status: string) {
  if (status === 'submitted')
    return <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">提出済み</span>
  return <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">下書き</span>
}

export default function EquipmentReportDetail({ reportId, onDeleted, onUpdated }: Props) {
  const [report, setReport] = useState<Report | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<EquipmentItem | null>(null)
  const [editing, setEditing] = useState(false)
  const [showExcelExport, setShowExcelExport] = useState(false)
  const [showSendPanel, setShowSendPanel] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editPeriod, setEditPeriod] = useState('')
  const [editDue, setEditDue] = useState('')
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/expense/reports/${reportId}`)
    if (res.ok) {
      const data = await res.json()
      setReport(data)
    }
  }, [reportId])

  useEffect(() => { load() }, [load])

  const handleSaveReport = async () => {
    if (!report) return
    await fetch(`/api/expense/reports/${report.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editTitle, period: editPeriod, status: report.status, dueDate: editDue || null }),
    })
    setEditing(false)
    load()
    onUpdated()
  }

  const handleDelete = async () => {
    if (!report) return
    if (!confirm(`「${report.title}」を削除しますか？`)) return
    setDeleting(true)
    await fetch(`/api/expense/reports/${report.id}`, { method: 'DELETE' })
    onDeleted()
  }

  const handleToggleStatus = async () => {
    if (!report) return
    const next = report.status === 'submitted' ? 'draft' : 'submitted'
    await fetch(`/api/expense/reports/${report.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: report.title, period: report.period, status: next }),
    })
    load()
  }

  const handleDeleteItem = async (item: EquipmentItem) => {
    if (!confirm(`「${item.itemName}」を削除しますか？`)) return
    await fetch(`/api/expense/equipment-items/${item.id}`, { method: 'DELETE' })
    load()
  }

  if (!report) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"/>
      </div>
    )
  }

  const total = report.equipmentItems.reduce((s, i) => s + i.amount, 0)

  return (
    <div className="h-full flex flex-col gap-4 overflow-y-auto">
      {/* ヘッダー */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">タイトル</label>
              <input
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">対象期間</label>
                <input
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
                  value={editPeriod}
                  onChange={e => setEditPeriod(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">提出期日</label>
                <input
                  type="date"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
                  value={editDue}
                  onChange={e => setEditDue(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSaveReport} className="flex-1 bg-amber-600 text-white text-sm font-semibold py-2 rounded-xl hover:bg-amber-700 transition-colors">保存</button>
              <button onClick={() => setEditing(false)} className="flex-1 bg-slate-100 text-slate-600 text-sm py-2 rounded-xl hover:bg-slate-200 transition-colors">キャンセル</button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">備品購入</span>
                {statusBadge(report.status)}
              </div>
              <h2 className="text-lg font-bold text-slate-800 truncate">{report.title}</h2>
              <p className="text-sm text-slate-400 mt-0.5">{report.period}</p>
              {report.dueDate && (
                <p className="text-xs text-slate-400 mt-1">期日: {report.dueDate}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold text-amber-700">¥{total.toLocaleString()}</p>
              <p className="text-xs text-slate-400 mt-0.5">{report.equipmentItems.length}点</p>
            </div>
          </div>
        )}

        {!editing && (
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100 flex-wrap">
            <button
              onClick={() => {
                setEditing(true)
                setEditTitle(report.title)
                setEditPeriod(report.period)
                setEditDue(report.dueDate ?? '')
              }}
              className="flex items-center gap-1.5 text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
              編集
            </button>
            <button
              onClick={handleToggleStatus}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${
                report.status === 'submitted'
                  ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {report.status === 'submitted' ? '下書きに戻す' : '提出済みにする'}
            </button>
            <button
              onClick={() => setShowExcelExport(true)}
              className="flex items-center gap-1.5 text-xs bg-teal-600 text-white px-3 py-1.5 rounded-lg hover:bg-teal-700 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              Excel出力
            </button>
            <button
              onClick={() => setShowSendPanel(true)}
              className="flex items-center gap-1.5 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
              </svg>
              送信/出力
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 text-xs bg-red-50 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors ml-auto disabled:opacity-40"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
              削除
            </button>
          </div>
        )}
      </div>

      {/* 備品フォーム */}
      {(showForm || editItem) && (
        <EquipmentItemForm
          reportId={reportId}
          editItem={editItem}
          onSaved={() => { setShowForm(false); setEditItem(null); load() }}
          onCancel={() => { setShowForm(false); setEditItem(null) }}
        />
      )}

      {/* 備品一覧 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-700">購入品目一覧</h3>
          {!showForm && !editItem && (
            <button
              onClick={() => { setShowForm(true); setEditItem(null) }}
              className="flex items-center gap-1.5 text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
              </svg>
              品目を追加
            </button>
          )}
        </div>

        {report.equipmentItems.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10"/>
              </svg>
            </div>
            <p className="text-sm text-slate-400">品目がありません</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 text-xs text-amber-600 hover:text-amber-700 font-medium"
            >
              + 品目を追加する
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 font-semibold">品名</th>
                  <th className="text-right px-4 py-3 font-semibold whitespace-nowrap">数量</th>
                  <th className="text-right px-4 py-3 font-semibold whitespace-nowrap">単価</th>
                  <th className="text-right px-4 py-3 font-semibold whitespace-nowrap">金額</th>
                  <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">購入先</th>
                  <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">購入日</th>
                  <th className="px-4 py-3"/>
                </tr>
              </thead>
              <tbody>
                {report.equipmentItems.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/40'}`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-700">{item.itemName}</p>
                      {item.modelNumber && <p className="text-xs text-slate-400 mt-0.5">{item.modelNumber}</p>}
                      {item.purpose && <p className="text-xs text-slate-400 truncate max-w-[200px]">{item.purpose}</p>}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">¥{item.unitPrice.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800 whitespace-nowrap">¥{item.amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{item.vendor || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{item.purchaseDate || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditItem(item); setShowForm(false) }}
                          className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                          title="編集"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item)}
                          className="p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-500 transition-colors"
                          title="削除"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-amber-50 border-t-2 border-amber-200">
                  <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-slate-600 text-right">合計</td>
                  <td className="px-4 py-3 text-right text-lg font-bold text-amber-700">¥{total.toLocaleString()}</td>
                  <td colSpan={3}/>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* 追加情報パネル（備考・URL） */}
      {report.equipmentItems.some(i => i.notes || i.url || i.quotationNo) && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-3">追加情報</h3>
          <div className="space-y-3">
            {report.equipmentItems.filter(i => i.notes || i.url || i.quotationNo).map(item => (
              <div key={item.id} className="text-sm">
                <p className="font-medium text-slate-700 mb-1">{item.itemName}</p>
                {item.quotationNo && <p className="text-xs text-slate-500">見積書No.: {item.quotationNo}</p>}
                {item.url && (
                  <p className="text-xs text-slate-500 truncate">
                    URL: <span className="text-indigo-500 break-all">{item.url}</span>
                  </p>
                )}
                {item.notes && <p className="text-xs text-slate-400 mt-0.5">備考: {item.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {showExcelExport && (
        <ExcelExportModal
          reportId={reportId}
          reportTitle={report.title}
          reportType="equipment"
          onClose={() => setShowExcelExport(false)}
        />
      )}

      {showSendPanel && (
        <SendEmailPanel
          report={{ ...report, items: [] }}
          reportType="equipment"
          onClose={() => setShowSendPanel(false)}
        />
      )}
    </div>
  )
}
