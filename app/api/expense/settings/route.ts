import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

export async function GET() {
  const settings = await prisma.appSettings.findUnique({ where: { id: 'singleton' } })
  const profile = settings ? JSON.parse(settings.profileJson) : {}
  return NextResponse.json(profile)
}

export async function PUT(req: NextRequest) {
  const profile = await req.json()
  const settings = await prisma.appSettings.upsert({
    where: { id: 'singleton' },
    update: { profileJson: JSON.stringify(profile) },
    create: { id: 'singleton', profileJson: JSON.stringify(profile) },
  })
  return NextResponse.json(JSON.parse(settings.profileJson))
}
