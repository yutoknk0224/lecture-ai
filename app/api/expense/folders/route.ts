import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

export async function GET() {
  const folders = await prisma.expenseFolder.findMany({
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(folders)
}

export async function POST(req: NextRequest) {
  const { name, color } = await req.json()
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  const folder = await prisma.expenseFolder.create({
    data: { name, color: color ?? '#6366f1' },
  })
  return NextResponse.json(folder, { status: 201 })
}
