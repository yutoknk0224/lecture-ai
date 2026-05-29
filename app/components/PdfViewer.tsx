'use client'

import { useEffect, useState, useRef } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfDoc = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfPage = any

function PdfPageCanvas({
  pdfDoc,
  pageNum,
  width,
  onClick,
  isActive,
  showLabel,
}: {
  pdfDoc: PdfDoc
  pageNum: number
  width: number
  onClick?: () => void
  isActive?: boolean
  showLabel?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let renderTask: any = null

    pdfDoc.getPage(pageNum).then((page: PdfPage) => {
      if (cancelled || !canvasRef.current) return

      const dpr = window.devicePixelRatio || 1
      const viewport = page.getViewport({ scale: 1 })
      const scale = (width / viewport.width) * dpr
      const scaledViewport = page.getViewport({ scale })

      const canvas = canvasRef.current
      canvas.width = Math.floor(scaledViewport.width)
      canvas.height = Math.floor(scaledViewport.height)
      canvas.style.width = `${width}px`
      canvas.style.height = `${Math.floor(scaledViewport.height / dpr)}px`

      const ctx = canvas.getContext('2d')
      if (!ctx || cancelled) return

      renderTask = page.render({ canvasContext: ctx, viewport: scaledViewport })
      renderTask.promise?.catch(() => {})
    })

    return () => {
      cancelled = true
      try {
        renderTask?.cancel()
      } catch { /* ignore */ }
    }
  }, [pdfDoc, pageNum, width])

  return (
    <div
      onClick={onClick}
      className={`rounded-lg overflow-hidden border-2 transition-all bg-white shadow-sm ${
        isActive
          ? 'border-indigo-500 shadow-md'
          : onClick
          ? 'border-transparent hover:border-indigo-300 hover:shadow-md cursor-pointer'
          : 'border-transparent'
      }`}
    >
      <canvas ref={canvasRef} className="block" />
      {showLabel && (
        <p className="text-center text-[10px] text-slate-400 py-1 bg-white select-none">{pageNum}</p>
      )}
    </div>
  )
}

export default function PdfViewer({ url }: { url: string }) {
  const [pdfDoc, setPdfDoc] = useState<PdfDoc | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [mode, setMode] = useState<'grid' | 'page'>('grid')
  const [currentPage, setCurrentPage] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mainContainerRef = useRef<HTMLDivElement>(null)
  const [mainWidth, setMainWidth] = useState(600)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let loadingTask: any = null

    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        setPdfDoc(null)

        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

        loadingTask = pdfjs.getDocument(url)
        const doc = await loadingTask.promise

        if (cancelled) {
          doc.destroy()
          return
        }

        setPdfDoc(doc)
        setNumPages(doc.numPages)
        setMode('grid')
        setCurrentPage(1)
        setLoading(false)
      } catch {
        if (!cancelled) {
          setError('PDFを読み込めませんでした')
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
      try {
        loadingTask?.destroy()
      } catch { /* ignore */ }
    }
  }, [url])

  useEffect(() => {
    if (mode !== 'page' || !mainContainerRef.current) return
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setMainWidth(Math.min(w - 40, 900))
    })
    observer.observe(mainContainerRef.current)
    // measure immediately
    setMainWidth(Math.min(mainContainerRef.current.clientWidth - 40, 900))
    return () => observer.disconnect()
  }, [mode])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-sm text-slate-400">PDFを読み込み中...</p>
      </div>
    )
  }

  if (error || !pdfDoc) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-sm text-red-400">{error ?? 'エラーが発生しました'}</p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-indigo-600 hover:underline"
        >
          ブラウザで開く →
        </a>
      </div>
    )
  }

  const pages = Array.from({ length: numPages }, (_, i) => i + 1)

  if (mode === 'grid') {
    return (
      <div className="h-full overflow-y-auto">
        <div className="sticky top-0 bg-white/90 backdrop-blur-sm z-10 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-600">{numPages} ページ</span>
          <span className="text-xs text-slate-400">クリックしてページを表示</span>
        </div>
        <div className="p-4 grid grid-cols-3 gap-3">
          {pages.map((n) => (
            <PdfPageCanvas
              key={n}
              pdfDoc={pdfDoc}
              pageNum={n}
              width={160}
              showLabel
              onClick={() => {
                setCurrentPage(n)
                setMode('page')
              }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Thumbnail sidebar */}
      <div className="w-20 bg-slate-50 border-r border-slate-200 overflow-y-auto py-2 px-1.5 space-y-1.5 shrink-0">
        {pages.map((n) => (
          <PdfPageCanvas
            key={n}
            pdfDoc={pdfDoc}
            pageNum={n}
            width={64}
            showLabel
            onClick={() => setCurrentPage(n)}
            isActive={n === currentPage}
          />
        ))}
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Nav bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-white shrink-0">
          <button
            onClick={() => setMode('grid')}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 px-2 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors font-medium"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            一覧
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 hover:text-indigo-600 disabled:text-slate-300 disabled:hover:bg-transparent transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-xs text-slate-600 font-medium tabular-nums px-1 select-none">
            {currentPage} / {numPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
            disabled={currentPage >= numPages}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 hover:text-indigo-600 disabled:text-slate-300 disabled:hover:bg-transparent transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <div className="h-4 w-px bg-slate-200 ml-auto" />
          {/* Zoom controls */}
          <button
            onClick={() => setZoom((z) => Math.max(0.5, parseFloat((z - 0.25).toFixed(2))))}
            disabled={zoom <= 0.5}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 hover:text-indigo-600 disabled:text-slate-300 disabled:hover:bg-transparent transition-colors text-base font-bold"
          >
            −
          </button>
          <button
            onClick={() => setZoom(1)}
            className="text-xs text-slate-500 hover:text-indigo-600 px-1.5 py-1 rounded-lg hover:bg-indigo-50 transition-colors tabular-nums font-medium min-w-[3rem] text-center"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={() => setZoom((z) => Math.min(4, parseFloat((z + 0.25).toFixed(2))))}
            disabled={zoom >= 4}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 hover:text-indigo-600 disabled:text-slate-300 disabled:hover:bg-transparent transition-colors text-base font-bold"
          >
            ＋
          </button>
        </div>

        {/* Page canvas */}
        <div
          ref={mainContainerRef}
          className="flex-1 overflow-auto bg-slate-100 p-4"
        >
          <div className="flex justify-center min-w-fit">
            {mainWidth > 0 && (
              <PdfPageCanvas
                key={`${currentPage}-${zoom}`}
                pdfDoc={pdfDoc}
                pageNum={currentPage}
                width={Math.round(mainWidth * zoom)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
