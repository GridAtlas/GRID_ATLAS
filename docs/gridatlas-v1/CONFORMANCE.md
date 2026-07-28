# GRID ATLAS v1 RC1 conformance

SPDX-License-Identifier: CC-BY-4.0

## Valid fixtures

- examples/minimal.document.json: Core必須項目のみ
- examples/media-and-extensions.document.json: 任意メタデータ、画像参照、任意拡張

## Required behavior

1. JSON Schema 2020-12でCore documentとmanifestを検証する。
2. ZIP展開前後のサイズ上限と安全な相対パスを検証する。
3. documentとresourceのSHA-256を検証する。
4. 全media.resourceIdがmanifest.resourcesに存在することを検証する。
5. 未知の任意拡張を保持し、未知のrequiredExtensionsを拒否する。
6. export -> import -> exportでCoreの意味が保たれることを確認する。
7. 同一document ID・同一digestの再読込を重複追加しない。
