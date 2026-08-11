# 公開紹介用プリセット

このフォルダは、紹介記事やデモページから読み込ませる `.gridatlas` ファイル専用です。

## URL

ファイル名を `kinki-pentagram.gridatlas` とした場合、公開後の紹介リンクは次の形式です。

```text
https://gridatlas.github.io/GRID_ATLAS/?preset=kinki-pentagram
```

アプリ起動時に同一オリジンの `presets/kinki-pentagram.gridatlas` を取得し、インポートリストへ追加して地点全体を自動表示します。

## 公開範囲

- このフォルダに置いて commit・push したファイルは公開されます。
- 地点名、座標、メモ、画像など、`.gridatlas` に含まれる情報は紹介リンクの利用者に渡ります。
- 個人情報、非公開地点、作業用CSV、分析資料は置かないでください。
- ファイル名は英数字、`-`、`_`、`.` のみを使い、紹介URLの `preset` 値には拡張子を付けません。
