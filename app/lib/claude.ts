import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

const MODEL = 'llama-3.3-70b-versatile'
const FAST_MODEL = 'llama-3.1-8b-instant'

const CHUNK_SIZE = 6000
const MAX_CHUNKS = 5

async function summarizeChunk(chunk: string, index: number, total: number): Promise<string> {
  const response = await groq.chat.completions.create({
    model: FAST_MODEL,
    messages: [
      {
        role: 'system',
        content: `あなたは授業資料の一部を分析するアシスタントです。提供されたテキストから重要な概念・ポイント・キーワードを日本語の箇条書きで簡潔に抽出してください。`,
      },
      {
        role: 'user',
        content: `授業資料（${total}分割中の${index + 1}番目）から重要なポイントを抽出してください：\n\n${chunk}`,
      },
    ],
  })
  return response.choices[0]?.message?.content ?? ''
}

const FINAL_SUMMARY_SYSTEM = `あなたは大学の授業資料を整理する優秀なアシスタントです。
複数のセクションから抽出されたポイントをもとに、資料全体の統合的な要約を日本語で作成してください。
以下の形式で回答してください：

## 概要
（資料全体の概要を2-3文で説明）

## 主要なポイント
（重要な概念や内容を箇条書きで整理）

## キーワード
（重要な用語やキーワードをリストアップ）`

export async function summarizeContent(text: string): Promise<string> {
  if (text.length <= CHUNK_SIZE) {
    const response = await groq.chat.completions.create({
      model: FAST_MODEL,
      messages: [
        { role: 'system', content: FINAL_SUMMARY_SYSTEM },
        { role: 'user', content: `以下の授業資料の内容を整理・要約してください：\n\n${text}` },
      ],
    })
    return response.choices[0]?.message?.content ?? ''
  }

  // Map: split into chunks and summarize in parallel
  const chunks: string[] = []
  for (let i = 0; i < text.length && chunks.length < MAX_CHUNKS; i += CHUNK_SIZE) {
    chunks.push(text.slice(i, i + CHUNK_SIZE))
  }

  const chunkSummaries = await Promise.all(
    chunks.map((chunk, i) => summarizeChunk(chunk, i, chunks.length))
  )

  // Reduce: merge chunk summaries into final structured summary
  const combined = chunkSummaries.join('\n\n---\n\n').slice(0, 12000)

  const response = await groq.chat.completions.create({
    model: FAST_MODEL,
    messages: [
      { role: 'system', content: FINAL_SUMMARY_SYSTEM },
      {
        role: 'user',
        content: `以下は授業資料の各セクションから抽出されたポイントです。これらをもとに資料全体の統合的な要約を作成してください：\n\n${combined}`,
      },
    ],
  })
  return response.choices[0]?.message?.content ?? ''
}

const LANG_RULE = `\n重要：問題文・選択肢・正解・解説はすべて日本語で記述してください。英語・ロシア語などの外国語は使用禁止です。`
const AMBIGUOUS_REF_RULE = `\n注意：「この研究」「この論文」「この資料」「この実験」などの曖昧な指示表現は使用禁止です。問題文には具体的な概念・手法・実験条件・固有名詞などを使って記述してください。`

const FORMAT_SYSTEM_PROMPTS: Record<string, string> = {
  'multiple-choice': `あなたは大学の授業内容から復習用の4択問題を作成する教育アシスタントです。${LANG_RULE}${AMBIGUOUS_REF_RULE}
- 4つの選択肢はそれぞれ明確に異なる内容・主張でなければなりません。類義語・言い換え・同義の選択肢は禁止です（例：「影響を与えない」と「変化させない」のような重複は不可）。
- 問題文で問うている用語・概念をそのまま選択肢に含めてはいけません（例：「睡眠断片化とは何か」という問いに「睡眠の断片化」を選択肢にすることは禁止）。
- sourceフィールドには、解答の根拠となる資料の原文を1〜2文そのままコピーして引用してください（要約・改変禁止）。
以下のJSON形式のみで回答してください（コードブロック記号・説明文は一切含めないでください）：
[
  {
    "question": "問題文",
    "options": ["選択肢A", "選択肢B", "選択肢C", "選択肢D"],
    "answer": 0,
    "explanation": "解説文",
    "source": "資料の該当箇所をそのまま引用した文（1〜2文）",
    "sourceTitle": "引用元の資料タイトル（複数資料が提供されている場合は【資料N：タイトル】からタイトル部分を抜き出す。単一資料の場合は空文字）"
  }
]
answerは正解の選択肢のインデックス（0始まり）です。`,

  'short-answer': `あなたは大学の授業内容から一問一答形式の問題を作成する教育アシスタントです。${LANG_RULE}${AMBIGUOUS_REF_RULE}
- sourceフィールドには、解答の根拠となる資料の原文を1〜2文そのままコピーして引用してください（要約・改変禁止）。
- sourceTitleフィールドには、引用元の資料タイトルを必ず記載してください。資料は【資料N：タイトル】または【資料：タイトル】の形式で提供されます。その「タイトル」部分のみを抜き出して記載してください。
以下のJSON形式のみで回答してください（コードブロック記号・説明文は一切含めないでください）：
[
  {
    "question": "〜は何ですか？",
    "answer": "正解（簡潔に1〜2文）",
    "keywords": ["必須キーワード1", "必須キーワード2"],
    "explanation": "解説",
    "source": "資料の該当箇所をそのまま引用した文（1〜2文）",
    "sourceTitle": "引用元の資料タイトル"
  }
]`,

  'fill-in-blank': `あなたは大学の授業内容から穴埋め問題を作成する教育アシスタントです。${LANG_RULE}${AMBIGUOUS_REF_RULE}
以下のルールを厳守してください：
- 空欄の前後に十分な文脈（ヒントになる語句・説明）を必ず残してください。短すぎる文は禁止です
- 1問につき空欄は1〜2個にとどめてください
- 空欄は___（アンダースコア3つ）で表してください
- hintフィールドに「空欄の種類の説明」や「考えるためのヒント」を簡潔に書いてください
- 数値や年齢を空欄にする場合は、単位・助詞・範囲表現（「から」「〜」など）を文章内に必ず残し、空欄に数値を入れたとき文法的に自然な文になるようにしてください
- ___を入れた際に日本語として自然に読めるかを必ず確認してから出力してください

良い例：「睡眠を___時間に制限すると痛み感受性が上昇し、十分な睡眠を取った対照群と比べて___の閾値が有意に低下することが示された。」
良い例（数値）：「被験者は___歳から___歳の女性であった。」（単位・助詞が空欄の外に残っている）
悪い例：「___は___によって調節される。」（文脈がなく短すぎる）
悪い例（数値）：「被験者は___の___を持つ女性であった。」（数値を入れても文法的に意味をなさない）

- sourceフィールドには、解答の根拠となる資料の原文を1〜2文そのままコピーして引用してください（要約・改変禁止）。
- sourceTitleフィールドには、引用元の資料タイトルを必ず記載してください。資料は【資料N：タイトル】または【資料：タイトル】の形式で提供されます。その「タイトル」部分のみを抜き出して記載してください。
以下のJSON形式のみで回答してください（コードブロック記号・説明文は一切含めないでください）：
[
  {
    "text": "前後の文脈を含む文章。___は空欄を示す。",
    "blanks": ["正解語句1"],
    "hint": "空欄の種類やヒント（例：時間や単位、人名、専門用語など）",
    "explanation": "解説",
    "source": "資料の該当箇所をそのまま引用した文（1〜2文）",
    "sourceTitle": "引用元の資料タイトル"
  }
]
blanksの要素数はtextの___の数と必ず一致させてください。`,

  'table': `あなたは大学の授業内容からノードとエッジで構成された概念図（フロー図・循環図）形式の穴埋め問題を作成する教育アシスタントです。${LANG_RULE}${AMBIGUOUS_REF_RULE}

以下のJSON形式のみで回答してください（コードブロック記号・説明文は一切含めないでください）：
[
  {
    "title": "概念図のタイトル",
    "nodes": [
      {"id": "A", "label": "概念Aの名前", "type": "normal"},
      {"id": "B", "label": "___", "type": "blank", "answer": "正解語句"},
      {"id": "C", "label": "概念Cの名前", "type": "normal"}
    ],
    "edges": [
      {"from": "A", "to": "B", "label": "関係"},
      {"from": "B", "to": "C", "label": "関係"}
    ],
    "layout": "linear",
    "explanation": "解説文",
    "source": "資料の該当箇所をそのまま引用した文（1〜2文）",
    "sourceTitle": "引用元の資料タイトル"
  }
]

ルール：
- layoutは "linear"（因果の流れ・プロセス）または "cycle"（悪循環・好循環など循環関係）
- type:"blank" のノードのlabelは必ず "___"、answerに日本語の正解語句を記入
- ノード数は3〜5個
- 空欄（type:"blank"）は1〜2個にする
- 空欄の位置のバリエーションを必ず変えること：先頭・中間・末尾をそれぞれ使い、1つの問題セットで中間のみに偏らないこと
- 各問ごとに異なる概念・異なる構造を使うこと（同じパターンの繰り返し禁止）
- ノードlabelは概念を自然な日本語で記述する（文字数制限なし）
- edgeのlabelは関係を6文字以内で表現する
- 資料の中の重要な概念間の因果関係・プロセス・循環を図式化すること`,

  'essay': `あなたは大学の授業内容から記述問題を作成する教育アシスタントです。${LANG_RULE}${AMBIGUOUS_REF_RULE}
- sourceフィールドには、解答の根拠となる資料の原文を1〜2文そのままコピーして引用してください（要約・改変禁止）。
- sourceTitleフィールドには、引用元の資料タイトルを必ず記載してください。資料は【資料N：タイトル】または【資料：タイトル】の形式で提供されます。その「タイトル」部分のみを抜き出して記載してください。
以下のJSON形式のみで回答してください（コードブロック記号・説明文は一切含めないでください）：
[
  {
    "question": "〜のメカニズムを説明してください。",
    "keyPoints": ["必須ポイント1", "必須ポイント2", "必須ポイント3"],
    "sampleAnswer": "模範解答文（3〜5文）",
    "explanation": "補足解説",
    "source": "資料の該当箇所をそのまま引用した文（1〜2文）",
    "sourceTitle": "引用元の資料タイトル"
  }
]`,
}

const FORMAT_USER_PROMPTS: Record<string, (count: number) => string> = {
  'multiple-choice': (n) => `以下の授業資料から${n}問の4択問題を作成してください：`,
  'short-answer': (n) => `以下の授業資料から${n}問の一問一答問題を作成してください：`,
  'fill-in-blank': (n) => `以下の授業資料から${n}問の穴埋め問題を作成してください：`,
  'table': (n) => `以下の授業資料から${n}問の概念図穴埋め問題を作成してください（1問につき1つの図）。空欄の位置は先頭・中間・末尾をバリエーションよく使い、各問で異なる概念・構造にしてください：`,
  'essay': (n) => `以下の授業資料から${n}問の記述問題を作成してください：`,
}

const DIFFICULTY_RULES: Record<string, string> = {
  easy: `

【難易度：基礎】
- 重要な用語・概念の定義や基本事実を問う問題を作成してください
- 選択肢は明確に区別できるものにし、迷わせる選択肢は不要です
- 問題文は平易で短く、1つの概念に絞った問いにしてください
- 記述・穴埋め問題は短い語句や1〜2文で答えられる問いにしてください`,

  normal: `

【難易度：標準】
- 概念の理解や因果関係、比較を問う問題を作成してください
- 単純な暗記ではなく、内容を理解していないと答えられない問いにしてください`,

  hard: `

【難易度：発展】
- 複数の概念を組み合わせる複合的・応用的な問題を作成してください
- 4択では正解に近い紛らわしい選択肢を必ず含めてください
- 批判的思考・複数概念の比較考察・メカニズムの統合的説明を求めてください
- 記述問題は複数の要素を統合して説明することが必要な難度の高い問いにしてください`,
}

export async function generateQuizzes(text: string, count: number = 5): Promise<string> {
  return generateQuizzesByFormat(text, count, 'multiple-choice')
}

export async function generateQuizzesByFormat(
  text: string,
  count: number,
  format: string,
  materialCount: number = 1,
  difficulty: string = 'normal'
): Promise<string> {
  const basePrompt = FORMAT_SYSTEM_PROMPTS[format] ?? FORMAT_SYSTEM_PROMPTS['multiple-choice']
  const difficultyRule = DIFFICULTY_RULES[difficulty] ?? DIFFICULTY_RULES['normal']
  const systemPrompt = basePrompt + difficultyRule

  const userPromptFn = FORMAT_USER_PROMPTS[format] ?? FORMAT_USER_PROMPTS['multiple-choice']

  const distributionNote = materialCount > 1
    ? `\n重要：${materialCount}つの資料が提供されています。各資料から均等に問題を出題してください（特定の1つの資料だけに偏らないこと）。`
    : ''

  const response = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `${userPromptFn(count)}${distributionNote}\n\n${text.slice(0, 8000)}` },
    ],
  })
  return response.choices[0]?.message?.content ?? '[]'
}

export async function chatWithMaterial(
  text: string,
  question: string,
  history: Array<{ role: string; content: string }>
): Promise<string> {
  const messages: Groq.Chat.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `あなたは大学の授業資料について質問に答える優秀な学習アシスタントです。
提供された授業資料の内容に基づいて、学生の質問に日本語で丁寧に答えてください。
資料に記載されていない内容については、その旨を伝えた上で一般的な知識から補足説明を行ってください。

【授業資料の内容】
${text.slice(0, 8000)}`,
    },
    ...history.map((msg) => ({
      role: (msg.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user', content: question },
  ]

  const response = await groq.chat.completions.create({
    model: MODEL,
    messages,
  })
  return response.choices[0]?.message?.content ?? ''
}
