import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    reportId, itemName, quantity, unitPrice,
    category, purchaseDate, vendor, receiptNo, modelNumber, purpose, notes, url, quotationNo,
  } = body

  if (!reportId || !itemName || quantity == null || unitPrice == null) {
    return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
  }

  const qty = parseInt(quantity)
  const price = parseInt(unitPrice)
  const amount = qty * price

  const item = await prisma.equipmentItem.create({
    data: {
      reportId,
      itemName,
      quantity: qty,
      unitPrice: price,
      amount,
      category: category ?? '',
      purchaseDate: purchaseDate ?? '',
      vendor: vendor ?? '',
      receiptNo: receiptNo ?? '',
      modelNumber: modelNumber ?? '',
      purpose: purpose ?? '',
      notes: notes ?? '',
      url: url ?? '',
      quotationNo: quotationNo ?? '',
    },
  })
  return NextResponse.json(item, { status: 201 })
}
