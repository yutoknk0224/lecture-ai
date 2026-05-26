# 講義資料管理 AI - プロジェクト概要

## アプリの目的
大学生向けの講義資料管理・AI学習補助アプリ。授業資料をアップロードして、AI要約・復習問題生成・Q&Aチャットができる。

## 技術スタック
- **フレームワーク**: Next.js 16.2.4（App Router + Turbopack）
- **言語**: TypeScript
- **スタイル**: Tailwind CSS v4
- **DB**: SQLite（Prisma v7 + @prisma/adapter-better-sqlite3）
- **AI**: Groq API（llama-3.3-70b-versatile）
- **PDF抽出**: pdfjs-dist/legacy/build/pdf.mjs（serverExternalPackages設定済み）

## 重要な設定・注意点

### Prisma v7の注意点
- `schema.prisma`にURLを書かない（v7の破壊的変更）
- `prisma.config.ts`でアダプター設定
- DBパスは`path.join(process.cwd(), 'dev.db')`（プロジェクトルート直下）
- スキーマ変更時は`npx prisma db push`を使う（migrate devはDBリセットになる）

### Turbopackの注意点
- `next.config.ts`に`turbopack: { root: __dirname }`が必要
- `serverExternalPackages: ['pdfjs-dist']`でPDF.jsをバンドル対象外に

### AI（Groq）
- モデル: `llama-3.3-70b-versatile`
- APIキーは`.env`の`GROQ_API_KEY`
- 関数: `summarizeContent`, `generateQuizzes`, `chatWithMaterial`（`app/lib/claude.ts`）

## ディレクトリ構成
```
lecture-ai/
├── app/
│   ├── api/
│   │   ├── courses/          # 科目CRUD
│   │   ├── materials/        # 資料CRUD・アップロード・再処理
│   │   ├── quiz/             # 復習問題生成
│   │   └── chat/             # Q&Aチャット
│   ├── components/
│   │   ├── TimetableGrid.tsx # 時間割グリッド（メイン画面）
│   │   ├── CoursePanel.tsx   # 科目詳細パネル（右サイドバー）
│   │   └── MaterialDetail.tsx# 資料詳細（要約・クイズ・チャット）
│   ├── lib/
│   │   ├── claude.ts         # Groq AI関数
│   │   ├── extractText.ts    # PDF/TXTテキスト抽出
│   │   └── prisma.ts         # Prismaクライアント
│   ├── generated/prisma/     # Prisma生成コード
│   └── page.tsx              # メインページ（時間割UI）
├── prisma/
│   └── schema.prisma
├── public/uploads/           # アップロードファイル保存先
├── dev.db                    # SQLiteデータベース
└── .env                      # GROQ_API_KEY, DATABASE_URL
```

## DBスキーマ（主要モデル）
```prisma
model Course {
  id          String     @id @default(cuid())
  name        String
  description String?
  day         Int?       // 0=月〜4=金
  period      Int?       // 1〜5限
  year        Int?       // 1〜4年（null=共通科目）
  semester    String?    // '前期'|'後期'（null=共通科目）
  materials   Material[]
}

model Material {
  id            String  @id @default(cuid())
  title         String
  extractedText String?
  summary       String?
  courseId      String
  // + quizzes, chatMessages リレーション
}
```

## 画面構成
```
[ハンバーガー] [ロゴ] 講義資料管理AI / 2年前期
────────────────────────────────────────────
│ サイドバー    │  時間割グリッド  │ 科目パネル │
│ （開閉可）    │  （メイン）      │ （右端）   │
│ 学年: 1〜4年  │  月〜金 × 1〜5限 │ 資料一覧  │
│ 学期: 前/後期 │  空コマ→科目追加 │ ↓クリック │
│ 共通科目      │  科目→パネル表示 │ AI機能   │
└──────────────┴──────────────────┴──────────┘
```

## 今後やりたいこと（未実装）
- Gmailの自動チェック＋AI振り分けによる通知機能
  - 科目関連メール→該当科目のお知らせとして表示
  - その他→通知センターで一覧表示
  - Gmail APIは経費精算モジュールに実装済みなので流用可能
- UIのさらなる改良
- ユーザー認証・パスワード設定（将来）
- 団体コード・グループ管理（将来）

## 開発の再開方法
```bash
cd /Users/yutokaneko/Desktop/Claude.code/lecture-ai
npm run dev
# → http://localhost:3000
```
