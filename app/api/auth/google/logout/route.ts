import { NextResponse } from 'next/server'

export async function GET() {
  const res = NextResponse.redirect('http://localhost:3000/expense')
  res.cookies.delete('google_access_token')
  res.cookies.delete('google_refresh_token')
  return res
}
