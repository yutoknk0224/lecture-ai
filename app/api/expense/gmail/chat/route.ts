import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { fetchEmailsMeta, getEmailFull, EmailMeta, GmailMessage } from '@/app/lib/gmail'
import { prisma } from '@/app/lib/prisma'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

export interface ParsedExpenseItem {
  date: string
  purpose: string
  destination: string
  departure: string
  transport: string
  amount: number
  category: string
  notes: string
  sourceEmail: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// ---- Date helpers ----

function toGmailDate(d: Date) {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function parseDateRange(message: string): { afterDate: string; label: string } {
  const now = new Date()
  if (/今月/.test(message)) {
    return { afterDate: toGmailDate(new Date(now.getFullYear(), now.getMonth(), 1)), label: '今月' }
  }
  if (/先月/.test(message)) {
    return { afterDate: toGmailDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)), label: '先月' }
  }
  if (/今週/.test(message)) {
    const start = new Date(now); start.setDate(now.getDate() - now.getDay())
    return { afterDate: toGmailDate(start), label: '今週' }
  }
  if (/先週/.test(message)) {
    const end = new Date(now); end.setDate(now.getDate() - now.getDay())
    const start = new Date(end); start.setDate(end.getDate() - 7)
    return { afterDate: toGmailDate(start), label: '先週' }
  }
  const mMatch = message.match(/(\d{1,2})月/)
  if (mMatch) {
    const month = parseInt(mMatch[1])
    const year = month > now.getMonth() + 1 ? now.getFullYear() - 1 : now.getFullYear()
    return { afterDate: toGmailDate(new Date(year, month - 1, 1)), label: `${month}月` }
  }
  // default: last 60 days
  const start = new Date(now); start.setDate(now.getDate() - 60)
  return { afterDate: toGmailDate(start), label: '直近60日' }
}

// ---- Token helpers ----

async function refreshTokenForAccount(accountId: string, refreshToken: string): Promise<string | null> {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const tokens = await tokenRes.json() as { access_token?: string }
  if (!tokens.access_token) return null
  await prisma.googleAccount.update({ where: { id: accountId }, data: { accessToken: tokens.access_token } })
  return tokens.access_token
}

async function getValidTokenForAccount(account: { id: string; accessToken: string; refreshToken: string }): Promise<string | null> {
  const check = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${account.accessToken}` },
  })
  if (check.ok) return account.accessToken
  return refreshTokenForAccount(account.id, account.refreshToken)
}

async function getValidAccessTokenFromCookie(req: NextRequest): Promise<string | null> {
  const accessToken = req.cookies.get('google_access_token')?.value
  if (accessToken) {
    const check = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (check.ok) return accessToken
  }
  const refreshToken = req.cookies.get('google_refresh_token')?.value
  if (!refreshToken) return null
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const tokens = await tokenRes.json() as { access_token?: string }
  return tokens.access_token ?? null
}

// ---- Step 1: AI selects expense-relevant emails from metadata ----

async function selectExpenseEmails(metas: EmailMeta[], userMessage: string): Promise<string[]> {
  if (metas.length === 0) return []

  const list = metas.map((m, i) =>
    `[${i}] 件名: ${m.subject} | 差出人: ${m.from.slice(0, 40)} | 抜粋: ${m.snippet.slice(0, 80)}`
  ).join('\n')

  const res = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: `あなたは経費精算アシスタントです。
以下のメール一覧から、経費精算に関係しそうなメールの番号をJSON配列で返してください。
対象: 領収書・乗車券・予約確認・購入確認・請求書・明細書・宿泊確認・航空券・タクシー・レストラン等
出力形式: {"ids": [0, 3, 7, ...]}（最大15件）
関係ないものは含めないでください。`,
      },
      {
        role: 'user',
        content: `ユーザーの依頼: ${userMessage}\n\nメール一覧:\n${list}`,
      },
    ],
    response_format: { type: 'json_object' },
  })

  try {
    const parsed = JSON.parse(res.choices[0]?.message?.content ?? '{}') as { ids?: number[] }
    const ids = parsed.ids ?? []
    return ids
      .filter(i => typeof i === 'number' && i >= 0 && i < metas.length)
      .slice(0, 15)
      .map(i => metas[i].id)
  } catch {
    return []
  }
}

// ---- Step 2: Parse full emails to expense items ----

interface EmailWithAccount { email: GmailMessage; accountEmail: string }

async function parseEmailsToExpenses(
  emailsWithAccount: EmailWithAccount[],
  userMessage: string
): Promise<{ reply: string; items: ParsedExpenseItem[] }> {
  if (emailsWithAccount.length === 0) {
    return {
      reply: '経費関連のメールが見つかりませんでした。期間や内容を変えて試してみてください。',
      items: [],
    }
  }

  const emailSummaries = emailsWithAccount.map(({ email: e, accountEmail }, i) => {
    const pdfSection = e.pdfText ? `\nPDF内容: ${e.pdfText.slice(0, 800)}` : ''
    return `[メール${i + 1}（${accountEmail}）]\n件名: ${e.subject}\n差出人: ${e.from}\n日付: ${e.date}\n本文: ${e.body.slice(0, 600)}${pdfSection}`
  }).join('\n\n---\n\n')

  const res = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: `あなたは経費精算AIアシスタントです。メール・PDF内容から経費情報を正確に抽出してください。
以下のJSON形式のみで回答してください:
{
  "reply": "見つかった経費の説明（日本語・具体的に）",
  "items": [
    {
      "date": "YYYY-MM-DD（不明は空文字）",
      "purpose": "用途・目的",
      "destination": "目的地・店名・サービス名",
      "departure": "出発地（交通費のみ、それ以外は空文字）",
      "transport": "交通手段（新幹線・電車・タクシー等、該当しない場合は空文字）",
      "amount": 金額の数値（円、不明は0）,
      "category": "交通費・宿泊費・会議費・接待費・消耗品費・通信費・その他のいずれか",
      "notes": "備考（PDF領収書の場合はその旨を記載）",
      "sourceEmail": "メールの件名"
    }
  ]
}
金額が0または経費でないものはitemsに含めないでください。PDF内に金額がある場合はそちらを優先してください。`,
      },
      {
        role: 'user',
        content: `依頼: ${userMessage}\n\n${emailsWithAccount.length}件のメールから経費情報を抽出:\n\n${emailSummaries}`,
      },
    ],
    response_format: { type: 'json_object' },
  })

  try {
    const parsed = JSON.parse(res.choices[0]?.message?.content ?? '{}') as { reply?: string; items?: ParsedExpenseItem[] }
    return {
      reply: parsed.reply ?? 'メールを解析しました。',
      items: (parsed.items ?? []).filter(item => item.amount > 0),
    }
  } catch {
    return { reply: 'メールの解析中にエラーが発生しました。', items: [] }
  }
}

// ---- Conversational reply (no search) ----

async function conversationalReply(message: string, history: ChatMessage[]): Promise<string> {
  const messages: Groq.Chat.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `あなたは経費精算AIアシスタントです。複数のGmailアカウントのメールを期間指定で検索し、PDF添付ファイルも解析して経費情報を抽出できます。
「今月の経費メールを探して」「先月のホテル代を調べて」のように依頼してください。`,
    },
    ...history.slice(-6).map(m => ({
      role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: message },
  ]
  const res = await groq.chat.completions.create({ model: 'llama-3.3-70b-versatile', messages })
  return res.choices[0]?.message?.content ?? ''
}

// ---- Detect if user wants search ----

async function isSearchRequest(message: string): Promise<boolean> {
  const searchKeywords = ['探して', '検索', '調べて', '確認', '見つけて', 'メール', '領収書', '経費', '精算', '交通費', '宿泊', '飲食', '購入', '請求']
  return searchKeywords.some(k => message.includes(k))
}

// ---- Main handler ----

export async function POST(req: NextRequest) {
  try {
    const { message, history = [] }: { message: string; history?: ChatMessage[] } = await req.json()
    if (!message?.trim()) return NextResponse.json({ error: 'メッセージが必要です' }, { status: 400 })

    const cookieToken = await getValidAccessTokenFromCookie(req)
    const dbAccounts = await prisma.googleAccount.findMany()

    if (!cookieToken && dbAccounts.length === 0) {
      return NextResponse.json({ error: 'Not authenticated', needsAuth: true }, { status: 401 })
    }

    const wantsSearch = await isSearchRequest(message)
    if (!wantsSearch) {
      const reply = await conversationalReply(message, history)
      return NextResponse.json({ reply, items: [], searched: false })
    }

    const { afterDate, label } = parseDateRange(message)

    // Gather valid tokens for all accounts
    const tokensByAccount: { token: string; email: string }[] = []
    for (const account of dbAccounts) {
      try {
        const token = await getValidTokenForAccount(account)
        if (token) tokensByAccount.push({ token, email: account.email })
      } catch (e) {
        console.error(`[token refresh error] ${account.email}`, e)
      }
    }
    if (cookieToken) {
      const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${cookieToken}` },
      })
      if (userRes.ok) {
        const user = await userRes.json() as { email?: string }
        if (user.email && !tokensByAccount.find(t => t.email === user.email)) {
          tokensByAccount.push({ token: cookieToken, email: user.email })
        }
      }
    }

    if (tokensByAccount.length === 0) {
      return NextResponse.json({ error: 'Not authenticated', needsAuth: true }, { status: 401 })
    }

    // Step 1: Fetch metadata for all accounts in parallel
    const metaResults = await Promise.allSettled(
      tokensByAccount.map(({ token, email }) =>
        fetchEmailsMeta(token, afterDate).then(metas => ({ metas, email, token }))
      )
    )

    // Step 2: AI selects expense-relevant IDs per account
    const selectedByAccount: { ids: string[]; email: string; token: string }[] = []
    await Promise.all(
      metaResults.map(async result => {
        if (result.status !== 'fulfilled') return
        const { metas, email, token } = result.value
        const ids = await selectExpenseEmails(metas, message)
        if (ids.length > 0) selectedByAccount.push({ ids, email, token })
      })
    )

    const totalMetaCount = metaResults.reduce((s, r) => s + (r.status === 'fulfilled' ? r.value.metas.length : 0), 0)

    if (selectedByAccount.length === 0) {
      return NextResponse.json({
        reply: `${label}のメール${totalMetaCount}件を確認しましたが、経費関連のメールは見つかりませんでした。`,
        items: [],
        searched: true,
        emailCount: 0,
        accountCount: tokensByAccount.length,
      })
    }

    // Step 3: Fetch full content + PDF attachments for selected emails
    const emailsWithAccount: EmailWithAccount[] = []
    await Promise.all(
      selectedByAccount.flatMap(({ ids, email, token }) =>
        ids.map(async id => {
          try {
            const fullEmail = await getEmailFull(token, id)
            emailsWithAccount.push({ email: fullEmail, accountEmail: email })
          } catch (e) {
            console.error(`[getEmailFull error] ${id}`, e)
          }
        })
      )
    )

    // Step 4: Parse expense data
    const { reply, items } = await parseEmailsToExpenses(emailsWithAccount, message)

    const hasPdf = emailsWithAccount.some(e => e.email.pdfText.length > 0)
    const finalReply = `${reply}${hasPdf ? '（PDF添付ファイルも解析済み）' : ''}`

    return NextResponse.json({
      reply: finalReply,
      items,
      searched: true,
      emailCount: emailsWithAccount.length,
      totalScanned: totalMetaCount,
      accountCount: tokensByAccount.length,
    })
  } catch (e) {
    console.error('[/api/expense/gmail/chat] Unhandled error:', e)
    return NextResponse.json({
      error: String(e),
      reply: 'サーバーエラーが発生しました。',
      items: [],
    }, { status: 500 })
  }
}
