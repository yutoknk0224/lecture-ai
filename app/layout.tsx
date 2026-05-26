import type { Metadata } from 'next'
import { SessionProvider } from 'next-auth/react'
import './globals.css'

export const metadata: Metadata = {
  title: '講義資料管理 AI',
  description: '大学の授業資料をAIで管理・学習するアプリ',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja" className="h-full">
      <body className="min-h-full flex flex-col bg-slate-50">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
