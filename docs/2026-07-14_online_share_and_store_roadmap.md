# GRID ATLAS オンライン共有・ストア公開ロードマップ / 実装仕様書

作成日: 2026-07-14
対象: GRID ATLAS のオンライン共有機能、および iPhone / Android ストア公開に向けたパッケージ化

## 1. 結論

次の大きな開発順序は以下を推奨する。

1. オンライン共有のMVPを作る
2. 共有データ形式とプライバシー設計を固める
3. CapacitorでiOS/Androidパッケージ化する
4. ストア審査向けの説明、権限、プライバシーポリシーを整える
5. TestFlight / Google Play内部テストで実機検証する
6. 公開申請する

理由は、GRID ATLASの価値が「地図そのもの」ではなく「地点・線・実軌道・道直比・対象接近の関係性を共有できること」にあるため。ストア化だけを先に行うと、単なるWebアプリの包み込みに見えやすい。共有機能を先に入れると、アプリとしての独自性と実用性を説明しやすくなる。

## 2. サーバー費用に関する整理

### 2.1 結論

ネットを通じた共有リンクを発行するなら、基本的には開発者側でサーバーまたはサーバーレス基盤を用意する必要がある。

ただし、初期MVPは無料枠で開始できる可能性が高い。費用が発生するのは、主に以下の場合。

- 無料枠を超えるアクセス、保存容量、書き込み回数が発生した
- カスタムドメイン、安定運用、ログ保持、監視、バックアップを強化したい
- 写真など大きなデータを共有対象に含める
- ストア公開後にユーザーが増え、無料枠の制限では不安定になる

### 2.2 サーバーなしでできる共有

以下は追加サーバー不要。

- JSONファイルの書き出し / 読み込み
- OS共有シートでJSONファイルを送る
- 小規模データをURL hashに圧縮して埋め込む共有

ただし、URL埋め込み型はデータ量に弱く、複数観察記録や写真を含む共有には向かない。

### 2.3 推奨するサーバー構成

推奨は Cloudflare Workers + D1 + R2。

- Workers: APIエンドポイント
- D1: 共有ID、期限、メタ情報、削除状態の管理
- R2: 暗号化済み共有データ本体の保存

理由:

- 小さなAPIと短命データ保存に向く
- 地理的に広い配信に強い
- R2は標準ストレージで一定の無料枠があり、エグレス課金がない
- D1は小規模プロトタイプに十分な無料枠がある
- 将来、GitHub PagesからCloudflare側に移す選択肢も取りやすい

### 2.4 参考価格、2026-07-14時点

必ず実契約前に公式ページで再確認する。

- Cloudflare Workers Free: 100,000リクエスト/日。Paidは最低 $5/月、Standardで月1,000万リクエスト込み、超過は $0.30/100万リクエストなど。出典: https://developers.cloudflare.com/workers/platform/pricing/
- Cloudflare D1 Free: 5百万 rows read/日、10万 rows written/日、5GB storage。Paidでは月250億 rows read、5,000万 rows written、5GB込みなど。出典: https://developers.cloudflare.com/d1/platform/pricing/
- Cloudflare R2 Free: 10GB-month storage、Class A 100万/月、Class B 1,000万/月、エグレス無料。標準ストレージは $0.015/GB-month。出典: https://developers.cloudflare.com/r2/pricing/
- Supabase Free: DB 500MB、Storage 1GB、Edge Function 500,000 invocationsなど。Proは $25/月。出典: https://supabase.com/pricing
- Apple Developer Program: App Store配布には $99/年。出典: https://developer.apple.com/programs/
- Google Play Console: 開発者登録に US$25 の一回払い。出典: https://support.google.com/googleplay/android-developer/answer/6112435

費用感としては、写真共有なし、JSON共有中心なら、当面は無料枠または低額で足りる可能性が高い。写真共有を標準化すると、保存容量とアクセス回数が効いてくるため、写真は初期状態で共有OFFにする。

## 3. オンライン共有の設計方針

### 3.1 原則

- 共有はユーザーが明示的に実行した時だけ行う
- 共有前に内容をプレビューする
- 位置情報を含むことを明示する
- 写真はデフォルトで共有しない
- 共有リンクは期限付きにする
- 共有リンクを知っている人だけが読める設計にする
- 可能ならサーバー側では内容を読めない暗号化リンク型にする

### 3.2 共有対象

共有対象は3分類にする。

#### 地点リスト共有

含むもの:

- points
- point title
- geo
- note
- createdAt
- photoはオプション

含まないもの:

- 現在地
- 端末固有情報
- ローカル保存キー

#### 観察記録共有

含むもの:

- observations
- start
- target
- trail
- metrics
- title
- startedAt / endedAt

含まないもの:

- 記録中の未確定トレイル。ただし共有実行時に明示確認した場合のみsnapshot化する

#### 表示セット共有

含むもの:

- points
- links
- observations
- viewport
- grid scale hint
- selected itemsは原則含めない。ただし「選択対象だけ共有」では含む

これは旧「全体保存」とは別概念にする。保存/読込のUIには戻さず、「共有用パッケージ」として扱う。

## 4. 共有データ形式

### 4.1 Envelope

```json
{
  "type": "grid-atlas-share",
  "version": 1,
  "createdAt": "2026-07-14T00:00:00.000Z",
  "expiresAt": "2026-08-13T00:00:00.000Z",
  "title": "水戸調査セット",
  "summary": {
    "points": 12,
    "links": 8,
    "observations": 2,
    "hasPhotos": false
  },
  "payload": {
    "points": [],
    "links": [],
    "observations": [],
    "viewport": null
  }
}
```

### 4.2 暗号化保存形式

サーバーに保存する本文は暗号化済みJSON文字列とする。

```json
{
  "id": "share_abc123",
  "version": 1,
  "createdAt": "2026-07-14T00:00:00.000Z",
  "expiresAt": "2026-08-13T00:00:00.000Z",
  "algorithm": "AES-GCM",
  "iv": "base64url",
  "ciphertext": "base64url",
  "meta": {
    "points": 12,
    "links": 8,
    "observations": 2,
    "hasPhotos": false
  }
}
```

共有URL:

```text
https://gridatlas.app/s/{shareId}#key={base64urlKey}
```

重要: URL fragment `#key=...` は通常HTTPリクエストでサーバーへ送られない。これにより、サーバーは復号キーを持たず、暗号化済み本文だけを保存する。

### 4.3 ID仕様

- shareIdは128bit以上のランダム値をbase64url化
- 推測困難であること
- IDにユーザー名や日時を含めない
- TTL切れ後は取得不可

## 5. API仕様

### 5.1 POST /api/shares

目的: 暗号化済み共有データを保存する。

Request:

```json
{
  "version": 1,
  "expiresInDays": 30,
  "ciphertext": "base64url",
  "iv": "base64url",
  "meta": {
    "points": 12,
    "links": 8,
    "observations": 2,
    "hasPhotos": false,
    "bytes": 12345
  }
}
```

Response:

```json
{
  "id": "share_abc123",
  "expiresAt": "2026-08-13T00:00:00.000Z"
}
```

Validation:

- ciphertext size limit: MVPは1MB以下
- 写真込みはMVPでは禁止、または5MB上限
- expiresInDays: 1, 7, 30 のみ
- metaは信用しない。表示補助のみ

### 5.2 GET /api/shares/:id

目的: 暗号化済み共有データを取得する。

Response:

```json
{
  "id": "share_abc123",
  "version": 1,
  "createdAt": "2026-07-14T00:00:00.000Z",
  "expiresAt": "2026-08-13T00:00:00.000Z",
  "ciphertext": "base64url",
  "iv": "base64url",
  "meta": {
    "points": 12,
    "links": 8,
    "observations": 2,
    "hasPhotos": false
  }
}
```

Errors:

- 404: 存在しない、削除済み、期限切れ
- 410: 期限切れを明示したい場合。ただし存在推測を避けるなら404で統一
- 413: サイズ超過
- 429: レート制限

### 5.3 DELETE /api/shares/:id

MVPでは不要。将来、削除トークンを発行して対応する。

削除URL:

```text
https://gridatlas.app/s/{shareId}/delete#deleteKey=...
```

## 6. DB仕様

D1想定。

```sql
CREATE TABLE shares (
  id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  deleted_at TEXT,
  size_bytes INTEGER NOT NULL,
  point_count INTEGER NOT NULL DEFAULT 0,
  link_count INTEGER NOT NULL DEFAULT 0,
  observation_count INTEGER NOT NULL DEFAULT 0,
  has_photos INTEGER NOT NULL DEFAULT 0,
  read_count INTEGER NOT NULL DEFAULT 0,
  last_read_at TEXT
);

CREATE INDEX idx_shares_expires_at ON shares(expires_at);
```

R2 object key:

```text
shares/{yyyy}/{mm}/{shareId}.json
```

期限切れ削除:

- Cron Triggerを1日1回実行
- D1から期限切れを抽出
- R2 object削除
- D1 deleted_at更新、または行削除

## 7. フロント実装仕様

### 7.1 新UI

クイックボタンに追加するかは慎重に判断する。今の12機能はすでに密度が高い。共有はデータパネルまたは選択情報エリアに置くのがよい。

推奨UI:

- データパネルに「共有」セクションを追加
- ボタン: `共有リンク作成`
- 選択中なら「選択対象を共有」
- 未選択なら「表示中データを共有」

共有前モーダル:

- タイトル
- 共有範囲: 選択対象 / 表示中全体
- 含める内容: 地点、線、観察記録
- 写真を含める: OFF固定、将来ON
- 期限: 1日 / 7日 / 30日
- 注意文: 位置情報を含むリンクです
- 実行: 共有リンク作成

作成後:

- URL表示
- コピー
- OS共有
- 閉じる

### 7.2 受信UI

URLアクセス時:

1. `/s/{id}` ルートを検知
2. `#key` を取得
3. APIから暗号化データ取得
4. ブラウザ内で復号
5. 共有プレビュー表示
6. `新規読込` / `追加読込` を選択

プレビュー表示:

- タイトル
- 地点数
- 線数
- 観察記録数
- 作成日時
- 期限
- 写真有無

### 7.3 既存データ機能との整合

- 地点リスト: 保存 / 新規読込 / 追加読込を維持
- 観察記録: 保存 / 新規読込 / 追加読込を維持
- 共有: ファイル保存とは別の「送る」機能
- グリッド初期化は従来通り確認あり

## 8. セキュリティ・プライバシー仕様

### 8.1 共有前警告

文言案:

```text
この共有には登録地点や観察記録の位置情報が含まれます。
リンクを知っている人は内容を読み込めます。写真は初期状態では含めません。
```

### 8.2 暗号化

- Web Crypto APIを使用
- AES-GCM 256bit
- 鍵はブラウザで生成
- 鍵はURL fragmentにのみ置く
- サーバーには鍵を送らない

### 8.3 ログ方針

- サーバーログにIPは残り得る
- アプリ側でユーザー識別子は発行しない
- 共有本文は暗号化済み
- アクセス解析はMVPでは入れない

### 8.4 写真

MVPでは写真共有はOFF。

理由:

- 個人情報・位置情報が含まれやすい
- EXIF除去が必要
- 容量課金に影響する
- ストア審査上の説明が増える

将来対応する場合:

- EXIF除去
- 圧縮
- 共有前プレビュー
- 写真ごとのON/OFF

## 9. ストアパッケージ化仕様

### 9.1 方針

Capacitorを採用する。

理由:

- 現在のWeb実装資産を活かせる
- iOS/Android両対応が現実的
- 必要に応じてネイティブ権限、共有、ファイル、ディープリンクを追加できる
- フル移植よりリスクと工数が小さい

### 9.2 必須ネイティブ機能

- Geolocation permission
- Share sheet
- File picker / File save
- Deep links / Universal Links / App Links
- Local storage persistence
- Splash screen
- App icon
- Safe area handling

### 9.3 初期は避ける機能

- 背景位置情報
- 常時位置追跡
- アカウント作成
- プッシュ通知
- 課金
- 広告

理由: 審査とプライバシー説明の負荷が上がるため。

### 9.4 ディープリンク

Web:

```text
https://gridatlas.app/s/{shareId}#key=...
```

App:

- iOS Universal Links
- Android App Links
- 未インストール時はWebで開く
- インストール済みならアプリで開く

### 9.5 権限説明

iOS `Info.plist` 例:

```text
NSLocationWhenInUseUsageDescription:
現在地をグリッド上に表示し、対象地点との距離や観察記録を作成するために使用します。
```

Android permission:

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

背景位置情報は申請しない。

## 10. ストア審査対策

### 10.1 Apple向け

AppleのApp Review Guideline 4.2では、単なるWebサイト再包装ではなく、アプリとしての有用性、UI、機能が必要とされる。

対策:

- App Store説明文では「地図アプリ」ではなく「グリッド上で地点関係、観察軌道、道直比を扱う位置観察ツール」と説明する
- オフラインでも地点・線・観察記録の閲覧と編集ができることを強調
- 位置情報は任意で、追従/観察にのみ使用する
- 共有はユーザー操作時のみ
- レビュー用メモに観察モード、共有、ファイル入出力、グリッド表示を明記

### 10.2 Google Play向け

Google Playでは限定的な機能しかないアプリや不安定なアプリが問題になる。

対策:

- 内部テストで実機安定性を確認
- Data safetyを正確に申告
- 位置情報、ファイル、写真を扱う場合は用途を明確にする
- WebViewだけでなく、共有、ファイル、位置、ディープリンクなど端末機能と統合する

### 10.3 プライバシーポリシー必須項目

- 取得するデータ: 位置情報、登録地点、観察記録、写真任意
- 利用目的: 表示、距離計算、観察記録、共有
- 保存場所: 端末内。共有時のみ暗号化してサーバー保存
- 共有: ユーザーが共有リンクを作成した場合のみ
- 削除: 端末内データ削除、共有期限切れ削除
- 第三者提供: 原則なし。外部地図アプリ起動時は各サービスへ遷移

## 11. ロードマップ

### Phase 0: 仕様固定

期間目安: 0.5-1日

成果物:

- この仕様書の確定
- 共有対象の範囲決定
- 写真共有をMVPから外す判断
- Cloudflare / Supabaseのどちらを使うか決定

推奨決定:

- Cloudflare Workers + D1 + R2
- 写真共有なし
- 暗号化リンク型
- 期限は1日/7日/30日

### Phase 1: ローカル共有パッケージ

期間目安: 1-2日

実装:

- `createSharePayload(scope)`
- `validateSharePayload(payload)`
- `applySharePayload(payload, mode)`
- 共有プレビューUI
- 選択対象 / 表示中全体の切り替え

この段階ではサーバー不要。

完了条件:

- 共有パッケージJSONを生成できる
- 生成JSONを新規読込/追加読込できる
- 既存の地点リスト/観察記録読込と衝突しない

### Phase 2: URL hash共有MVP

期間目安: 1日

実装:

- 小さい共有データを圧縮してURL hashに埋める
- サイズ上限を超えたらオンライン共有へ誘導

これはサーバーなしで試せる中間段階。

完了条件:

- 小規模データをリンクだけで共有できる
- URL長制限を超えた場合に明確なエラーを出す

### Phase 3: オンライン共有API

期間目安: 2-4日

実装:

- Cloudflare Worker
- D1 schema
- R2保存
- POST /api/shares
- GET /api/shares/:id
- 期限切れ削除cron
- レート制限
- CORS設定

完了条件:

- 暗号化済みデータを保存できる
- 共有URLから復号して読み込める
- 期限切れデータが読めない
- サーバーに復号キーを送っていない

### Phase 4: OS共有統合

期間目安: 1日

実装:

- Web Share API対応
- 非対応ブラウザではコピーUI
- iOS Safari / Android Chromeで確認

完了条件:

- LINE、メール、メッセージ等へリンク共有できる
- コピー失敗時のフォールバックがある

### Phase 5: Capacitor導入

期間目安: 2-5日

実装:

- Capacitor初期化
- iOS platform追加
- Android platform追加
- webDir設定
- アイコン/スプラッシュ整理
- Geolocation plugin/権限設定
- Share plugin
- Filesystem/Browser必要性確認
- Universal Links / App Links設計

完了条件:

- iPhone実機で起動
- Android実機で起動
- 現在地取得、追従、観察、共有リンク作成が動く
- PWA版とデータ形式互換

### Phase 6: ストア審査準備

期間目安: 3-7日

実装/作業:

- プライバシーポリシー作成
- サポートURL作成
- App Store / Google Play説明文
- スクリーンショット
- レビュー用説明
- Data safety / Privacy Nutrition Labels整理
- TestFlight
- Google Play内部テスト

完了条件:

- 審査提出可能なメタデータが揃う
- 位置情報利用目的が明確
- 共有機能の安全性を説明できる

## 12. 受け入れ基準

### オンライン共有

- 選択対象だけ共有できる
- 表示中全体を共有できる
- 共有前に位置情報を含む警告が出る
- 写真はデフォルトで含まれない
- 共有リンクを開くとプレビューが出る
- 新規読込/追加読込を選べる
- 複数観察記録を共有できる
- サーバーに復号キーを送らない
- 期限切れリンクは読めない

### ストアパッケージ

- iOS/Androidで現在地取得が動く
- 観察モードが動く
- ファイル保存/読込が動く
- 共有リンク作成/受信が動く
- オフラインで既存データを閲覧できる
- 権限説明が自然
- 背景位置情報を要求しない

## 13. リスクと対策

### リスク: 共有リンクによる位置情報漏えい

対策:

- 共有前警告
- 暗号化リンク
- 期限付き
- 写真OFF
- 削除トークンを将来追加

### リスク: 無料枠超過

対策:

- 写真共有OFF
- サイズ上限
- 期限付き削除
- レート制限
- Cloudflareダッシュボードで使用量監視

### リスク: ストアでWebView包み込み扱い

対策:

- アプリ説明で独自用途を明確化
- ネイティブ共有、ファイル、ディープリンク、位置権限を統合
- オフライン編集可能な実用ツールとして見せる

### リスク: 背景位置情報の審査負荷

対策:

- 初期版では背景位置情報を要求しない
- 追従はアプリ起動中のみ

## 14. 初回実装でやらないこと

- アカウント機能
- 友達リスト
- 公開ギャラリー
- コメント共有
- 共同編集
- 背景追跡
- 写真共有ON
- 課金
- 広告

理由: アプリの本質から遠く、プライバシー・審査・運用コストを増やすため。

## 15. 次の具体タスク

1. `grid-atlas-share-v1` のJSON生成/読込をローカル実装
2. 共有プレビューUIを追加
3. 小規模URL hash共有を試作
4. Cloudflare構成を作成
5. 暗号化リンク共有を実装
6. 共有受信画面を整える
7. Capacitorブランチを作る
8. iOS/Android実機検証
9. プライバシーポリシーとストア文言を作る

## 16. 判断メモ

現時点の推奨は、サーバー費用を恐れて共有機能を諦めるのではなく、まずサーバー不要の共有パッケージとURL hash共有を作り、その後にCloudflareの無料枠で暗号化リンク共有へ進むこと。

そのうえで、ストア公開が近づいた段階で、月額$5程度のWorkers Paidや独自ドメインを受け入れるか判断すればよい。アプリの方向性から見て、オンライン共有はかなり重要な機能なので、最終的には小さなサーバー運用を持つ価値がある。