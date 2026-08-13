# GRID ATLAS Cloud API

Cloudflare Workers + D1で動く、アクセスコード式の地点リストCloudベータです。

- Worker: `https://grid-atlas-cloud-staging.kazki1981.workers.dev`
- D1: `grid-atlas-cloud-staging`（APAC）
- Web: `https://gridatlas.github.io/GRID_ATLAS/`

共通形式の `grid-atlas-share` v1は現在も **proposed** です。このベータはWeb先行の検証であり、Cloudflareの正式採用や共通契約のAccepted化を意味しません。

## 認証

- 個別ユーザーはSupabase JWTをBearer値として送る。
- テスター権限は `X-Tester-Code` ヘッダーで追加付与する。テスターコードは通常の個別ログインとは独立して扱う。
- 個別IDなしの旧テスターは、従来どおりテスターコードをBearer値として送れる。新しい画面ではテスター共有リストだけを表示する。
- 個別ID＋テスターコードでは、自分のマイリスト（クラウド）とテスター共有リストの両方を返す。
- テスター向けサインアップは `POST /v1/test-signups` だけを入口にし、Workerが `X-Tester-Code` を検証してからSupabase Admin APIの招待メールを送る。登録内容は `test_signup_registrations` に保存し、Supabaseユーザーメタデータにも `tester_signup=true` と `grid_name` を付ける。
- リスト作成時は `X-Cloud-Scope: mine` または `X-Cloud-Scope: testerShared` で保存先を指定できる。後者はテスター権限が必要。
- アクセスコード式ベータでは、Bearer値をCloudflare Worker Secrets `PERSONAL_ACCESS_CODE` / `FRIEND_ACCESS_CODE`と照合する。
- SecretはSHA-256へ揃えた後に定数時間比較し、ソース・`wrangler.jsonc`・Gitへ保存しない。
- ローカル控えはGit管理外の `GRID_ATLAS_CLOUD_ACCESS_CODE_PRIVATE.txt`。値を変更する場合はSecretも同時に更新する。
- 将来の複数ユーザー化に備え、Secret未設定環境では既存のJWT/JWKS検証へフォールバックする。
- 個人ベータのownerは `PERSONAL_OWNER_ID=personal-beta`、友達テスト領域は `FRIEND_OWNER_ID=friend-beta` に分離する。旧テスターコードのデータは `testerShared` scopeとして返す。

## データ境界

- クラウド保存はユーザーが明示的に実行した場合だけ。
- 地点リスト名、説明、地点名、緯度経度、コメントだけを送る。
- 写真、現在地、追跡、選択、画面状態、線は送らない。
- 更新と削除は `expectedRevision` による楽観ロックを使う。
- 基本のローカル機能はアクセスコードなしでも利用できる。
- 1回の地点リストJSON本文は1MiBまで。D1の2MB行上限を超えない範囲で、大容量の地点リストを受け付ける。

## 開発・検証

```powershell
npm run check
npm run cloud:types
npm run cloud:dry-run
npx wrangler d1 migrations apply grid-atlas-cloud-staging --remote --env staging
npx wrangler deploy --env staging
```

Secretの設定・ローテーションは、値をコマンド引数やログへ出さずに行う。

```powershell
Get-Content -LiteralPath GRID_ATLAS_CLOUD_ACCESS_CODE_PRIVATE.txt -Raw | npx wrangler secret put PERSONAL_ACCESS_CODE --env staging
Get-Content -LiteralPath GRID_ATLAS_FRIEND_ACCESS_CODE_PRIVATE.txt -Raw | npx wrangler secret put FRIEND_ACCESS_CODE --env staging
```

SupabaseのSecret keyはブラウザへ出さず、Worker Secretとして一度だけ登録する。

```powershell
npx wrangler secret put SUPABASE_SECRET_KEY --env staging
```

## API

```text
GET    /v1/me/lists
POST   /v1/test-signups
POST   /v1/me/lists
GET    /v1/me/lists/:listId
PUT    /v1/me/lists/:listId
DELETE /v1/me/lists/:listId
```

作成は `grid-atlas-share` v1ペイロード、更新・削除は `expectedRevision` を受け取る。競合時は409を返し、自動マージしない。削除は現在は論理削除。

登録者の確認はD1で次のように行う。

```sql
SELECT created_at, email, grid_name, auth_user_id, tester_owner_id, status
FROM test_signup_registrations
ORDER BY created_at DESC;
```

このAPIを有効にした後、Supabase Authenticationの「Allow new users to sign up」はオフにする。これにより、公開の `auth.signUp()` 直呼びを止め、テスターコード付きWorker APIだけが新規登録の入口になる。

## 未決事項

- 正式な認証プロバイダーと複数ユーザーログイン
- Cloudflareを正式Backendとして採用するか
- Web／Native間のSchema・ID・同期ルール
- 削除保持期間、容量上限、料金運用
