'use client'

import { useState, useEffect } from 'react'

const CATEGORIES = ['交通費', '宿泊費', '日当', '食費', '通信費', 'その他']

type Item = {
  id: string
  date: string
  purpose: string
  destination: string
  departure: string
  transport: string
  amount: number
  category: string
  notes: string
}

type Props = {
  reportId: string
  editItem?: Item | null
  onSaved: () => void
  onCancel: () => void
}

export default function ItemForm({ reportId, editItem, onSaved, onCancel }: Props) {
  const [date, setDate] = useState('')
  const [purpose, setPurpose] = useState('')
  const [destination, setDestination] = useState('')
  const [departure, setDeparture] = useState('')
  const [transport, setTransport] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('交通費')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (editItem) {
      setDate(editItem.date)
      setPurpose(editItem.purpose)
      setDestination(editItem.destination)
      setDeparture(editItem.departure)
      setTransport(editItem.transport)
      setAmount(String(editItem.amount))
      setCategory(editItem.category)
      setNotes(editItem.notes)
    }
  }, [editItem])

  const handleSave = async () => {
    if (!date || !purpose || !destination || !amount) return
    const payload = { reportId, date, purpose, destination, departure, transport, amount: Number(amount), category, notes }
    if (editItem) {
      await fetch(`/api/expense/items/${editItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } else {
      await fetch('/api/expense/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }
    onSaved()
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-700">
        {editItem ? '明細を編集' : '明細を追加'}
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-500 block mb-1">日付 *</label>
          <input
            type="date"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">費目</label>
          <select
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-xs text-slate-500 block mb-1">目的 *</label>
          <input
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            placeholder="例：学会参加"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">出発地</label>
          <input
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            placeholder="例：東京"
            value={departure}
            onChange={(e) => setDeparture(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">目的地 *</label>
          <input
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            placeholder="例：大阪"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">交通手段</label>
          <input
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            placeholder="例：新幹線"
            value={transport}
            onChange={(e) => setTransport(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">金額（円） *</label>
          <input
            type="number"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            placeholder="例：13500"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-slate-500 block mb-1">備考</label>
          <input
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            placeholder="メモ"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          className="flex-1 bg-indigo-600 text-white text-sm rounded-lg py-2 hover:bg-indigo-700 font-medium"
        >
          {editItem ? '更新' : '追加'}
        </button>
        <button
          onClick={onCancel}
          className="flex-1 bg-slate-200 text-slate-600 text-sm rounded-lg py-2 hover:bg-slate-300"
        >
          キャンセル
        </button>
      </div>
    </div>
  )
}
