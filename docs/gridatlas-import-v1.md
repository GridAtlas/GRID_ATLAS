# .gridatlas Web導入仕様 v1 RC1

status: release candidate implementation

共通形式の正本は [gridatlas-v1/README.md](./gridatlas-v1/README.md) と同ディレクトリのJSON Schemaです。

## Webの読込導線

1. URLを開いた起動時に自動インポート
2. ブラウザ画面へ.gridatlasをドラッグ＆ドロップ
3. PWAのfile_handlersとlaunchQueueによるOSファイル起動

File Handling API非対応環境ではURLまたはドラッグ＆ドロップを利用します。

## URL

~~~text
#gridatlas=v1.<base64url(UTF-8 JSON)>
~~~

URLにはdocument.jsonと同じCore documentを入れ、画像実体は含めません。読込後はgridatlasパラメータを履歴から除去します。

## Web保存

画像本体はIndexedDBへBlobとして保存し、ワークスペースにはSHA-256由来のasset IDだけを保持します。既存のData URL写真は起動時に移行し、IndexedDBが利用できない場合のみ従来形式をフォールバックとして残します。

## 再インポート

同一document ID・同一digestは重複追加しません。同一IDで内容が異なる場合は「更新版」の別リストとして追加し、既存リストを上書きしません。

## 書き出し

バックアップ保存は対象リストを.gridatlasパッケージとして書き出します。旧grid-atlas-point-list JSONは正式v1の書出し形式ではありません。
