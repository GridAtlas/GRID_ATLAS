# 公開紹介用プリセット

このフォルダは、紹介記事やデモページから読み込ませる `.gridatlas` ファイル専用です。

## URL

ファイル名を `kinki-pentagram.gridatlas` とした場合、公開後の紹介リンクは次の形式です。

```text
https://gridatlas.github.io/GRID_ATLAS/?preset=kinki-pentagram
```

アプリ起動時に同一オリジンの `presets/kinki-pentagram.gridatlas` を取得し、インポートリストへ追加します。表示はプリセット対象と登録先のリストに絞られ、他のリストは自動的にオフになります。
`kinki-pentagram.gridatlas` には、5つの固定アンカーを結ぶ考察線も任意レイヤーとして含めています。

## 現在のプリセット

- `kinki-pentagram`：近畿五芒星の5地点と五角形の線
- `kinki-pentagram-sites-v3-200`：v3の200地点と五芒星の線
- `kinki-shrine-temple-sites-v5-nested-500`：v5の包含型500地点
- `kinki-pentagram-kurazoji`：庫蔵寺鎮守堂版（200地点版の総合1位）
- `kinki-pentagram-rank1-of-500`：500地点版の総合1位
- `kinki-pentagon-best-of-500`：500地点からの五角形・最高候補（現行分析基準）
- `kinki-pentagram-rank3-chubu`：中部の五角形（同3位）
- `kinki-pentagram-rank5-nameless`：名もなき五角形（同5位）
- `kinki-pentagram-overlay`：伊勢内宮＋庫蔵寺の6点・星の重ね合わせ

## 公開範囲

- このフォルダに置いて commit・push したファイルは公開されます。
- 地点名、座標、メモ、画像など、`.gridatlas` に含まれる情報は紹介リンクの利用者に渡ります。
- 個人情報、非公開地点、作業用CSV、分析資料は置かないでください。
- ファイル名は英数字、`-`、`_`、`.` のみを使い、紹介URLの `preset` 値には拡張子を付けません。
