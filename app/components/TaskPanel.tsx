'use client'

import { useState, useEffect, useCallback } from 'react'

type Task = { id: string; title: string; dueDate: string | null; completed: boolean }

export default function TaskPanel() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [newDue, setNewDue] = useState('')
  const [showInput, setShowInput] = useState(false)

  const loadTasks = useCallback(async () => {
    const res = await fetch('/api/tasks')
    const data = await res.json()
    setTasks(data)
  }, [])

  useEffect(() => { loadTasks() }, [loadTasks])

  const addTask = async () => {
    if (!newTitle.trim()) return
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle.trim(), dueDate: newDue || null }),
    })
    setNewTitle('')
    setNewDue('')
    setShowInput(false)
    loadTasks()
  }

  const toggleComplete = async (task: Task) => {
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !task.completed }),
    })
    loadTasks()
  }

  const deleteTask = async (id: string) => {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    loadTasks()
  }

  const today = new Date().toISOString().slice(0, 10)

  const isOverdue = (task: Task) =>
    !task.completed && task.dueDate && task.dueDate < today

  return (
    <div className="flex flex-col h-full p-3 gap-2">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <span className="text-xs font-bold text-slate-700">タスク</span>
        <button
          onClick={() => setShowInput((v) => !v)}
          className="w-5 h-5 flex items-center justify-center rounded-full bg-indigo-600 text-white text-sm hover:bg-indigo-700"
          title="タスクを追加"
        >+</button>
      </div>

      {/* Add task form */}
      {showInput && (
        <div className="shrink-0 flex flex-col gap-1">
          <input
            type="text"
            className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300"
            placeholder="タスク名..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTask()}
            autoFocus
          />
          <div className="flex gap-1 items-center">
            <input
              type="date"
              className="flex-1 text-[10px] border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-300 text-slate-600"
              value={newDue}
              onChange={(e) => setNewDue(e.target.value)}
            />
            <button
              onClick={addTask}
              className="text-[10px] bg-indigo-600 text-white rounded px-2 py-1 hover:bg-indigo-700"
            >追加</button>
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-1">
        {tasks.length === 0 && (
          <p className="text-[10px] text-slate-400 text-center mt-4">タスクはありません</p>
        )}
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`flex items-start gap-2 p-1.5 rounded-lg group transition-colors ${
              task.completed ? 'opacity-40' : isOverdue(task) ? 'bg-red-50' : 'hover:bg-slate-50'
            }`}
          >
            <button
              onClick={() => toggleComplete(task)}
              className={`mt-0.5 w-3.5 h-3.5 shrink-0 rounded border transition-colors ${
                task.completed
                  ? 'bg-indigo-500 border-indigo-500'
                  : isOverdue(task)
                  ? 'border-red-400'
                  : 'border-slate-300'
              } flex items-center justify-center`}
            >
              {task.completed && (
                <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
            <div className="flex-1 min-w-0">
              <p className={`text-[11px] leading-tight ${task.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                {task.title}
              </p>
              {task.dueDate && (
                <p className={`text-[10px] mt-0.5 ${isOverdue(task) ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                  {isOverdue(task) ? '期限切れ · ' : ''}{task.dueDate}
                </p>
              )}
            </div>
            <button
              onClick={() => deleteTask(task.id)}
              className="shrink-0 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all"
            >
              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
