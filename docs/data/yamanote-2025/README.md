# 山手線 駅座標（国土数値情報 N02-25）

`yamanote-line-stations-2025.gridatlas` は、JR東日本の山手線30駅を、国土交通省「国土数値情報 鉄道」2025年度版（N02-25）のStationレイヤーから作成したGRID ATLAS地点リストです。

## 出典

- データ: [国土交通省 国土数値情報 鉄道データ 2025年度版](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N02-2025.html)
- 配布ファイル: `N02-25_GML.zip` / `UTF-8/N02-25_Station.geojson`
- 基準日: 2025年12月31日
- 座標系: JGD2011（緯度・経度）。GRID ATLASには十進度で格納。
- 利用条件: CC BY 4.0

## 代表点の作り方

国土数値情報の駅レイヤーは駅を線形状で表しているため、各駅の採用線形状について線分の中点を線長で重み付けして平均し、代表点を求めました。座標は6桁小数へ丸めています。

山手線名義の線形状がない駅は、同じ駅グループのJR東日本の線形状を採用しています。

- 西日暮里、日暮里、鶯谷、上野、御徒町、秋葉原、神田: 東北線（秋葉原・神田は総武線・中央線も候補）
- 東京、有楽町、新橋、浜松町、田町、高輪ゲートウェイ: 東海道線

再生成する場合は、公式ZIPを展開した `N02-25_Station.geojson` を入力にして次を実行します。

```powershell
npm run build:yamanote -- "path\\to\\N02-25_Station.geojson" "docs\\data\\yamanote-2025\\yamanote-line-stations-2025.gridatlas"
```

位置引数は、入力GeoJSON、出力`.gridatlas`の順です。省略時はプロジェクト内の一時展開先と既定出力先を使います。
