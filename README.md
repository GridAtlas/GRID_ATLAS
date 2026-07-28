# GRID ATLAS

建物名、地名、地形、道路を表示しない、格子と登録地点だけの地図アプリです。

## 現在のブートストラップ内容

- 格子だけのキャンバス表示
- 緯度経度ベースの地点登録、写真、コメント保存
- 地点同士の線引き
- 地球上の2点間直線距離の計測
- 複数地点の巡回順提案
- 共有URL/クリップボードからの地点登録補助
- 選択地点を外部地図アプリで開く操作
- PWA共有ターゲットと.gridatlasファイル関連付け
- PC向けの距離分析パネル
- スマホ向けの地点登録フォーム
- リスト情報はLocalStorage、画像BlobはIndexedDBへローカル保存
- .gridatlasのURL・ドラッグ＆ドロップ・ファイル関連付けインポート
- 画像を含む.gridatlasエクスポートと重複インポート防止
- 依存パッケージなしのローカル開発サーバー

## 起動

```powershell
npm run dev
```

既定では `http://127.0.0.1:5177/` で起動します。

## 検証

```powershell
npm run check
```

## 仕様書

[docs/development-spec.md](docs/development-spec.md)

[.gridatlas v1 RC1](docs/gridatlas-v1/README.md)

## ライセンス

Web参照実装は[MIT License](LICENSE)です。.gridatlas v1仕様本文はCC BY 4.0、SchemaとサンプルはCC0 1.0です。詳細は[仕様ライセンス](docs/gridatlas-v1/LICENSE.md)を参照してください。

## 注意

この初期版は地球上の緯度経度に対応したプロトタイプとしてブラウザ内に保存します。Googleマップ等の短縮URLだけでは、ブラウザ単体で展開できない場合があります。スマホとPC間の自動同期、認証、クラウド写真ストレージは、次フェーズでAPIとデータベースを追加して実装します。

