import { NextRequest, NextResponse } from 'next/server'

const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID!
const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET!
const BASE_URL = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
const REDIRECT_URI = `${BASE_URL}/api/auth/microsoft/callback`

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const returnTo = state ? decodeURIComponent(state) : '/expense'

  if (!code) {
    return NextResponse.redirect(`${BASE_URL}/expense?ms_error=no_code`)
  }

  const tokenRes = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  })

  const tokens = await tokenRes.json()
  if (!tokens.access_token) {
    return NextResponse.redirect(`${BASE_URL}/expense?ms_error=token_failed`)
  }

  const res = NextResponse.redirect(`${BASE_URL}${returnTo}`)
  res.cookies.set('ms_access_token', tokens.access_token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: tokens.expires_in ?? 3600,
    path: '/',
  })
  if (tokens.refresh_token) {
    res.cookies.set('ms_refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 30 * 24 * 3600,
      path: '/',
    })
  }

  return res
}
