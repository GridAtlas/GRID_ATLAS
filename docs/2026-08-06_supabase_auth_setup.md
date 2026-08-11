# Supabase Auth 設定メモ

認証UIは、Supabase Authの設定がある場合だけ有効になる。設定が空の場合は、従来のテスターアクセスコードを使う。

## Supabase側

1. Supabaseで新しいプロジェクトを作る
2. AuthenticationでEmail/Passwordを有効にする
3. 開発中はEmail Confirmationsを有効にする
4. URL Configurationへ次を追加する

```text
http://127.0.0.1:5177/
https://gridatlas.github.io/GRID_ATLAS/
```

5. Project URLとPublishable keyを控える

ブラウザにはPublishable keyだけを置く。`service_role` keyや秘密鍵は絶対に置かない。

## Web側

`index.html`の空のmeta値を置き換える。

```html
<meta name="grid-atlas-supabase-url" content="https://PROJECT_REF.supabase.co">
<meta name="grid-atlas-supabase-publishable-key" content="sb_publishable_...">
```

## Worker staging側

Supabase AuthのJWT署名鍵と検証条件をstagingへ設定する。

```text
AUTH_JWKS_URL=https://PROJECT_REF.supabase.co/auth/v1/.well-known/jwks.json
AUTH_ISSUER=https://PROJECT_REF.supabase.co/auth/v1
AUTH_AUDIENCE=authenticated
```

`AUTH_JWKS_URL`、`AUTH_ISSUER`、`AUTH_AUDIENCE`はWorkerの変数として設定し、秘密情報はSecretとして扱う。現在のWorkerはJWTの`sub`をD1の`owner_id`に使用する。

## 確認手順

- Webで登録すると確認メールが届く
- メールのリンクからWebへ戻る
- ログイン後、Worker APIへJWTが送られる
- D1ではSupabaseのユーザーIDだけが`owner_id`になる
- 別アカウントから他人のリストが見えない

参考:

- https://supabase.com/docs/reference/javascript/auth-signup
- https://supabase.com/docs/reference/javascript/auth-signinwithpassword
- https://supabase.com/docs/guides/auth/jwts

