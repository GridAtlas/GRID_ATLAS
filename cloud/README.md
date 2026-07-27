# GRID ATLAS Cloud API

Cloudflare Workers + D1で動く、自分用地点リストCloudベータです。

- Worker: `https://grid-atlas-cloud-staging.kazki1981.workers.dev`
- D1: `grid-atlas-cloud-staging`（APAC）
- Web: `https://gridatlas.github.io/GRID_ATLAS/`

共通形式の `grid-atlas-share` v1は現在も **proposed** です。このベータはWeb先行の検証であり、Cloudflareの正式採用や共通契約のAccepted化を意味しません。

## 認証

- 自分用ベータでは、Bearer値をCloudflare Worker Secrets `PERSONAL_ACCESS_CODE` / `FRIEND_ACCESS_CODE`と照合する。
- SecretはSHA-256へ揃えた後に定数時間比較し、ソース・`wrangler.jsonc`・Gitへ保存しない。
- ローカル控えはGit管理外の `GRID_ATLAS_CLOUD_ACCESS_CODE_PRIVATE.txt`。値を変更する場合はSecretも同時に更新する。
- 将来の複数ユーザー化に備え、Secret未設定環境では既存のJWT/JWKS検証へフォールバックする。
- 個人ベータのownerは `PERSONAL_OWNER_ID=personal-beta`、友達テスト領域は `FRIEND_OWNER_ID=friend-beta` に分離する。

## データ境界

- クラウド保存はユーザーが明示的に実行した場合だけ。
- 地点リスト名、説明、地点名、緯度経度、コメントだけを送る。
- 写真、現在地、追跡、選択、画面状態、線は送らない。
- 更新と削除は `expectedRevision` による楽観ロックを使う。
- 基本のローカル機能はアクセスコードなしでも利用できる。

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

## API

```text
GET    /v1/me/lists
POST   /v1/me/lists
GET    /v1/me/lists/:listId
PUT    /v1/me/lists/:listId
DELETE /v1/me/lists/:listId
```

作成は `grid-atlas-share` v1ペイロード、更新・削除は `expectedRevision` を受け取る。競合時は409を返し、自動マージしない。削除は現在は論理削除。

## 未決事項

- 正式な認証プロバイダーと複数ユーザーログイン
- Cloudflareを正式Backendとして採用するか
- Web／Native間のSchema・ID・同期ルール
- 削除保持期間、容量上限、料金運用
