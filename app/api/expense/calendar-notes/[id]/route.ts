import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { content, color } = await req.json()
  const note = await prisma.calendarNote.update({
    where: { id },
    data: {
      ...(content !== undefined && { content: content.trim() }),
      ...(color !== undefined && { color }),
    },
  })
  return NextResponse.json(note)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.calendarNote.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
