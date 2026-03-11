# Brave Frontier Heroes Dashboard

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmogeta%2Fbfh-sandbox&env=NEXT_PUBLIC_CLIENT_ID,CLIENT_SECRET)

Brave Frontier Heroes の Forge API を利用した Next.js ダッシュボードアプリケーション。

## 機能

- OAuth2認証による安全なログイン
- ユーザー情報の表示
- 保有ユニット・スフィアの一覧表示
- グラスモーフィズムデザイン
- ヒーローユニットのメタデータ表示
- バトルリプレイリンク
- TypeScript + TanStack Query による型安全なAPI連携
- React Query DevTools による開発体験向上

## 技術スタック

- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS 4 + shadcn/ui
- **API Client:** Orval (OpenAPI → TypeScript + React Query hooks)
- **State Management:** TanStack Query v5 (React Query)
- **HTTP Client:** Axios with custom interceptors
- **Language:** TypeScript
- **Code Quality:** Prettier, ESLint

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example` を `.env` にコピーして、必要な環境変数を設定してください。
`NEXT_PUBLIC_CLIENT_ID` と `CLIENT_SECRET` は [BFH Developer Portal](https://bfh-developer-portal-front.vercel.app/) で取得できます。

```bash
cp .env.example .env
```

`.env` ファイルを編集して、以下の値を設定します：

```env
NEXT_PUBLIC_CLIENT_ID=your_client_id_here
CLIENT_SECRET=your_client_secret_here
NEXT_PUBLIC_BFH_API_BASE_URL=https://api.bravefrontierheroes.com
NEXT_PUBLIC_BFH_AUTH_URL=https://auth.bravefrontierheroes.com/oauth2/auth
NEXT_PUBLIC_BFH_TOKEN_URL=https://auth.bravefrontierheroes.com/oauth2/token
```

### 3. APIクライアントの生成

Swagger定義から TypeScript クライアントコードを生成します。

```bash
npm run generate:api
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで `http://localhost:3500` にアクセスしてください。

## プロジェクト構造

```
bfh-sandbox/
├── app/                           # Next.js App Router
│   ├── api/                       # API Routes (最小限)
│   │   ├── auth/                  # OAuth2認証
│   │   │   ├── callback/route.ts # OAuth2コールバック
│   │   │   ├── logout/route.ts   # ログアウト
│   │   │   ├── refresh/route.ts  # トークンリフレッシュ
│   │   │   └── token-status/route.ts # トークン状態確認
│   │   ├── hero/metadata/[id]/route.ts # ヒーローメタデータプロキシ
│   │   └── sphere/metadata/[id]/route.ts # スフィアメタデータプロキシ
│   ├── dashboard/page.tsx         # ダッシュボード画面
│   ├── units/page.tsx             # ユニット一覧
│   ├── spheres/page.tsx           # スフィア一覧
│   ├── auth-debug/page.tsx        # 認証デバッグ
│   ├── login/page.tsx             # ログイン画面
│   ├── layout.tsx                 # ルートレイアウト（QueryProvider含む）
│   └── globals.css                # グローバルスタイル
├── src/                           # 再利用可能なコード
│   ├── api/
│   │   ├── generated/             # Orval自動生成React Query hooks
│   │   ├── model/                 # Orval自動生成型定義
│   │   └── mutator/
│   │       └── custom-instance.ts # Axios設定（認証インターセプター）
│   ├── components/
│   │   ├── ui/                    # shadcn/uiコンポーネント
│   │   ├── providers/
│   │   │   └── query-provider.tsx # TanStack Query + DevTools
│   │   ├── unit-card.tsx          # ユニットカード
│   │   ├── sphere-card.tsx        # スフィアカード
│   │   └── battle-replay-link.tsx # バトルリプレイリンク
│   ├── config/
│   │   └── env.ts                 # 環境変数一元管理
│   └── lib/
│       └── utils.ts               # ユーティリティ関数
├── orval.config.ts                # Orval設定（Prettier統合）
├── components.json                # shadcn/ui設定
└── tsconfig.json                  # TypeScript設定
```

## 主要な機能

### OAuth2認証フロー

1. ユーザーが「ブレヒロでログイン」をクリック
2. BFH認証ページへリダイレクト（PKCE対応）
3. 認証成功後、`/api/auth/callback` へコールバック
4. サーバーサイドでトークン交換（CLIENT_SECRETを使用）
5. アクセストークンをCookieに保存（`httpOnly: false` でクライアントアクセス可能）
6. リフレッシュトークンをHTTPOnly Cookieに保存（セキュア）
7. ダッシュボードへリダイレクト

**重要**: アクセストークンは Orval 生成の React Query hooks がクライアントサイドで使用するため、`httpOnly: false` に設定されています。リフレッシュトークンは安全のため `httpOnly: true` のままです。

### APIクライアント

Orvalにより、Swagger定義から自動生成された型安全なAPIクライアントを使用します。

**✅ 正しい使い方（推奨）**:
```typescript
// Orval生成のReact Query hooksを直接使用
import { useGetV1Me } from '@/src/api/generated/user/user';
import { useGetV1MeUnits } from '@/src/api/generated/assets/assets';

const { data: userData, isLoading, error } = useGetV1Me();
const { data: units } = useGetV1MeUnits();
```

**❌ 間違った使い方（非推奨）**:
```typescript
// 中間APIルートを作成してfetchする（アンチパターン）
const response = await fetch('/api/user/me');
```

**自動生成されるAPI hooks**:
- `user/user.ts` - ユーザー情報関連
- `assets/assets.ts` - ユニット・スフィア関連
- `hero/hero.ts` - ヒーロー詳細情報
- `deck/deck.ts` - デッキ情報
- `rank-match/rank-match.ts` - ランクマッチ情報
- など...

### ユーティリティ関数

```typescript
// ヒーローメタデータURLの生成
getHeroMetadataUrl(heroId: string | number): string

// バトルログURLの生成
getBattleLogUrl(battleId: string | number): string

// バトルリプレイURLの生成
getBattleReplayUrl(battleId: string | number, lang?: string): string
```

## コンポーネント

### UnitCard

ヒーローユニットのメタデータを表示するカードコンポーネント。

```tsx
<UnitCard heroId="200000058" />
```

### BattleReplayLink

バトルリプレイへのリンクを生成するコンポーネント。

```tsx
<BattleReplayLink battleId="12345678" lang="ja" />
```

## デザイン

グラスモーフィズムスタイルを使用した、ゲームの世界観に合うデザインを採用しています。

利用可能なユーティリティクラス：
- `.glass` - 基本的なガラス効果
- `.glass-card` - カード用のガラス効果
- `.glass-hover` - ホバーアニメーション

## スクリプト

- `npm run dev` - 開発サーバーを起動（ポート3500、React Query DevTools有効）
- `npm run build` - APIクライアントを自動生成 → プロダクションビルド
- `npm run start` - プロダクションサーバーを起動
- `npm run generate:api` - APIクライアントコードを生成（Orval + Prettier）
- `npm run lint` - ESLintでコードをチェック

## 開発ツール

### React Query DevTools

開発サーバー起動時、ブラウザ右下に React Query DevTools が表示されます。
- クエリの状態（fetching, success, error）
- キャッシュの内容
- リフェッチ、無効化などの操作

### デバッグページ

- `/auth-debug` - トークン状態の確認、手動リフレッシュ

## 参考リンク

- [Brave Frontier Heroes API](https://api.bravefrontierheroes.com/swagger/doc.json)
- [Next.js Documentation](https://nextjs.org/docs)
- [TanStack Query](https://tanstack.com/query)
- [Orval](https://orval.dev/)
- [shadcn/ui](https://ui.shadcn.com/)
