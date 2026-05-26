import { NextRequest, NextResponse } from 'next/server'

const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID!
const REDIRECT_URI = `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/api/auth/microsoft/callback`
const SCOPES = 'Files.ReadWrite User.Read offline_access'

export async function GET(req: NextRequest) {
  const returnTo = req.nextUrl.searchParams.get('returnTo') ?? '/expense'

  const authUrl = new URL('https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize')
  authUrl.searchParams.set('client_id', CLIENT_ID)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
  authUrl.searchParams.set('scope', SCOPES)
  authUrl.searchParams.set('response_mode', 'query')
  authUrl.searchParams.set('state', encodeURIComponent(returnTo))

  return NextResponse.redirect(authUrl.toString())
}
