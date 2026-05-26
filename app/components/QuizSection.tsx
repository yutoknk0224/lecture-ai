'use client'

import { useState, Fragment } from 'react'

type QuizFormat = 'multiple-choice' | 'short-answer' | 'fill-in-blank' | 'table' | 'essay'
type Difficulty = 'easy' | 'normal' | 'hard'

type MCQuestion = {
  type: 'multiple-choice'
  question: string
  options: string[]
  answer: number
  explanation: string
  source?: string
  sourceTitle?: string
}

type SAQuestion = {
  type: 'short-answer'
  question: string
  answer: string
  keywords: string[]
  explanation: string
  source?: string
  sourceTitle?: string
}

type FIBQuestion = {
  type: 'fill-in-blank'
  text: string
  blanks: string[]
  hint?: string
  explanation: string
  source?: string
  sourceTitle?: string
}

type DiagramNode = {
  id: string
  label: string
  type: 'normal' | 'blank'
  answer?: string
}

type DiagramEdge = {
  from: string
  to: string
  label?: string
}

type DiagramQuestion = {
  type: 'table'
  title: string
  nodes: DiagramNode[]
  edges: DiagramEdge[]
  layout: 'linear' | 'cycle'
  explanation: string
  source?: string
  sourceTitle?: string
}

type EssayQuestion = {
  type: 'essay'
  question: string
  keyPoints: string[]
  sampleAnswer: string
  explanation: string
  source?: string
  sourceTitle?: string
}

type Question = MCQuestion | SAQuestion | FIBQuestion | DiagramQuestion | EssayQuestion

const DIFFICULTIES: { id: Difficulty; label: string; desc: string; color: string }[] = [
  { id: 'easy', label: '基礎', desc: '用語・定義の確認', color: 'emerald' },
  { id: 'normal', label: '標準', desc: '理解・因果関係', color: 'indigo' },
  { id: 'hard', label: '発展', desc: '応用・複合考察', color: 'rose' },
]

const FORMATS: { id: QuizFormat; label: string; desc: string }[] = [
  { id: 'multiple-choice', label: '4択', desc: '選択肢から選ぶ' },
  { id: 'short-answer', label: '一問一答', desc: 'キーワードを答える' },
  { id: 'fill-in-blank', label: '穴埋め', desc: '空欄に語句を入れる' },
  { id: 'table', label: '概念図', desc: '図の空欄を埋める' },
  { id: 'essay', label: '記述', desc: '文章で説明する' },
]

// ---- Self Evaluation ----
type SelfEval = 'correct' | 'partial' | 'wrong'

function SelfEvalButtons({ onEval }: { onEval: (e: SelfEval) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2 mt-3">
      <button onClick={() => onEval('correct')}
        className="bg-emerald-100 text-emerald-700 py-2 rounded-lg text-xs font-semibold hover:bg-emerald-200 transition-colors">
        ✓ 正解
      </button>
      <button onClick={() => onEval('partial')}
        className="bg-amber-100 text-amber-700 py-2 rounded-lg text-xs font-semibold hover:bg-amber-200 transition-colors">
        △ 大体合ってた
      </button>
      <button onClick={() => onEval('wrong')}
        className="bg-red-100 text-red-700 py-2 rounded-lg text-xs font-semibold hover:bg-red-200 transition-colors">
        ✗ 不正解
      </button>
    </div>
  )
}

function SelfEvalBadge({ e }: { e: SelfEval }) {
  const cfg: Record<SelfEval, { label: string; cls: string }> = {
    correct: { label: '✓ 正解として記録しました', cls: 'bg-emerald-50 text-emerald-700' },
    partial: { label: '△ 大体理解として記録しました', cls: 'bg-amber-50 text-amber-700' },
    wrong:   { label: '✗ 要復習として記録しました', cls: 'bg-red-50 text-red-700' },
  }
  return <div className={`mt-2 text-xs px-3 py-2 rounded-lg ${cfg[e].cls}`}>{cfg[e].label}</div>
}

function MaterialBadge({ title }: { title?: string }) {
  if (!title) return null
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-500 border border-indigo-100 px-2 py-0.5 rounded-full mb-2 max-w-full truncate">
      <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      {title}
    </span>
  )
}

function SourceCitation({ source, sourceTitle }: { source?: string; sourceTitle?: string }) {
  if (!source) return null
  return (
    <div className="mt-2 text-xs bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
      <div className="flex items-center gap-2 mb-1.5">
        <p className="font-semibold text-slate-500">📄 資料の該当箇所</p>
        {sourceTitle && (
          <span className="bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-medium">
            {sourceTitle}
          </span>
        )}
      </div>
      <p className="text-slate-600 italic leading-relaxed border-l-2 border-slate-300 pl-3">「{source}」</p>
    </div>
  )
}

// ---- MC Question ----
function MCCard({
  q,
  index,
  onResult,
}: {
  q: MCQuestion
  index: number
  onResult: (i: number, correct: boolean) => void
}) {
  const [selected, setSelected] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = () => {
    if (selected === null) return
    setSubmitted(true)
    onResult(index, selected === q.answer)
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <span className="w-7 h-7 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <MaterialBadge title={q.sourceTitle} />
          <p className="font-medium text-slate-800 text-sm leading-relaxed">{q.question}</p>
        </div>
      </div>
      <div className="space-y-2 ml-10">
        {q.options.map((opt, oi) => {
          const isSelected = selected === oi
          const isCorrect = submitted && oi === q.answer
          const isWrong = submitted && isSelected && oi !== q.answer
          return (
            <button
              key={oi}
              onClick={() => !submitted && setSelected(oi)}
              className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-all ${
                isCorrect
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-medium'
                  : isWrong
                  ? 'bg-red-50 border-red-300 text-red-800'
                  : isSelected
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-800 font-medium'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <span className="font-medium mr-2">{String.fromCharCode(65 + oi)}.</span>
              {opt}
              {isCorrect && <span className="ml-2 text-emerald-600">✓</span>}
              {isWrong && <span className="ml-2 text-red-500">✗</span>}
            </button>
          )
        })}
      </div>
      {!submitted ? (
        <button
          onClick={handleSubmit}
          disabled={selected === null}
          className="mt-4 ml-10 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
        >
          確認する
        </button>
      ) : (
        <div className="mt-3 ml-10 space-y-2">
          <div className="text-xs text-slate-600 bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
            <span className="font-semibold">解説：</span>{q.explanation}
          </div>
          <SourceCitation source={q.source} sourceTitle={q.sourceTitle} />
        </div>
      )}
    </div>
  )
}

// ---- Short Answer Question ----
function SACard({
  q,
  index,
  onResult,
}: {
  q: SAQuestion
  index: number
  onResult: (i: number, correct: boolean) => void
}) {
  const [input, setInput] = useState('')
  const [phase, setPhase] = useState<'input' | 'review' | 'done'>('input')
  const [selfEval, setSelfEval] = useState<SelfEval | null>(null)

  const handleEval = (e: SelfEval) => {
    setSelfEval(e)
    setPhase('done')
    onResult(index, e !== 'wrong')
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <span className="w-7 h-7 bg-violet-100 text-violet-700 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <MaterialBadge title={q.sourceTitle} />
          <p className="font-medium text-slate-800 text-sm leading-relaxed">{q.question}</p>
        </div>
      </div>
      <div className="ml-10">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && phase === 'input' && input.trim() && setPhase('review')}
          disabled={phase !== 'input'}
          placeholder="答えを入力してください"
          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:bg-slate-50"
        />
        {phase === 'input' && (
          <button
            onClick={() => setPhase('review')}
            disabled={!input.trim()}
            className="mt-3 bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-40 transition-colors"
          >
            確認する
          </button>
        )}
        {phase !== 'input' && (
          <div className="mt-3 space-y-2">
            <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3 text-xs space-y-2">
              <div className="flex gap-3">
                <span className="text-slate-400 shrink-0 w-20">あなたの回答</span>
                <span className="text-slate-700">{input || '（未入力）'}</span>
              </div>
              <div className="flex gap-3 border-t border-slate-200 pt-2">
                <span className="text-slate-400 shrink-0 w-20 font-semibold">正解</span>
                <span className="text-emerald-700 font-semibold">{q.answer}</span>
              </div>
            </div>
            <div className="text-xs text-slate-600 bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
              <span className="font-semibold">解説：</span>{q.explanation}
            </div>
            <SourceCitation source={q.source} sourceTitle={q.sourceTitle} />
            {phase === 'review' && <SelfEvalButtons onEval={handleEval} />}
            {phase === 'done' && selfEval && <SelfEvalBadge e={selfEval} />}
          </div>
        )}
      </div>
    </div>
  )
}

// ---- Fill in Blank Question ----
function FIBCard({
  q,
  index,
  onResult,
}: {
  q: FIBQuestion
  index: number
  onResult: (i: number, correct: boolean) => void
}) {
  const segments = q.text.split('___')
  const [inputs, setInputs] = useState<string[]>(q.blanks.map(() => ''))
  const [phase, setPhase] = useState<'input' | 'review' | 'done'>('input')
  const [selfEval, setSelfEval] = useState<SelfEval | null>(null)

  // auto-grade per blank for reference display
  const perBlank = phase !== 'input'
    ? q.blanks.map((blank, i) => inputs[i].trim().toLowerCase() === blank.toLowerCase())
    : []

  const handleEval = (e: SelfEval) => {
    setSelfEval(e)
    setPhase('done')
    onResult(index, e !== 'wrong')
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <span className="w-7 h-7 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
          {index + 1}
        </span>
        <div className="flex-1">
          <MaterialBadge title={q.sourceTitle} />
          <p className="text-xs text-slate-400 mb-2">空欄を埋めてください</p>
          {q.hint && (
            <div className="mb-3 flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <span className="text-amber-500 text-xs font-bold shrink-0 mt-0.5">ヒント</span>
              <span className="text-xs text-amber-700 leading-relaxed">{q.hint}</span>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1 text-sm text-slate-800 leading-relaxed">
            {segments.map((seg, si) => (
              <Fragment key={si}>
                {seg && <span>{seg}</span>}
                {si < q.blanks.length && (
                  <input
                    type="text"
                    value={inputs[si]}
                    onChange={(e) => {
                      if (phase !== 'input') return
                      const next = [...inputs]
                      next[si] = e.target.value
                      setInputs(next)
                    }}
                    disabled={phase !== 'input'}
                    className={`w-28 border-b-2 text-center text-sm px-1 py-0.5 focus:outline-none bg-transparent ${
                      phase !== 'input'
                        ? perBlank[si]
                          ? 'border-emerald-400 text-emerald-700'
                          : 'border-red-400 text-red-700'
                        : 'border-amber-400 focus:border-amber-600'
                    }`}
                  />
                )}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
      {phase === 'input' ? (
        <button
          onClick={() => setPhase('review')}
          disabled={inputs.some((v) => !v.trim())}
          className="ml-10 bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-40 transition-colors"
        >
          確認する
        </button>
      ) : (
        <div className="mt-4 ml-10 space-y-2">
          <div className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            <p className="font-semibold text-slate-600 mb-2">空欄の答え合わせ（参考）</p>
            {q.blanks.map((blank, i) => (
              <div key={i} className="flex items-center gap-2 mt-1">
                <span className={`px-1.5 py-0.5 rounded font-medium ${perBlank[i] ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {perBlank[i] ? '✓' : '✗'} 空欄{i + 1}
                </span>
                <span className="text-emerald-700 font-semibold">{blank}</span>
                {!perBlank[i] && <span className="text-slate-400">（あなた：{inputs[i]}）</span>}
              </div>
            ))}
          </div>
          <div className="text-xs text-slate-600 bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
            <span className="font-semibold">解説：</span>{q.explanation}
          </div>
          <SourceCitation source={q.source} sourceTitle={q.sourceTitle} />
          {phase === 'review' && <SelfEvalButtons onEval={handleEval} />}
          {phase === 'done' && selfEval && <SelfEvalBadge e={selfEval} />}
        </div>
      )}
    </div>
  )
}

// ---- Diagram Question ----
const DW = 136, DH = 60, DR = 12
const BLANK_LABELS = ['①', '②', '③', '④', '⑤']

function calcDiagramPositions(
  nodes: DiagramNode[],
  layout: string
): Record<string, { x: number; y: number }> {
  const pos: Record<string, { x: number; y: number }> = {}
  if (layout === 'cycle') {
    const cx = 250, cy = 155, r = 110
    nodes.forEach((n, i) => {
      const a = (2 * Math.PI * i / nodes.length) - Math.PI / 2
      pos[n.id] = { x: cx + r * Math.cos(a) - DW / 2, y: cy + r * Math.sin(a) - DH / 2 }
    })
  } else {
    const gap = 60
    const totalW = nodes.length * DW + (nodes.length - 1) * gap
    const svgW = Math.max(520, totalW + 80)
    const startX = (svgW - totalW) / 2
    nodes.forEach((n, i) => {
      pos[n.id] = { x: startX + i * (DW + gap), y: 58 }
    })
  }
  return pos
}

function calcDiagramSVG(nodes: DiagramNode[], layout: string) {
  if (layout === 'cycle') return { w: 500, h: 330 }
  const gap = 60
  const totalW = nodes.length * DW + (nodes.length - 1) * gap
  return { w: Math.max(520, totalW + 80), h: 176 }
}

function getEdgeLine(fp: { x: number; y: number }, tp: { x: number; y: number }) {
  const fx = fp.x + DW / 2, fy = fp.y + DH / 2
  const tx = tp.x + DW / 2, ty = tp.y + DH / 2
  const dx = tx - fx, dy = ty - fy
  const dist = Math.hypot(dx, dy)
  if (!dist) return null
  const ux = dx / dist, uy = dy / dist
  const hw = DW / 2 + 3, hh = DH / 2 + 3
  const t = Math.abs(ux) > 0 && Math.abs(uy) > 0
    ? Math.min(hw / Math.abs(ux), hh / Math.abs(uy))
    : Math.abs(ux) > 0 ? hw / Math.abs(ux) : hh / Math.abs(uy)
  return { x1: fx + ux * t, y1: fy + uy * t, x2: tx - ux * t, y2: ty - uy * t, midX: (fx + tx) / 2, midY: (fy + ty) / 2 }
}

function DiagramCard({
  q,
  index,
  onResult,
}: {
  q: DiagramQuestion
  index: number
  onResult: (i: number, correct: boolean) => void
}) {
  const nodes = q.nodes ?? []
  const edges = q.edges ?? []
  const layout = q.layout ?? 'linear'
  const blanks = nodes.filter(n => n.type === 'blank')
  const blankIndexMap = Object.fromEntries(blanks.map((b, i) => [b.id, i]))

  const [inputs, setInputs] = useState<Record<string, string>>(
    Object.fromEntries(blanks.map(b => [b.id, '']))
  )
  const [phase, setPhase] = useState<'input' | 'review' | 'done'>('input')
  const [selfEval, setSelfEval] = useState<SelfEval | null>(null)

  const perBlank: Record<string, boolean> = phase !== 'input'
    ? Object.fromEntries(blanks.map(b => [
        b.id,
        (inputs[b.id] ?? '').trim().toLowerCase() === (b.answer ?? '').toLowerCase(),
      ]))
    : {}

  const positions = calcDiagramPositions(nodes, layout)
  const { w: svgW, h: svgH } = calcDiagramSVG(nodes, layout)
  const markerId = `arrowhead-${index}`
  const allFilled = blanks.every(b => (inputs[b.id] ?? '').trim())

  const handleEval = (e: SelfEval) => {
    setSelfEval(e)
    setPhase('done')
    onResult(index, e !== 'wrong')
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-start gap-3 mb-3">
        <span className="w-7 h-7 bg-cyan-100 text-cyan-700 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <MaterialBadge title={q.sourceTitle} />
          <p className="text-sm font-semibold text-slate-700">{q.title}</p>
        </div>
      </div>

      {/* SVG diagram — inputs are BELOW, not inside the SVG */}
      <div className="overflow-x-auto rounded-xl bg-slate-50 border border-slate-100 py-2 mb-4">
        <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', maxWidth: svgW, display: 'block', margin: '0 auto' }}>
          <defs>
            <marker id={markerId} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
            </marker>
          </defs>

          {/* Edges */}
          {edges.map((edge, ei) => {
            const fp = positions[edge.from], tp = positions[edge.to]
            if (!fp || !tp) return null
            const line = getEdgeLine(fp, tp)
            if (!line) return null
            return (
              <g key={ei}>
                <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                  stroke="#94a3b8" strokeWidth="1.5" markerEnd={`url(#${markerId})`} />
                {edge.label && (
                  <text x={line.midX} y={line.midY - 8} textAnchor="middle" fontSize="10" fill="#64748b">
                    {edge.label}
                  </text>
                )}
              </g>
            )
          })}

          {/* Nodes */}
          {nodes.map(node => {
            const pos = positions[node.id]
            if (!pos) return null
            const isBlank = node.type === 'blank'
            const bi = blankIndexMap[node.id] ?? 0

            if (isBlank && phase === 'input') {
              return (
                <g key={node.id}>
                  <rect x={pos.x} y={pos.y} width={DW} height={DH} rx={DR}
                    fill="#fffbeb" stroke="#fbbf24" strokeWidth="2" strokeDasharray="5 3" />
                  <text x={pos.x + DW / 2} y={pos.y + DH / 2 + 8}
                    textAnchor="middle" fontSize="22" fontWeight="800" fill="#b45309">
                    {BLANK_LABELS[bi] ?? '?'}
                  </text>
                </g>
              )
            }

            if (isBlank && phase !== 'input') {
              const correct = perBlank[node.id]
              return (
                <g key={node.id}>
                  <rect x={pos.x} y={pos.y} width={DW} height={DH} rx={DR}
                    fill={correct ? '#f0fdf4' : '#fef2f2'}
                    stroke={correct ? '#4ade80' : '#f87171'}
                    strokeWidth="2" />
                  <text x={pos.x + DW / 2} y={pos.y + 18}
                    textAnchor="middle" fontSize="10" fontWeight="700"
                    fill={correct ? '#16a34a' : '#dc2626'}>
                    {BLANK_LABELS[bi]} {correct ? '✓' : '✗'}
                  </text>
                  <foreignObject x={pos.x + 4} y={pos.y + 22} width={DW - 8} height={DH - 26}>
                    <div style={{
                      width: '100%', height: '100%', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: '11px', fontWeight: '700',
                      color: correct ? '#15803d' : '#dc2626', textAlign: 'center',
                      lineHeight: '1.2', overflowWrap: 'break-word',
                    }}>
                      {node.answer}
                    </div>
                  </foreignObject>
                </g>
              )
            }

            // Normal node — foreignObject for text wrapping
            return (
              <g key={node.id}>
                <rect x={pos.x} y={pos.y} width={DW} height={DH} rx={DR}
                  fill="#eef2ff" stroke="#a5b4fc" strokeWidth="1.5" />
                <foreignObject x={pos.x + 6} y={pos.y + 4} width={DW - 12} height={DH - 8}>
                  <div style={{
                    width: '100%', height: '100%', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '11px', fontWeight: '700',
                    color: '#4338ca', textAlign: 'center', lineHeight: '1.3',
                    overflowWrap: 'break-word',
                  }}>
                    {node.label}
                  </div>
                </foreignObject>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Input fields below SVG (input phase only) */}
      {phase === 'input' && (
        <div className="space-y-2 mb-3">
          {blanks.map((b, i) => (
            <div key={b.id} className="flex items-center gap-2">
              <span className="w-8 h-8 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center text-base font-bold shrink-0">
                {BLANK_LABELS[i]}
              </span>
              <input
                type="text"
                value={inputs[b.id] ?? ''}
                onChange={e => setInputs(p => ({ ...p, [b.id]: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing && allFilled) setPhase('review')
                }}
                placeholder={`空欄 ${BLANK_LABELS[i]} の答えを入力`}
                className="flex-1 border border-amber-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-amber-50"
              />
            </div>
          ))}
          <button
            onClick={() => setPhase('review')}
            disabled={!allFilled}
            className="mt-1 bg-cyan-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-cyan-700 disabled:opacity-40 transition-colors"
          >
            確認する
          </button>
        </div>
      )}

      {/* Review / done phase */}
      {phase !== 'input' && (
        <div className="space-y-2">
          <div className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            <p className="font-semibold text-slate-600 mb-2">空欄の答え合わせ（参考）</p>
            {blanks.map((b, i) => (
              <div key={b.id} className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`px-2 py-0.5 rounded font-bold ${perBlank[b.id] ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {BLANK_LABELS[i]} {perBlank[b.id] ? '✓' : '✗'}
                </span>
                <span className="text-emerald-700 font-semibold">{b.answer}</span>
                {!perBlank[b.id] && (
                  <span className="text-slate-400">（あなた：{inputs[b.id] || '未入力'}）</span>
                )}
              </div>
            ))}
          </div>
          <div className="text-xs text-slate-600 bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
            <span className="font-semibold">解説：</span>{q.explanation}
          </div>
          <SourceCitation source={q.source} sourceTitle={q.sourceTitle} />
          {phase === 'review' && <SelfEvalButtons onEval={handleEval} />}
          {phase === 'done' && selfEval && <SelfEvalBadge e={selfEval} />}
        </div>
      )}
    </div>
  )
}

// ---- Essay Question ----
function EssayCard({
  q,
  index,
  onResult,
}: {
  q: EssayQuestion
  index: number
  onResult: (i: number, correct: boolean) => void
}) {
  const [text, setText] = useState('')
  const [showAnswer, setShowAnswer] = useState(false)
  const [selfScore, setSelfScore] = useState<'good' | 'poor' | null>(null)

  const handleSelfScore = (score: 'good' | 'poor') => {
    setSelfScore(score)
    onResult(index, score === 'good')
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <span className="w-7 h-7 bg-rose-100 text-rose-700 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
          {index + 1}
        </span>
        <div className="flex-1">
          <MaterialBadge title={q.sourceTitle} />
          <p className="font-medium text-slate-800 text-sm leading-relaxed mb-3">{q.question}</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            <span className="text-xs text-slate-500">キーポイント：</span>
            {q.keyPoints.map((kp, i) => (
              <span key={i} className="text-xs bg-rose-50 text-rose-600 border border-rose-200 px-2 py-0.5 rounded-full">
                {kp}
              </span>
            ))}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="ここに解答を記述してください..."
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setShowAnswer(!showAnswer)}
              className="flex-1 bg-slate-100 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              {showAnswer ? '解答例を隠す' : '解答例を見る'}
            </button>
            {showAnswer && !selfScore && (
              <>
                <button
                  onClick={() => handleSelfScore('good')}
                  className="flex-1 bg-emerald-100 text-emerald-700 py-2 rounded-lg text-sm font-medium hover:bg-emerald-200 transition-colors"
                >
                  ✓ 理解できた
                </button>
                <button
                  onClick={() => handleSelfScore('poor')}
                  className="flex-1 bg-amber-100 text-amber-700 py-2 rounded-lg text-sm font-medium hover:bg-amber-200 transition-colors"
                >
                  △ もう一度
                </button>
              </>
            )}
          </div>
          {showAnswer && (
            <div className="mt-3 space-y-2">
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-sm text-slate-700 leading-relaxed">
                <p className="text-xs font-bold text-slate-500 mb-2">模範解答</p>
                {q.sampleAnswer}
                <p className="text-xs text-slate-400 mt-2 border-t border-slate-200 pt-2">補足：{q.explanation}</p>
              </div>
              <SourceCitation source={q.source} sourceTitle={q.sourceTitle} />
            </div>
          )}
          {selfScore && (
            <div className={`mt-2 text-xs px-3 py-2 rounded-lg ${selfScore === 'good' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              {selfScore === 'good' ? '✓ 理解済みとして記録しました' : '△ 要復習として記録しました'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---- Main QuizSection ----
type Props = {
  materialId?: string
  materialIds?: string[]
  hasText: boolean
}

function normalizeQuestion(raw: Record<string, unknown>, format: QuizFormat): Question {
  if (format === 'multiple-choice') {
    return { type: 'multiple-choice', ...raw } as unknown as MCQuestion
  }
  if (format === 'short-answer') {
    return { type: 'short-answer', keywords: [], ...raw } as unknown as SAQuestion
  }
  if (format === 'fill-in-blank') {
    return { type: 'fill-in-blank', blanks: [], ...raw } as unknown as FIBQuestion
  }
  if (format === 'table') {
    return { type: 'table', nodes: [], edges: [], layout: 'linear', ...raw } as unknown as DiagramQuestion
  }
  return { type: 'essay', keyPoints: [], ...raw } as unknown as EssayQuestion
}

export default function QuizSection({ materialId, materialIds, hasText }: Props) {
  const [format, setFormat] = useState<QuizFormat>('multiple-choice')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [count, setCount] = useState(3)
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<(boolean | null)[]>([])
  const [error, setError] = useState<string | null>(null)

  const isMulti = materialIds && materialIds.length > 0

  const handleResult = (i: number, correct: boolean) => {
    setResults((prev) => {
      const next = [...prev]
      next[i] = correct
      return next
    })
  }

  const allAnswered = results.length === questions.length && results.every((r) => r !== null)
  const score = results.filter((r) => r === true).length

  const generate = async () => {
    setLoading(true)
    setQuestions([])
    setResults([])
    setError(null)
    try {
      let res: Response
      if (isMulti) {
        res = await fetch('/api/quiz/multi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ materialIds, count, format, difficulty }),
        })
      } else {
        res = await fetch(`/api/quiz/${materialId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ count, format, difficulty }),
        })
      }
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '生成に失敗しました')
        return
      }
      const raw = typeof data.questions === 'string' ? JSON.parse(data.questions) : data.questions
      const parsed: Question[] = raw.map((q: Record<string, unknown>) => normalizeQuestion(q, format))
      setQuestions(parsed)
      setResults(new Array(parsed.length).fill(null))
    } catch {
      setError('通信エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-5">
      {/* Format selector */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">問題形式</p>
        <div className="grid grid-cols-5 gap-2">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              onClick={() => { setFormat(f.id); setQuestions([]); setResults([]) }}
              className={`flex flex-col items-center py-3 px-2 rounded-xl border text-xs font-medium transition-all ${
                format === f.id
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-200 hover:text-indigo-600'
              }`}
            >
              <span className="font-bold text-sm mb-0.5">{f.label}</span>
              <span className={`text-center leading-tight ${format === f.id ? 'text-indigo-200' : 'text-slate-400'}`} style={{ fontSize: '10px' }}>
                {f.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Difficulty selector */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">難易度</p>
        <div className="grid grid-cols-3 gap-2">
          {DIFFICULTIES.map((d) => {
            const active = difficulty === d.id
            const styles: Record<Difficulty, { active: string; inactive: string }> = {
              easy:   { active: 'bg-emerald-600 text-white border-emerald-600 shadow-sm', inactive: 'bg-white text-slate-500 border-slate-200 hover:border-emerald-200 hover:text-emerald-600' },
              normal: { active: 'bg-indigo-600 text-white border-indigo-600 shadow-sm', inactive: 'bg-white text-slate-500 border-slate-200 hover:border-indigo-200 hover:text-indigo-600' },
              hard:   { active: 'bg-rose-600 text-white border-rose-600 shadow-sm', inactive: 'bg-white text-slate-500 border-slate-200 hover:border-rose-200 hover:text-rose-600' },
            }
            return (
              <button
                key={d.id}
                onClick={() => { setDifficulty(d.id); setQuestions([]); setResults([]) }}
                className={`flex flex-col items-center py-3 px-2 rounded-xl border text-xs font-medium transition-all ${active ? styles[d.id].active : styles[d.id].inactive}`}
              >
                <span className="font-bold text-sm mb-0.5">{d.label}</span>
                <span className={`text-center leading-tight ${active ? 'opacity-80' : 'text-slate-400'}`} style={{ fontSize: '10px' }}>
                  {d.desc}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Generate controls */}
      <div className="flex items-center gap-3">
        <select
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          {[2, 3, 5].map((n) => (
            <option key={n} value={n}>{n}問</option>
          ))}
        </select>
        <button
          onClick={generate}
          disabled={loading || !hasText}
          className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              生成中...
            </>
          ) : (
            <>問題を生成する</>
          )}
        </button>
      </div>

      {!hasText && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          テキストが抽出されていません。要約タブから「AIで再処理する」を実行してください。
        </p>
      )}

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
      )}

      {/* Questions */}
      {questions.length > 0 && (
        <div className="space-y-4">
          {questions.map((q, i) => {
            if (q.type === 'multiple-choice') {
              return <MCCard key={i} q={q} index={i} onResult={handleResult} />
            }
            if (q.type === 'short-answer') {
              return <SACard key={i} q={q} index={i} onResult={handleResult} />
            }
            if (q.type === 'fill-in-blank') {
              return <FIBCard key={i} q={q} index={i} onResult={handleResult} />
            }
            if (q.type === 'table') {
              return <DiagramCard key={i} q={q} index={i} onResult={handleResult} />
            }
            if (q.type === 'essay') {
              return <EssayCard key={i} q={q} index={i} onResult={handleResult} />
            }
            return null
          })}

          {/* Score */}
          {allAnswered && format !== 'essay' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center shadow-sm">
              <div className={`text-5xl font-bold mb-1 ${score === questions.length ? 'text-emerald-600' : score >= questions.length / 2 ? 'text-amber-600' : 'text-rose-600'}`}>
                {score}<span className="text-2xl text-slate-400">/{questions.length}</span>
              </div>
              <p className="text-sm text-slate-500 mb-4">
                正解率 {Math.round((score / questions.length) * 100)}%
                {score === questions.length && ' 🎉 満点！'}
              </p>
              <button
                onClick={generate}
                className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                もう一度生成する
              </button>
            </div>
          )}

          {allAnswered && format === 'essay' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center shadow-sm">
              <p className="text-sm font-semibold text-slate-700 mb-3">
                理解できた：{score}/{questions.length}問
              </p>
              <button onClick={generate} className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">
                別の問題を生成する
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
