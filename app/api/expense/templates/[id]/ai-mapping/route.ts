import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

const FIELD_DESCRIPTIONS = `
- REPORT_TITLE: レポートタイトル（固定セル）
- REPORT_PERIOD: 対象期間（固定セル）
- SUBMITTER_NAME: 氏名（固定セル）
- DEPARTMENT: 部署・所属（固定セル）
- TOTAL_AMOUNT: 合計金額（固定セル）
- ITEMS_START_ROW: 明細データの開始行番号（数字のみ）
- ITEM_DATE_COL: 日付の列記号（A〜Z）
- ITEM_PURPOSE_COL: 目的の列記号
- ITEM_DEPARTURE_COL: 出発地の列記号
- ITEM_DESTINATION_COL: 目的地の列記号
- ITEM_TRANSPORT_COL: 交通手段の列記号
- ITEM_CATEGORY_COL: 費目・カテゴリの列記号
- ITEM_AMOUNT_COL: 金額の列記号
- ITEM_NOTES_COL: 備考の列記号
`

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params
  const { description } = await req.json()
  if (!description?.trim()) {
    return NextResponse.json({ error: 'description is required' }, { status: 400 })
  }

  const prompt = `以下のExcelテンプレートの説明から、フィールドとセルアドレスのマッピングをJSON形式で返してください。

フィールド一覧:
${FIELD_DESCRIPTIONS}

ユーザーの説明:
${description}

ルール:
- 固定セルのフィールド（REPORT_TITLE等）はセルアドレス形式（例: B2, D3）で返す
- 列フィールド（ITEM_XXX_COL）は列記号のみ（例: A, B, G）で返す
- ITEMS_START_ROW は数字のみ（例: 8）で返す
- 言及されていないフィールドは空文字列 "" で返す
- 必ず全フィールドを含めること

返答は以下のJSON形式のみで返してください（説明文不要）:
{
  "mappings": [
    { "fieldKey": "REPORT_TITLE", "cellAddress": "B2" },
    ...
  ]
}`

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: 'あなたはExcelテンプレートのセルマッピング設定を解析するアシスタントです。必ずJSON形式のみで返答してください。',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.1,
  })

  const raw = response.choices[0]?.message?.content ?? '{}'
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return NextResponse.json({ error: 'AI応答の解析に失敗しました' }, { status: 500 })
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ error: 'JSONパースに失敗しました' }, { status: 500 })
  }
}
