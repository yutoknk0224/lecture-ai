import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import path from 'path'
import fs from 'fs'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const attachment = await prisma.expenseAttachment.findUnique({ where: { id } })
  if (!attachment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const filePath = path.join(process.cwd(), 'public', attachment.filePath)
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)

  await prisma.expenseAttachment.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
