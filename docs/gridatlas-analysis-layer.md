# GRID ATLAS 考察レイヤー（Web実験）

地点リストの本体と、ユーザーが地点同士の関係を考察するために引く線を分離して扱うためのWeb実験仕様です。

## 基本方針

- 地点、メモ、画像は既存の`.gridatlas` place-list documentが本体です。
- 線と図形は地点リストとは別のアプリ内考察レイヤーとして保存します。workspaceでは`placeLists[]`と同じ階層の`analysisLayer`に格納し、既存のv1 place-list documentの構造は変更しません。
- 地点を選択して接続した時点で線を保存します。保存ボタンは設けません。不要な線はグリッド上で選択して削除します。
- 共有時は輸送上、地点リストdocumentの任意拡張として線レイヤーを同梱できますが、読み込み後は地点リストと線レイヤーを別データとしてアプリへ登録します。
- 線を理解しない実装は、地点だけを読み込んでもかまいません。
- 地点リストの表示切替は地点にだけ作用し、考察レイヤーの表示は維持します。地点の移動・改名・削除・コピーは、線と図形が保持する座標・名称スナップショットを変更しません。`placeRef`が解決できない頂点も描画・距離・面積・分析の対象です。
- 共有時は、選択された地点・線・図形だけをdocument拡張へ含めます。リスト単位の共有は地点だけを含み、線や図形は含めません。

## document拡張

拡張キーは`io.gridatlas.analysis`です。

```json
{
  "extensions": {
    "io.gridatlas.analysis": {
      "version": 1,
      "lines": [
        {
          "id": "line-1",
          "a": { "lat": 35, "lng": 135, "key": "geo:35:135", "name": "A", "placeRef": "place-a" },
          "b": { "lat": 35.1, "lng": 135.1, "key": "geo:35.1:135.1", "name": "B", "placeRef": null },
          "strokeId": "stroke-1"
        }
      ],
      "figures": [
        {
          "id": "figure-1",
          "vertices": [
            { "lat": 35, "lng": 135, "key": "geo:35:135", "name": "A", "placeRef": null },
            { "lat": 35.1, "lng": 135, "key": "geo:35.1:135", "name": "B", "placeRef": null },
            { "lat": 35, "lng": 135.1, "key": "geo:35:135.1", "name": "C", "placeRef": null }
          ],
          "closed": true
        }
      ]
    }
  }
}
```

線の`a`と`b`、図形の`vertices[]`はcanonical vertex snapshotです。座標から導出した`key`は重複線の判定に使いますが、オブジェクトのidentityではありません。`placeRef`は任意の参照情報で、座標が同じ地点のIDをidentityとして扱いません。

`strokeId`は線の任意属性です。図形の辺は`vertices[]`から導出し、`strokeId`で図形と結び付けません。閉じた図形は`closed: true`、開いた図形は`closed: false`で表します。

旧`io.gridatlas.lines` version 1 は、既存プリセットを読めるよう**読み込み時だけ**互換復元します。各線の地点IDを同じdocumentの`places`から座標スナップショットへ変換して考察レイヤーに表示します。書き出しの正規形式は引き続き`io.gridatlas.analysis`であり、旧workspaceの自動移行は行いません。

この拡張は、既存のGRID ATLAS v1 Core必須項目を変更しません。対応していない実装では地点だけが表示されます。
