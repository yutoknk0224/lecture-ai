import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get('ms_access_token')?.value
  if (!accessToken) return NextResponse.json({ authenticated: false })

  const res = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (res.ok) {
    const user = await res.json()
    return NextResponse.json({
      authenticated: true,
      email: user.mail ?? user.userPrincipalName ?? '',
      displayName: user.displayName ?? '',
    })
  }

  return NextResponse.json({ authenticated: false })
}
