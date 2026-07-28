# GRID ATLAS interchange format v1 RC1

status: release candidate

SPDX-License-Identifier: CC-BY-4.0

## 目的

GRID ATLASの地点リストを、特定アプリ、アカウント、クラウドへ依存せず運ぶための公開交換形式です。リストが本体であり、ファイルは共有・バックアップ用の封筒です。

## 適合レベル

実装は対応範囲を次のように表明できます。

- Core Read / Core Write: place-list JSONを読み書きする
- Package Read / Package Write: .gridatlas ZIPを読み書きする
- Media Read / Media Write: パッケージ内画像を読み書きする

「GRID ATLAS v1対応」だけでなく、例として「GRID ATLAS v1 Core Read/Write」のように表明します。

## Core document

共通意味モデルは document.json です。URL共有も同じJSONを運びます。

必須フィールドは次のとおりです。

- document: type, schemaVersion, id, name, places
- place: id, name, position.latitude, position.longitude

日時、説明、attribution、note、media、extensionsは任意です。座標系はWGS 84、緯度経度の単位は十進度です。GRID ATLAS文書では順序事故を避けるため、配列ではなくlatitude / longitudeという名前で表現します。

JSONにはコメント構文を導入しません。人が書くコメントはplace.noteなどのデータとして保持します。

正式な制約は schema/gridatlas-place-list.schema.json を参照してください。

## .gridatlas package

.gridatlasは常にZIPコンテナです。

~~~text
manifest.json
 document.json
 assets/
   ... optional image files
~~~

- MIME type候補: application/vnd.gridatlas+zip
- manifest format: gridatlas-package
- formatVersion: 1
- document media type: application/vnd.gridatlas.place-list+json
- 画像: JPEG、PNG、WebP

manifestは各リソースのパス、MIME type、バイト数、SHA-256を持ちます。読込側はパス、展開量、ハッシュ、参照整合性を検証してからデータを採用します。

## URL profile

サーバーを必要としない標準表現は次です。

~~~text
#gridatlas=v1.<base64url(UTF-8 JSON)>
~~~

フラグメントを使うことで、通常のHTTPリクエストに地点データを含めません。URL profileはCore documentだけを運び、画像実体を含めません。生成側は完成URLが8,192 byteを超える場合、.gridatlasファイル共有へ案内することを推奨します。

## Identityと再インポート

- document.idは共有元で安定したIDです。
- アプリ内部の保存IDとは分離します。
- 同じdocument.idかつ同じ正規化内容の再読込は重複追加しません。
- 同じdocument.idで内容が異なる場合、既存リストを無言で上書きしません。別の更新版として読み込みます。
- 内容識別には、オブジェクトキーを辞書順に並べたJSONのSHA-256を使います。places配列の順序は意味を持ちます。

## Extensions

拡張はextensionsオブジェクト内だけに置き、キーはcom.example.featureのような逆ドメイン形式にします。

- 未知の任意拡張: 読込側は無視できますが、再書出し時まで保持します。
- requiredExtensionsにある未知の拡張: 読込を拒否します。
- コアフィールドの意味を拡張で変更してはいけません。

## GeoJSONとの対応

placeはGeoJSON Pointへ変換できます。GRID ATLASのlatitude / longitudeは、GeoJSONではcoordinates: [longitude, latitude]へ変換します。v1の本体形式をGeoJSONそのものにはせず、交換アダプターとして扱います。

## セキュリティとプライバシー

- ZIP内の絶対パス、\、.、..セグメントを拒否する
- ファイル数、圧縮前後サイズ、単一ファイルサイズに上限を設ける
- SHA-256とmanifest参照を検証する
- v1では外部画像URLや実行可能コンテンツを扱わない
- 画像書出し時は位置情報を含むEXIFを残さない
- 共有はユーザーの明示操作でのみ実行する

## v1で扱わないもの

暗号化、電子署名、複数リスト同梱、共同編集、クラウド同期、外部画像URLはv1の範囲外です。

## RC1合格条件

- 最小documentを読み込める
- 画像付き.gridatlasを読み書きできる
- Webで書出し→再読込して意味と画像が保たれる
- 未知の任意拡張を保持する
- 未知の必須拡張と壊れたハッシュを拒否する
- 同じdocumentを2回読んでもリストが増えない

## ライセンス

- この仕様本文とCONFORMANCE.md: CC BY 4.0
- schema/とexamples/: CC0 1.0
- GRID ATLAS Web参照実装: MIT License

適用範囲と表示方法は[LICENSE.md](LICENSE.md)を参照してください。
