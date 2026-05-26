import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get('google_access_token')?.value
  if (!accessToken) return NextResponse.json({ authenticated: false })

  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (res.ok) {
    const user = await res.json() as { email?: string; name?: string }
    return NextResponse.json({
      authenticated: true,
      email: user.email ?? '',
      name: user.name ?? '',
    })
  }

  return NextResponse.json({ authenticated: false })
}
