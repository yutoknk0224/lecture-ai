'use client'

import { useState, useEffect } from 'react'

const CATEGORIES = ['備品・消耗品', '交通費', '通信費', '印刷費', '研修・学会', '書籍・資料', 'その他']

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

type Props = {
  reportId: string
  editItem?: EquipmentItem | null
  onSaved: () => void
  onCancel: () => void
}

const EMPTY: Omit<EquipmentItem, 'id' | 'amount'> = {
  itemName: '',
  quantity: 1,
  unitPrice: 0,
  category: '',
  purchaseDate: '',
  vendor: '',
  receiptNo: '',
  modelNumber: '',
  purpose: '',
  notes: '',
  url: '',
  quotationNo: '',
}

export default function EquipmentItemForm({ reportId, editItem, onSaved, onCancel }: Props) {
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (editItem) {
      setForm({
        itemName: editItem.itemName ?? '',
        quantity: editItem.quantity ?? 1,
        unitPrice: editItem.unitPrice ?? 0,
        category: editItem.category ?? '',
        purchaseDate: editItem.purchaseDate ?? '',
        vendor: editItem.vendor ?? '',
        receiptNo: editItem.receiptNo ?? '',
        modelNumber: editItem.modelNumber ?? '',
        purpose: editItem.purpose ?? '',
        notes: editItem.notes ?? '',
        url: editItem.url ?? '',
        quotationNo: editItem.quotationNo ?? '',
      })
    } else {
      setForm({ ...EMPTY })
    }
  }, [editItem])

  const set = (key: keyof typeof EMPTY, val: string | number) =>
    setForm(prev => ({ ...prev, [key]: val }))

  const amount = Number(form.quantity) * Number(form.unitPrice)

  const handleSubmit = async () => {
    if (!form.itemName.trim()) { setError('品名は必須です'); return }
    if (!form.quantity || !form.unitPrice) { setError('数量と単価は必須です'); return }
    setSaving(true)
    setError('')
    try {
      const url = editItem
        ? `/api/expense/equipment-items/${editItem.id}`
        : '/api/expense/equipment-items'
      const res = await fetch(url, {
        method: editItem ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId, ...form }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? 'エラーが発生しました')
        return
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
      <h3 className="text-sm font-bold text-slate-700">
        {editItem ? '備品を編集' : '備品を追加'}
      </h3>

      {/* 必須フィールド */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="text-xs font-semibold text-slate-500 block mb-1">
            品名・内容 <span className="text-red-400">*</span>
          </label>
          <input
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
            placeholder="例：ノートパソコン MacBook Air"
            value={form.itemName}
            onChange={e => set('itemName', e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 block mb-1">カテゴリ</label>
          <select
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
            value={form.category}
            onChange={e => set('category', e.target.value)}
          >
            <option value="">選択してください</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 block mb-1">
            数量 <span className="text-red-400">*</span>
          </label>
          <input
            type="number"
            min={1}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
            value={form.quantity}
            onChange={e => set('quantity', e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 block mb-1">
            単価（円） <span className="text-red-400">*</span>
          </label>
          <input
            type="number"
            min={0}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
            placeholder="0"
            value={form.unitPrice}
            onChange={e => set('unitPrice', e.target.value)}
          />
        </div>
        <div className="flex flex-col justify-end">
          <label className="text-xs font-semibold text-slate-500 block mb-1">金額（自動計算）</label>
          <div className="text-sm font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            ¥{amount.toLocaleString()}
          </div>
        </div>
      </div>

      {/* 任意フィールド */}
      <div className="border-t border-slate-100 pt-4">
        <p className="text-xs text-slate-400 font-medium mb-3">任意項目</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">購入日</label>
            <input
              type="date"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
              value={form.purchaseDate}
              onChange={e => set('purchaseDate', e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">購入先・業者名</label>
            <input
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
              placeholder="例：Amazon、ヨドバシカメラ"
              value={form.vendor}
              onChange={e => set('vendor', e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">型番・カタログ番号</label>
            <input
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
              placeholder="例：MGND3J/A"
              value={form.modelNumber}
              onChange={e => set('modelNumber', e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">領収書No.</label>
            <input
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
              placeholder="例：REC-2026-0042"
              value={form.receiptNo}
              onChange={e => set('receiptNo', e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">見積書No.</label>
            <input
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
              placeholder="例：EST-2026-0042"
              value={form.quotationNo}
              onChange={e => set('quotationNo', e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-slate-500 block mb-1">用途・目的</label>
            <input
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
              placeholder="例：研究室の実験用データ収集"
              value={form.purpose}
              onChange={e => set('purpose', e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-slate-500 block mb-1">参考URL</label>
            <input
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
              placeholder="例：https://www.amazon.co.jp/dp/..."
              value={form.url}
              onChange={e => set('url', e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-slate-500 block mb-1">備考</label>
            <textarea
              rows={2}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
              placeholder="特記事項など"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1 bg-amber-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-amber-700 disabled:opacity-40 transition-colors"
        >
          {saving ? '保存中...' : editItem ? '更新' : '追加'}
        </button>
        <button
          onClick={onCancel}
          className="flex-1 bg-slate-100 text-slate-600 text-sm py-2.5 rounded-xl hover:bg-slate-200 transition-colors"
        >
          キャンセル
        </button>
      </div>
    </div>
  )
}
