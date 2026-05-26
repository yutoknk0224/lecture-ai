export interface EmailMeta {
  id: string
  subject: string
  from: string
  date: string
  snippet: string
}

export interface GmailMessage extends EmailMeta {
  body: string
  pdfText: string
}

function decodeBase64url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/')
  try { return Buffer.from(base64, 'base64').toString('utf-8') } catch { return '' }
}

function decodeBase64urlBinary(data: string): Buffer {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(base64, 'base64')
}

interface GmailPayload {
  body?: { data?: string; attachmentId?: string; size?: number }
  parts?: GmailPayload[]
  mimeType?: string
  filename?: string
  headers?: { name: string; value: string }[]
}

function extractBody(payload: GmailPayload): string {
  if (payload.body?.data) return decodeBase64url(payload.body.data)
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data)
        return decodeBase64url(part.body.data)
    }
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return decodeBase64url(part.body.data).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      }
      if (part.parts) {
        const nested = extractBody(part)
        if (nested) return nested
      }
    }
  }
  return ''
}

function collectPdfAttachments(payload: GmailPayload): { attachmentId: string; filename: string }[] {
  const results: { attachmentId: string; filename: string }[] = []
  if (payload.mimeType === 'application/pdf' && payload.body?.attachmentId) {
    results.push({ attachmentId: payload.body.attachmentId, filename: payload.filename ?? 'attachment.pdf' })
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      results.push(...collectPdfAttachments(part))
    }
  }
  return results
}

function getHeader(headers: { name: string; value: string }[], name: string): string {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}

// Fetch lightweight metadata (subject, from, date, snippet) for many emails
export async function fetchEmailsMeta(
  accessToken: string,
  afterDate: string,
  maxResults = 80
): Promise<EmailMeta[]> {
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=after:${afterDate}&maxResults=${maxResults}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!listRes.ok) {
    const err = await listRes.json() as { error?: { message?: string } }
    throw new Error(err.error?.message ?? `Gmail API error: ${listRes.status}`)
  }
  const list = await listRes.json() as { messages?: { id: string }[] }
  if (!list.messages?.length) return []

  // Fetch metadata in parallel batches of 20
  const ids = list.messages.map(m => m.id)
  const batches: string[][] = []
  for (let i = 0; i < ids.length; i += 20) batches.push(ids.slice(i, i + 20))

  const results: EmailMeta[] = []
  for (const batch of batches) {
    const fetched = await Promise.all(
      batch.map(async id => {
        const r = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
        if (!r.ok) return null
        const msg = await r.json() as { id: string; snippet: string; payload: GmailPayload }
        const headers = msg.payload.headers ?? []
        return {
          id: msg.id,
          subject: getHeader(headers, 'Subject'),
          from: getHeader(headers, 'From'),
          date: getHeader(headers, 'Date'),
          snippet: msg.snippet ?? '',
        } satisfies EmailMeta
      })
    )
    results.push(...fetched.filter((m): m is EmailMeta => m !== null))
  }
  return results
}

// Fetch full email body + PDF attachments
export async function getEmailFull(accessToken: string, id: string): Promise<GmailMessage> {
  const r = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!r.ok) throw new Error(`Gmail message fetch error: ${r.status}`)
  const msg = await r.json() as { id: string; snippet: string; payload: GmailPayload }
  const headers = msg.payload.headers ?? []

  const body = extractBody(msg.payload).slice(0, 2000)

  // Extract PDF attachments
  const pdfAttachments = collectPdfAttachments(msg.payload)
  let pdfText = ''
  for (const att of pdfAttachments.slice(0, 3)) {
    try {
      const attRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/attachments/${att.attachmentId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (!attRes.ok) continue
      const attData = await attRes.json() as { data: string }
      const pdfBuffer = decodeBase64urlBinary(attData.data)
      const { default: pdfParse } = await import('pdf-parse')
      const parsed = await pdfParse(pdfBuffer)
      pdfText += `\n[PDF: ${att.filename}]\n${parsed.text.slice(0, 1500)}`
    } catch {
      // skip unreadable PDF
    }
  }

  return {
    id: msg.id,
    subject: getHeader(headers, 'Subject'),
    from: getHeader(headers, 'From'),
    date: getHeader(headers, 'Date'),
    snippet: msg.snippet ?? '',
    body,
    pdfText,
  }
}

// Legacy keyword search (kept for fallback)
export async function searchEmails(
  accessToken: string,
  query: string,
  maxResults = 10
): Promise<GmailMessage[]> {
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!listRes.ok) {
    const err = await listRes.json() as { error?: { message?: string } }
    throw new Error(err.error?.message ?? `Gmail API error: ${listRes.status}`)
  }
  const list = await listRes.json() as { messages?: { id: string }[] }
  if (!list.messages?.length) return []
  const messages = await Promise.all(
    list.messages.map(async ({ id }) => {
      try { return await getEmailFull(accessToken, id) } catch { return null }
    })
  )
  return messages.filter((m): m is GmailMessage => m !== null)
}
