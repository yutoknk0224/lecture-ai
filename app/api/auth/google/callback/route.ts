import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!
const BASE_URL = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
const REDIRECT_URI = `${BASE_URL}/api/auth/google/callback`

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const rawState = searchParams.get('state') ?? ''

  let returnTo = '/expense'
  let addAccountMode = false
  try {
    const stateObj = JSON.parse(decodeURIComponent(rawState)) as { returnTo?: string; addAccount?: boolean }
    returnTo = stateObj.returnTo ?? '/expense'
    addAccountMode = stateObj.addAccount ?? false
  } catch {
    returnTo = rawState ? decodeURIComponent(rawState) : '/expense'
  }

  if (!code) return NextResponse.redirect(`${BASE_URL}/expense?google_error=no_code`)

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
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

  const tokens = await tokenRes.json() as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
  }

  if (!tokens.access_token) {
    return NextResponse.redirect(`${BASE_URL}/expense?google_error=token_failed`)
  }

  // Fetch user info
  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const userInfo = await userRes.json() as { email?: string; name?: string }

  // Always save/update account in DB for multi-account Gmail support
  if (userInfo.email && tokens.refresh_token) {
    await prisma.googleAccount.upsert({
      where: { email: userInfo.email },
      update: {
        name: userInfo.name ?? userInfo.email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      },
      create: {
        email: userInfo.email,
        name: userInfo.name ?? userInfo.email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      },
    })
  } else if (userInfo.email && !tokens.refresh_token) {
    // No new refresh token — update only access token if record exists
    await prisma.googleAccount.updateMany({
      where: { email: userInfo.email },
      data: { accessToken: tokens.access_token, name: userInfo.name ?? userInfo.email },
    })
  }

  const res = NextResponse.redirect(`${BASE_URL}${returnTo}${addAccountMode ? '?account_added=1' : ''}`)

  // Only set cookies for primary login (not add-account flow)
  if (!addAccountMode) {
    res.cookies.set('google_access_token', tokens.access_token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: tokens.expires_in ?? 3600,
      path: '/',
    })
    if (tokens.refresh_token) {
      res.cookies.set('google_refresh_token', tokens.refresh_token, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 30 * 24 * 3600,
        path: '/',
      })
    }
  }

  return res
}
