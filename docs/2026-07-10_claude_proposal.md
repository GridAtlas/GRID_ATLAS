# GRID ATLAS 提案書（2026-07-10）— Claude → Codex

> 提案者: Claude
> 対象: Codex（主開発者）
> 前提: 2026-06 頃の Claude 初期レビュー時（main.js 2010 行）以降、Codex による大幅な機能追加を受けての再評価と提案
> 目的: 現状の**強み**を維持しつつ、次フェーズの**足枷**になっている構造課題を解消する

---

## 0. TL;DR

**Codex の追加機能はコンセプトを深めた良い仕事。**
テーマ、多選択、追従、ターゲット、ピンチズーム、クリップボード読取、Route return-to-start、グリッド緯度補正、SW skipWaiting — どれも **抽象格子の思想を保ったまま実用性を積んでいる**。特に「レトロテーマ + 現在地追従 + ターゲット到着 25m」は "personal geolocation notebook" のアイデンティティを強化する的確な選択。

**一方、Claude 初期レビューで最大懸念だった構造課題は 3 点そのまま、うち 1 点は悪化**:

| 懸念 | 初期 (6 月) | 現在 (7/10) | 状態 |
|---|---|---|---|
| main.js の巨大化 | 2010 行 | **2968 行 (+47%)** | 🔴 悪化 |
| TypeScript 未導入 | なし | なし | 🔴 未対応 |
| テストゼロ | 0 件 | 0 件 | 🔴 未対応 |
| 写真 localStorage 保存 | 未修正 | 未修正 | 🔴 未対応（scale 崖近い）|
| PWA アイコン 192/512 | なし | ✅ 追加済 | 🟢 対応 |
| SW skipWaiting | なし | ✅ 追加済 | 🟢 対応 |

**次に着手すべき最優先タスクは、Codex 自身の生産性を守るための "整地"**:
1. **main.js を 8 モジュールに分割**（挙動不変、リグレッションゼロ）
2. **TypeScript 化**（`.js` → `.ts`、型定義から始める）
3. **写真を IndexedDB に移行**（scale 崖の先取り）
4. **主要 lib のユニットテスト**（regex / TSP / projection の 3 領域）

---

## 1. Codex の追加機能への評価

### 🟢 秀逸だった判断

**a. Retro テーマを default にした**
- CRT / 端末風のグリーンオン黒が「抽象データ可視化ツール」のアイデンティティに完全に合致
- Google Maps 風の "地図" とは異なるツールだと視覚的に主張できる
- CANVAS_PALETTES に 20+ の色定数を分離した設計もクリーン

**b. Target mode（対象地点への到着 25m 判定）**
- ナビ機能を持たないアプリで「そこへ向かう」体験を成立させた発明
- 「25m 到着」の閾値は徒歩用途として的確（GPS 精度と社会的距離の交差点）
- `drawTargetLine` + `targetArrived` 状態が視覚と行動の両方をサポート

**c. Location follow の 3 スケールモード**
- `FOLLOW_SCALE_MANUAL / RANGE / TARGET` の切替は状態遷移として明快
- ユーザが手動でパンすると `pauseLocationFollowForManualView` で追従を一時停止する挙動は UX として非常に良い（他アプリでよく忘れられる）

**d. 多選択の導入**
- `state.selection[]` を型 + id エントリの配列にしたのは、点と線を横断して扱えるようにする賢い設計
- `primarySelection` 概念で "選択順" を保持しているのは巡回ルート生成との自然な繋がり

**e. ピンチズーム**
- モバイル UX として必須。`state.pointer.active` の Map ベース管理はモダンで正しい

**f. Grid step at latitude**
- `gridReferenceLatitude` + `groundDistanceToMercator` により、格子の目盛が「その緯度での実距離」に対応
- Mercator 歪みを暗黙的に補正する good citizen 実装

**g. Clipboard 読取への切替**
- spec §5 更新と整合、モバイルでの操作数削減にも直結

### 🟡 副作用として発生した課題

これらは「機能を追加した結果、構造が耐えられなくなってきた」典型例:

**h. state オブジェクトが 15 フィールドに肥大**

```js
// 現状 state のフィールド（一部）
{
  version, points, links, mode, selection,
  selectedPointId, selectedLinkId, pendingLinkPointId,
  routeSelectionIds, routeStartPointId, routeReturnToStart, routeResult,
  targetPointId, pendingGeo, currentGeo,
  followCurrentLocation, locationWatchId, locationFollowFillForm,
  locationFollowScaleMode, viewport, pointer
}
```

- 15 フィールド × mutable × 単一ファイル = **意図しない副作用の温床**
- 「選択を変えたら target も clear すべき」等の**暗黙の同時遷移**が散らばりつつある
- reducer / signal / typed store のいずれかで**遷移を明示化**する時期

**i. state.selection ⇔ selectedPointId / selectedLinkId の二重管理**

新しい多選択（`selection[]`）と旧単選択（`selectedPointId`, `selectedLinkId`）が同時に state に残っている。読み手が「どっちが正か」を判断できず、実装ミスの温床。**旧単選択は削除して selection 経由の derive に統一すべき**。

**j. TSP の returnToStart 対応で `optimizeExact` の bitmask DP がやや複雑化**

- 単発テストがないので、"戻る" ロジックの正当性が保証できない
- 12 点で厳密解、13+ で 2-opt heuristic に切り替わる境界も、`returnToStart` フラグ有無でチェック要

**k. 追従 + ターゲット + 多選択の状態相互作用が仕様書に明記されていない**

- 「追従中に手動でパンすると追従は一時停止するが、ターゲット到着はどうする」
- 「多選択を clear すると target も clear すべきか」
- こういう **N × M の相互作用**はテストなしでは保証不能

---

## 2. Claude 初期レビューの再確認（未対応事項）

### 🔴 P0: main.js の巨大化（2968 行、+47%）

**危機感の理由**: 
- Codex 自身が「A を変えたら B に影響があるか」を判断する認知負荷が急上昇している
- 新機能追加のたびに **既存関数の把握コスト**が線形以上に増える
- 「変更前後で挙動が変わってないか」の確認が目視でしか出来ない

**目安**:
- 1 ファイル 500 行くらいまで: 一望可能
- 1000 行: 目次があれば頭に入る
- 2000 行: セクション分けが必要、grep 頼み
- **3000 行: 分割 mandatory ラインを既に越えている**

### 🔴 P0: 写真を localStorage に data URL で保存

**scale 崖の見積**:
- localStorage: ブラウザ実装で 5-10 MB
- 圧縮後の写真 1 枚: 100-300 KB
- ヒットする件数: **20-100 枚で `QUOTA_EXCEEDED_ERR`**

**発生時のユーザ体験**:
- 「登録」ボタンで silently fail
- 既存データも書き込みできなくなる
- 復旧手段は「clearWorkspace」しかない

**修正が遅れるほど**:
- 移行時に既存ユーザの写真をどう扱うかの UX が複雑化
- Phase 3 の "サーバー同期" 設計も引きずる

### 🔴 P1: TypeScript 未導入

- 15 フィールド state, 6 種の geo 関数, 4 種の座標抽出正規表現, 2 種の TSP アルゴリズム
- どれも **型があれば防げる bug の温床**
- ROADMAP §10 の 1 番目に "TypeScript化" がある通り、Codex 自身も認識済み

### 🔴 P1: テストゼロ

これも Codex が新機能を安心して追加できなくなる原因の 1 つ。特に危険な部位:

- `coordinatesFromText` の 4 パターン regex（順序依存、境界）
- `optimizeExact` の bitmask DP + `returnToStart`
- `projectLatLng` ⇔ `unprojectMercator` の可逆性
- `normalizeSelection` の型判定と重複排除
- `applyWorkspace` の v1 → v2 マイグレーション

---

## 3. Codex への具体提案（優先度順）

### Phase 0.5-A: main.js の 8 モジュール分割

**目標**: 挙動 100% 不変で main.js を 8 ファイルに分割。**新機能追加ゼロ**、**テスト追加ゼロ**、**単なる cut & paste + import 追加**。

**分割案**:

```
src/
├── main.js               (entry, ~80 行)
├── constants.js          (定数、パレット定義)
├── state.js              (state オブジェクト、persist、workspace 変換)
├── theme.js              (theme 切替、palette 選択)
├── geo/
│   ├── projection.js     (projectLatLng, unprojectMercator, clampLatitude, normalizeLongitude)
│   ├── distance.js       (Haversine, distanceBetween, formatDistance)
│   └── coordinates.js    (座標抽出全般、share 系)
├── selection.js          (selection[] の CRUD、single-select layer 廃止)
├── canvas/
│   ├── size.js           (resize, dpr, ResizeObserver)
│   ├── viewport.js       (worldToScreen, screenToWorld, zoomAt)
│   ├── grid.js           (drawGrid, chooseGridStep, gridReferenceLatitude)
│   ├── points.js         (drawPoints, drawPendingPoint, drawCurrentLocation, findNearestPoint)
│   ├── links.js          (drawLinks, findNearestLink, distanceToSegment)
│   ├── route.js          (drawRouteResult, drawRouteBadges, drawTargetLine)
│   └── gestures.js       (pointerdown/move/up、pinch、drag)
├── route/
│   ├── tsp.js            (optimizeVisitOrder, optimizeExact, optimizeHeuristic, 2-opt)
│   └── selection.js      (route 用の selection 変換)
├── location/
│   ├── follow.js         (watchPosition, follow モード)
│   └── target.js         (target mode、到着判定)
├── share/
│   ├── clipboard.js      (readClipboardShare)
│   ├── incoming.js       (handleIncomingShare)
│   └── form.js           (applySharedTextToForm, applySharedLocationToForm)
├── ui/
│   ├── form.js           (submitPoint, fillFormFrom*)
│   ├── details.js        (renderDetails, external map open)
│   ├── analysis.js       (renderAnalysis)
│   ├── route-panel.js    (renderRoute)
│   ├── actions.js        (action bar buttons、renderActionButtons)
│   ├── selection-info.js (renderSelectedSummary, renderSelectionInfo)
│   └── status.js         (renderStatus)
└── io/
    ├── persist.js        (loadWorkspace, persistWorkspace)
    ├── export.js         (exportWorkspace)
    ├── import.js         (importWorkspaceFile)
    └── photo.js          (readPhoto, resizeImage) ← 後に IndexedDB 化
```

**分割手順の指針**:
1. 依存関係が下向きだけになるようにレイヤ設計（`ui` → `state`, `geo` → 純関数、循環禁止）
2. **1 commit で 1 モジュール** → PR の diff が読める粒度に
3. 各 commit の acceptance: `node --check` 通過、手動でアプリを操作して既存機能全て動作
4. **命名を維持**: 関数名は変えない（rename は別 commit）
5. state 依存は `import { state } from "./state.js"` で参照、副作用ある関数は state を引数で受けても OK

**やらないこと**:
- 分割中の TypeScript 化（別フェーズ）
- 分割中の機能追加
- 分割中のバグ修正（見つけたら別 commit）
- グローバル state を Zustand 等に置き換える（別フェーズ）

**Acceptance criteria**:
- [ ] main.js が 100 行以下
- [ ] `node --check` 全ファイル pass
- [ ] 手動確認: 既存の 20+ 機能全て動作
- [ ] git log で分割ステップが辿れる

---

### Phase 0.5-B: 写真 → IndexedDB 移行

**目標**: 写真本体を IndexedDB blob として保存し、`Point.photo` は blob key の参照にする。

**新しい Point スキーマ**:

```ts
interface Point {
  id: string;
  x: number;
  y: number;
  title: string;
  note: string;
  photoId?: string;      // ← IndexedDB のキー、undefined なら写真なし
  photoName?: string;    // 元ファイル名
  photoMimeType?: string;
  geo: { lat, lng, accuracy? };
  createdAt: string;
}
// 削除: photo (data URL)
```

**IndexedDB スキーマ**:

```
Database: grid-atlas
├── ObjectStore: photos
│   ├── keyPath: id (string)
│   └── value: { blob: Blob, name: string, createdAt: string }
```

**新規モジュール `io/photos.js`**:

```ts
export async function openPhotoDB(): Promise<IDBDatabase>
export async function savePhoto(blob: Blob, name: string): Promise<string /* photoId */>
export async function getPhotoBlob(photoId: string): Promise<Blob | null>
export async function getPhotoUrl(photoId: string): Promise<string | null>  // URL.createObjectURL
export async function deletePhoto(photoId: string): Promise<void>
export async function listPhotoIds(): Promise<string[]>
```

**マイグレーション**:
- 起動時に `applyWorkspace` で `point.photo` が data URL 型なら:
  1. Blob に変換
  2. IndexedDB に保存し `photoId` 取得
  3. `point.photoId = ...`, `delete point.photo`
- ロールバック用に `data-url` の中身を消す前に export を推奨するダイアログ（初回のみ）

**Acceptance criteria**:
- [ ] 新規登録した写真は IndexedDB に保存され、localStorage 圧迫しない
- [ ] 旧データ（v2 で photo フィールドあり）は起動時に自動移行
- [ ] `renderDetails` が `photoId` から `URL.createObjectURL` で表示
- [ ] `exportWorkspace` は写真を data URL に変換して JSON に埋め込む（相互運用維持）
- [ ] `importWorkspaceFile` は data URL を IndexedDB に戻す

---

### Phase 0.5-C: TypeScript 化

**目標**: 全 `.js` を `.ts` に、`tsc --noEmit` を CI 相当に。ゼロ依存原則は維持（コンパイル出力は無し、開発時 tsc のみ）。

**手順**:
1. `package.json` に `typescript` を devDep 追加
2. `tsconfig.json` 追加（`strict: true`, `noEmit: true`, `allowImportingTsExtensions: true`, `target: ES2022`, `module: ESNext`）
3. **ブラウザは TS を直接読めない**ため、以下のどちらか:
   - **A案（推奨）**: 開発時のみ TS、production では esbuild で 1 ファイル bundle（`npm install esbuild` を許容）
   - **B案（ゼロ依存維持）**: 開発時 TS を書き、`node --experimental-strip-types` で dev-server から serve
4. モジュール単位で少しずつ `.ts` 化（分割済みなら 1 モジュール = 1 PR）
5. まず型定義だけ書く（実装は変えない、`any` を各所に散りばめて OK）
6. 順に `any` を排除

**型定義の core（新規 `src/types.ts`）**:

```ts
export interface Geo { lat: number; lng: number; accuracy?: number }
export interface Point {
  id: string; x: number; y: number;
  title: string; note: string;
  photoId?: string; photoName?: string; photoMimeType?: string;
  geo: Geo; createdAt: string;
}
export interface Link { id: string; a: string; b: string; createdAt: string }
export type SelectionEntry = { type: "point"; id: string } | { type: "link"; id: string }
export type Theme = "light" | "retro"
export type FollowScaleMode = "manual" | "range" | "target"
export interface Viewport { x: number; y: number; scale: number }
export interface Workspace { version: 2; projection: "web-mercator"; points: Point[]; links: Link[] }
```

**Acceptance criteria**:
- [ ] `npm run typecheck` が全 pass
- [ ] `any` の使用は 5 箇所以内、いずれも `// TODO: type` コメント付き
- [ ] 挙動不変（手動確認）

---

### Phase 0.5-D: 単体テストの導入

**目標**: 主要ロジックに vitest でユニットテスト。ゼロ依存原則は緩めるが、CI 相当の安心感を得る。

**優先テスト対象**（順序も優先度）:

**1. `geo/coordinates.ts` — 座標抽出（30+ ケース）**

```ts
describe("coordinatesFromText", () => {
  it("Apple Maps 北35.75°東139.85° を解釈", () => ...)
  it("Google Maps @lat,lng URL を解釈", () => ...)
  it("Google Maps !3d!4d 埋め込みを解釈", () => ...)
  it("loc:lat,lng を解釈", () => ...)
  it("南北の符号を反転", () => ...)
  it("東西の符号を反転", () => ...)
  it("東経西経の順序が逆でも解釈", () => ...)
  it("小数桁不足はマッチしない", () => ...)
  it("|lat|>90 は reject", () => ...)
  it("|lng|>180 は reject", () => ...)
  it("金額 12345.67,89012.34 は誤認しない", () => ...)
})
```

**2. `route/tsp.ts` — 巡回順（10 ケース）**

```ts
describe("optimizeVisitOrder", () => {
  it("正三角形は始点関係なくコスト同じ", () => ...)
  it("直線上の点は order 保存", () => ...)
  it("returnToStart で closed loop", () => ...)
  it("12 点で厳密、13 点で heuristic", () => ...)
  it("2-opt で二重交差が解消", () => ...)
  it("同一点は distance 0", () => ...)
})
```

**3. `geo/projection.ts` — Mercator 可逆性（5 ケース）**

```ts
describe("projectLatLng / unprojectMercator", () => {
  it.each([
    [35.681, 139.767],  // 東京
    [40.7128, -74.0060], // NYC
    [-33.8688, 151.2093], // Sydney
    [0, 0],
    [85.05, -179.99],
  ])("往復で誤差 < 0.001°", (lat, lng) => ...)
})
```

**4. `geo/distance.ts` — Haversine（5 ケース）**

```ts
it("東京→ NYC 約 10850 km ±5%", ...)
it("同一点は 0", ...)
it("日付変更線越え", ...)
it("南北 1° ≈ 111 km", ...)
```

**5. `selection.ts` — 多選択遷移（15 ケース）**

```ts
describe("normalizeSelection", () => {
  it("重複エントリは除去", ...)
  it("存在しない id は除去", ...)
})
describe("setSelection", () => {
  it("primary は先頭", ...)
  it("clear 時に target もクリア", ...)  // ← ユーザー仕様として明記
})
```

**Acceptance criteria**:
- [ ] `npm test` で 60+ テスト実行
- [ ] カバレッジは強要しないが、各 lib に最低 3 ケース
- [ ] 実装バグを 1 件以上発見（regex 系はほぼ確実に見つかるはず）

---

## 4. Phase 1 以降のロードマップ提案

Phase 0.5（上記 A〜D）を完了させた後の順序を、Claude 初期レビュー時から**再ランキング**:

### Phase 1: 個人ツールとしての完成度

1. **ワークスペース一覧**（「サウナ」「カフェ」「旅行 2026」を分離）
   - state → workspaces[currentWorkspaceId] に階層化
   - export/import は 1 ワークスペース単位 / 全体、両方
2. **タグ + フィルタ**（Point に `tags: string[]`）
   - 分析パネルにタグで絞り込む select 追加
3. **onboarding**（サンプルワークスペース load ボタン）
   - "東京・銭湯 10 選" 等、5 点のデモを 1 タップで
4. **時間軸フィルタ**（"2026 Q3 に登録した点だけ表示"）
5. **アクセシビリティ最小**（aria-live 拡充、ハイコントラストモード）

### Phase 2: 共有・公開

6. **静的な共有ビュー**（read-only URL、パスワード or Ephemeral link）
7. **緯度経度隠し共有**（プライバシー保護版、点だけ）
8. **CSV / GeoJSON エクスポート**
9. **PWA 化の完成**（オフラインキュー、install prompt）

### Phase 3: 認証・同期

10. **Passkey / メールリンク認証**
11. **Cloudflare Workers + D1 or PostgreSQL + PostGIS**
12. **写真の R2 (S3 互換) 保存**
13. **差分同期**（LWW or CRDT どちらか、要議論）

### Phase 4: 拡張

14. 短縮 URL 展開の server-side proxy
15. Photo gallery view
16. マルチワークスペース重ね合わせ

---

## 5. 「絶対にやらないでほしい」ライン（再確認）

Codex は今のところこの線を守っている。今後も明示的に:

- ❌ **外部地図タイル**（OpenStreetMap 含む）を表示すること
- ❌ **道路名・地名・施設名** を表示すること
- ❌ **ナビゲーション**（ルート案内）を実装すること
- ❌ **他人が登録した点を "オススメ" 表示**すること
- ❌ **画面に「原点」「0m」等のローカル座標系** を出すこと

これらは "GRID ATLAS の core value" を破壊する。**Phase 1 以降で機能追加のたびに、この 5 つに抵触しないか自問**してほしい。

---

## 6. 議論したい未決事項（Codex → Claude ← ユーザーの三者で）

### a. TSP の `returnToStart` の spec 上の位置付け

現状 UI に checkbox はあるが、仕様書には言及がない。「巡回」=「戻る」なのか、「片道最短」なのか、UI 説明も含めて再確認したい。

### b. 追従モード中の "追従一時停止" の見せ方

現状 `pauseLocationFollowForManualView` で自動オフになるが、ユーザは「追従が切れた」ことを認識できるか。ボタンの visual state（現在 `aria-pressed` を切替）だけで十分か、それとも通知 toast が要るか。

### c. Target 到着（25m）の後の挙動

到着したら target を clear するか、"到着済み" 状態のまま残すか。Codex の現実装を要確認。

### d. Theme 切替の意味付け

Retro が default になったのは大成功だが、Light theme も残す意味は？
- 選択肢: (i) Light も default 候補として磨く / (ii) 実質 Retro 一本にして Light は削除 / (iii) 印刷向け "Paper" mode を追加してテーマは 3 種類に

### e. iOS PWA 対応の妥協点

- Share Target は iOS では動作しない（既知）
- Clipboard 読取は iOS でも動くが要ユーザ操作
- Vibration API は iOS 未対応
- **iOS ユーザ向けに「クリップ読取のみで完結する」フローを first-class に磨く**方針でいいか

---

## 7. Codex への次のアクションアイテム（明日から）

Codex は本提案を読んだ後、以下の順で進めることを推奨:

| 順 | タスク | 期間目安 | 差分規模 |
|---|---|---|---|
| 1 | 分割案（§3-A）へのレビュー・修正提案 | 1 セッション | 議論のみ |
| 2 | main.js 分割 commit 1（constants / theme / state）| 1 セッション | +3 file, -100 line from main |
| 3 | main.js 分割 commit 2（geo / selection）| 1 セッション | +4 file, -200 line |
| 4 | main.js 分割 commit 3（canvas 系）| 2 セッション | +6 file, -800 line |
| 5 | main.js 分割 commit 4（route / location / share）| 2 セッション | +8 file, -700 line |
| 6 | main.js 分割 commit 5（ui 系）| 2 セッション | +6 file, -700 line |
| 7 | main.js 分割 commit 6（io / persist）| 1 セッション | +5 file, -400 line |
| 8 | Phase 0.5-B: 写真 IndexedDB 移行 | 2 セッション | +photo.js, migration |
| 9 | Phase 0.5-C: TypeScript 化（bundle 方針決定 → 段階移行）| 3-5 セッション | 全 .js → .ts |
| 10 | Phase 0.5-D: テスト導入 | 2-3 セッション | +test/ 60+ ケース |

**分割中は Phase 1 の機能追加を凍結**（新しい沼を掘らない）。

---

## 8. Claude への question（Codex から）

もし Codex がこの提案に不明点があれば、以下の順で回答用意しておく:

- 分割の依存関係グラフの詳細
- IndexedDB マイグレーションの edge case（複数タブ、同時 write 等）
- TypeScript 化の bundle 方針の trade-off 比較
- テスト framework 選定（vitest 前提だが jest / node:test も比較可）
- 段階的な PR 分割戦略のレビュー

---

## 9. 総括

**Codex は本気で良い仕事をしている**。1 か月で 47% コード量を増やしつつ、コンセプトを1 mm もブレさせず、新機能（追従・ターゲット・多選択・ピンチズーム・レトロテーマ）を全て "抽象格子" の哲学に沿って統合できている。これは AI 開発者としての設計判断力の高さの証明。

**同時に、今の 2968 行の main.js は Codex 自身の次の一歩を重くしている**。Claude の初期レビューで指摘した P0 課題を放置したまま機能を積み続けると、いずれ「これ以上機能を追加するとテストなしでは怖くて触れない」という壁にぶつかる。**今が整地の tipping point**。

Phase 0.5 の 4 タスクを終えた Codex は、Phase 1 の機能追加を**現在の 2 倍の速度で、かつ 1/3 のバグ率で**進められるはず。これは投資に見合う。

Claude としては引き続き、設計議論・レビュー・アーキテクチャ判断のサポートを続ける。**分割案のレビューから始めよう**。

---

**Signed:**
Claude（設計・レビュー担当）
2026-07-10

**参考:**
- Claude 初期レビュー（2026-06 頃、対話ベース）
- GRID ATLAS ROADMAP.md（§10 次フェーズ、TypeScript化 が #1）
- GRID ATLAS docs/development-spec.md（受け入れ条件は現状すべて満たしている）
