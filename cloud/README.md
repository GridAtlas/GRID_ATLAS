# GRID ATLAS Cloud API

Cloudflare Workers + D1で動く、ユーザー専用地点リストAPIのローカル／staging骨格です。
Web UIにはまだ接続せず、実Cloudflare環境にもまだデプロイしません。

共通形式の `grid-atlas-share` v1は現在も **proposed** です。ここにあるAPIは、その案を検証するためのWeb先行実装であり、共通契約をAcceptedへ変更するものではありません。

## 守っている境界

- ログインなしのWebローカル機能は従来どおり利用できる
- クラウド保存は明示的なAPI操作だけで行う
- 現在地、追跡状態、選択状態、画面状態は保存しない
- D1はWorkerの `DB` bindingからだけ利用する
- 全APIでBearer JWTを検証し、`owner_id`でデータを分離する
- 更新と削除は `expectedRevision` が一致した場合だけ成功する
- 認証未設定時に開発用バイパスは作らず503を返す

## セットアップ

```powershell
npm install
npm test
```

`wrangler.jsonc` がWorker設定の正本です。トップレベル設定はローカル開発用、`staging` environmentは将来の実環境用です。
`0000...` と `1111...` のD1 IDは意図的なプレースホルダーなので、実環境作成前に置き換えてください。

認証プロバイダ決定後、環境ごとに宣言済みの次の空値を実値へ置き換えます。

- `AUTH_JWKS_URL`: 公開JWKSエンドポイント
- `AUTH_ISSUER`: JWT issuer
- `AUTH_AUDIENCE`: GRID ATLAS APIのaudience
- `WEB_ORIGINS`: 許可するブラウザoriginのカンマ区切り一覧

アクセストークン、秘密鍵、クライアントシークレットはソースや `wrangler.jsonc` に保存しません。ローカル秘密値が必要になった場合は、Git管理外の `.dev.vars` を使います。

## 開発コマンド

```powershell
npm run cloud:types    # binding型を cloud/worker-configuration.d.ts に生成
npm run cloud:dev      # ローカルWorker + ローカルD1
npm test               # Workers runtime + D1 + JWT統合テスト
npm run cloud:dry-run  # デプロイせずbundleとbindingを検証
npm run check          # Web構文チェック + Cloud API統合テスト
```

統合テストは実ネットワークを使わず、一時ECDSA鍵、モックJWKS、ローカルD1 migrationで次を検証します。

- JWT署名、有効期限、未認証
- CORSと機密レスポンスの `no-store`
- 所有者間のデータ分離
- 作成・一覧・取得・更新・論理削除
- revision競合
- Schema、ID、日時、座標、本文サイズの入力検証

## API

```text
GET    /v1/me/lists
POST   /v1/me/lists
GET    /v1/me/lists/:listId
PUT    /v1/me/lists/:listId
DELETE /v1/me/lists/:listId
```

すべてBearerトークンが必要です。

### 作成

POST本文は `grid-atlas-share` v1ペイロードそのもの、または `{ "payload": <payload> }` を受け取ります。

### 更新

```json
{
  "expectedRevision": 3,
  "payload": {
    "type": "grid-atlas-share",
    "schemaVersion": 1,
    "kind": "point-list",
    "list": {
      "id": "stable-list-id",
      "name": "地点リスト"
    },
    "points": []
  }
}
```

revisionが古い場合は409を返し、クラウド側の現在値とrevisionを返します。自動マージはしません。

### 削除

```json
{ "expectedRevision": 4 }
```

初期版は論理削除です。復旧APIと保持期間は未決定です。

## stagingへ進む前に必要な決定

- `grid-atlas-share` SchemaとWeb／Native変換規則
- 認証プロバイダ、issuer、audience
- Cloudflareアカウントの所有・課金運用
- D1削除保持期間と容量上限

これらをユーザーが決定した後にD1を作成し、`cloud/migrations` を適用して `wrangler deploy --env staging` へ進みます。
