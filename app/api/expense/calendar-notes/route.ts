import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') // YYYY-MM

  const where = month
    ? { date: { startsWith: month } }
    : {}

  const notes = await prisma.calendarNote.findMany({
    where,
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(notes)
}

export async function POST(req: NextRequest) {
  const { date, content, color } = await req.json()
  if (!date || !content?.trim()) {
    return NextResponse.json({ error: '日付と内容は必須です' }, { status: 400 })
  }
  const note = await prisma.calendarNote.create({
    data: { date, content: content.trim(), color: color ?? '#6366f1' },
  })
  return NextResponse.json(note, { status: 201 })
}
