[CmdletBinding()]
param(
    [string]$DataDir = (Join-Path (Get-Location) 'docs\data\candidate-sites-200-v2')
)

$ErrorActionPreference = 'Stop'
$rawPath = Join-Path $DataDir 'raw-combined.csv'
$outputPath = Join-Path $DataDir 'candidate-sites-200-v2.csv'
$methodPath = Join-Path $DataDir 'candidate-sites-200-v2-method.md'
$officialSource = 'https://kunishitei.bunka.go.jp/bsys/index'
$inputAnchorSource = 'provided:candidate-sites-200.csv'

function Normalize-Text([string]$Value) {
    if ($null -eq $Value) { return '' }
    return (($Value -replace '[\s　]+', '') -replace '[・･（）()「」『』、,./／・]', '').ToLowerInvariant()
}

function Get-Region([string]$Prefecture) {
    switch -Regex ($Prefecture) {
        '北海道' { return '北海道' }
        '青森|岩手|宮城|秋田|山形|福島' { return '東北' }
        '茨城|栃木|群馬|埼玉|千葉|東京|神奈川' { return '関東' }
        '新潟|富山|石川|福井|山梨|長野|岐阜' { return '北陸甲信' }
        '静岡|愛知|三重' { return '東海' }
        '滋賀|京都|大阪|兵庫|奈良|和歌山' { return '近畿' }
        '鳥取|島根|岡山|広島|山口' { return '中国' }
        '徳島|香川|愛媛|高知' { return '四国' }
        '福岡|佐賀|長崎|熊本|大分|宮崎|鹿児島' { return '九州' }
        '沖縄' { return '沖縄' }
        default { return '不明' }
    }
}

function Get-Category([string]$SourceQuery) {
    switch ($SourceQuery) {
        '102-shrine' { return '神社建築' }
        '102-temple' { return '寺院建築' }
        '102-castle' { return '城郭建築' }
        '401-special-historic' { return '特別史跡' }
        '401-special-natural' { return '特別天然記念物' }
        '901-world-heritage' { return '世界遺産' }
        default { return '文化財' }
    }
}

function Get-Rank([string]$Value) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [Text.Encoding]::UTF8.GetBytes($Value)
        return [BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-', '')
    } finally {
        $sha.Dispose()
    }
}

function Get-DistanceKm([double]$Lat1, [double]$Lon1, [double]$Lat2, [double]$Lon2) {
    $rad = [Math]::PI / 180
    $phi1 = $Lat1 * $rad
    $phi2 = $Lat2 * $rad
    $dPhi = ($Lat2 - $Lat1) * $rad
    $dLambda = ($Lon2 - $Lon1) * $rad
    $a = [Math]::Sin($dPhi / 2) * [Math]::Sin($dPhi / 2) + [Math]::Cos($phi1) * [Math]::Cos($phi2) * [Math]::Sin($dLambda / 2) * [Math]::Sin($dLambda / 2)
    return 6371.0088 * 2 * [Math]::Atan2([Math]::Sqrt($a), [Math]::Sqrt(1 - $a))
}

function To-Double([string]$Value) {
    return [double]::Parse($Value, [Globalization.CultureInfo]::InvariantCulture)
}

if (-not (Test-Path -LiteralPath $rawPath)) { throw "先に取得処理を実行してください: $rawPath" }
$rawRows = @(Import-Csv -LiteralPath $rawPath)

# 5地点は記事の検証対象として事前登録し、背景母集団の選定からは分離する。
$anchors = @(
    [pscustomobject]@{ name='伊勢神宮 内宮'; prefecture='三重県'; latitude=34.455; longitude=136.7252; source_record_id='anchor-001' },
    [pscustomobject]@{ name='熊野本宮大社'; prefecture='和歌山県'; latitude=33.8406; longitude=135.7734; source_record_id='anchor-002' },
    [pscustomobject]@{ name='伊弉諾神宮'; prefecture='兵庫県'; latitude=34.4601; longitude=134.8525; source_record_id='anchor-003' },
    [pscustomobject]@{ name='元伊勢皇大神社'; prefecture='京都府'; latitude=35.4304; longitude=135.1543; source_record_id='anchor-004' },
    [pscustomobject]@{ name='伊吹山'; prefecture='滋賀県'; latitude=35.4178; longitude=136.4064; source_record_id='anchor-005' }
)

$grouped = $rawRows | Group-Object -Property { "$($_.台帳ID)|$($_.'管理対象ID')" }
$pool = @()
foreach ($group in $grouped) {
    $rows = @($group.Group)
    $preferred = $rows | Sort-Object @{ Expression = { if ([string]$_.棟名 -match '本殿|本堂|正殿|拝殿|天守|主殿') { 0 } else { 1 } } }, @{ Expression = { [string]$_.名称 } } | Select-Object -First 1
    $lat = To-Double ([string]$preferred.'緯度')
    $lon = To-Double ([string]$preferred.'経度')
    $sourceQuery = [string]$preferred.source_query
    $name = [string]$preferred.名称
    $pref = [string]$preferred.都道府県
    if ([string]::IsNullOrWhiteSpace($name) -or [string]::IsNullOrWhiteSpace($pref)) { continue }
    $pool += [pscustomobject]@{
        name = $name
        category = Get-Category $sourceQuery
        designation = if ([string]::IsNullOrWhiteSpace([string]$preferred.種別1)) { [string]$preferred.文化財種類 } else { [string]$preferred.種別1 }
        prefecture = $pref
        region = Get-Region $pref
        latitude = $lat
        longitude = $lon
        source_type = '文化庁・国指定等文化財DB'
        source_url = $officialSource
        source_record_id = "$($preferred.台帳ID)-$($preferred.'管理対象ID')"
        coordinate_source = '文化庁DBの緯度・経度欄'
        selection_role = 'official-background'
        selection_rule = 'official-pool; category+region quota; deterministic SHA-256 rank'
    }
}

# 同一名称・都道府県の重複を整理し、アンカーから2km以内の背景候補は二重計上を避ける。
$dedup = @{}
foreach ($candidate in $pool) {
    $key = "$(Normalize-Text $candidate.name)|$($candidate.prefecture)"
    if (-not $dedup.ContainsKey($key)) { $dedup[$key] = $candidate }
}
$background = @()
foreach ($candidate in $dedup.Values) {
    $nearAnchor = $false
    foreach ($anchor in $anchors) {
        if ((Get-DistanceKm $candidate.latitude $candidate.longitude $anchor.latitude $anchor.longitude) -lt 2) { $nearAnchor = $true; break }
    }
    if (-not $nearAnchor) {
        $candidate | Add-Member -NotePropertyName rank -NotePropertyValue (Get-Rank "$($candidate.category)|$($candidate.source_record_id)|$($candidate.latitude)|$($candidate.longitude)") -Force
        $background += $candidate
    }
}

$regionQuota = [ordered]@{
    '北海道' = 12; '東北' = 20; '関東' = 30; '北陸甲信' = 20; '東海' = 25;
    '近畿' = 30; '中国' = 20; '四国' = 15; '九州' = 23; '沖縄' = 5
}
$categoryQuota = [ordered]@{
    '世界遺産' = 15; '城郭建築' = 20; '特別史跡' = 35; '特別天然記念物' = 40;
    '神社建築' = 40; '寺院建築' = 45
}

$targetRows = @()
foreach ($anchor in $anchors) {
    $targetRows += [pscustomobject]@{
        name = $anchor.name; category = '近畿五芒星・固定アンカー'; designation = '記事の事前登録地点';
        prefecture = $anchor.prefecture; region = Get-Region $anchor.prefecture; latitude = $anchor.latitude; longitude = $anchor.longitude;
        source_type = '提供元アンカー'; source_url = $inputAnchorSource; source_record_id = $anchor.source_record_id;
        coordinate_source = '提供されたcandidate-sites-200.csv'; selection_role = 'target-anchor'; selection_rule = 'article target; fixed before background sampling'; rank = ''
    }
}

$regionUsed = @{}
foreach ($region in $regionQuota.Keys) { $regionUsed[$region] = @($targetRows | Where-Object region -eq $region).Count }
$regionCapacity = @{}
foreach ($region in $regionQuota.Keys) { $regionCapacity[$region] = [Math]::Max(0, $regionQuota[$region] - $regionUsed[$region]) }
$categoryUsed = @{}
foreach ($category in $categoryQuota.Keys) { $categoryUsed[$category] = 0 }
$selectedBackground = @()
$blockedIds = @{}
$categoryOrder = @('世界遺産','城郭建築','特別史跡','特別天然記念物','神社建築','寺院建築')

function Add-BlockedNeighbors([object]$Selected, [object[]]$AllCandidates, [hashtable]$BlockedState) {
    foreach ($candidate in $AllCandidates) {
        if ((Get-DistanceKm $Selected.latitude $Selected.longitude $candidate.latitude $candidate.longitude) -lt 2) {
            $BlockedState[$candidate.source_record_id] = $true
        }
    }
}

function Select-NextCandidate([object[]]$Candidates, [hashtable]$RegionUsedState, [hashtable]$RegionCapacityState, [hashtable]$BlockedState) {
    $eligible = @($Candidates | Where-Object {
        $RegionCapacityState.ContainsKey($_.region) -and
        $RegionCapacityState[$_.region] -gt 0 -and
        -not $BlockedState.ContainsKey($_.source_record_id)
    })
    if ($eligible.Count -eq 0) { return $null }
    return $eligible | Sort-Object @{ Expression = { [double]$RegionUsedState[$_.region] / [double]$RegionCapacityState[$_.region] } }, @{ Expression = { $_.rank } } | Select-Object -First 1
}

foreach ($category in $categoryOrder) {
    $categoryCandidates = @($background | Where-Object category -eq $category | Sort-Object rank)
    while ($categoryUsed[$category] -lt $categoryQuota[$category]) {
        $next = Select-NextCandidate $categoryCandidates $regionUsed $regionCapacity $blockedIds
        if ($null -eq $next) { break }
        $selectedBackground += $next
        $categoryCandidates = @($categoryCandidates | Where-Object source_record_id -ne $next.source_record_id)
        Add-BlockedNeighbors $next $background $blockedIds
        $regionUsed[$next.region]++
        $regionCapacity[$next.region]--
        $categoryUsed[$category]++
    }
}

# 2次補充: 希少カテゴリや地域の不足がある場合、残りの公式候補で埋める。
$selectedIds = @{}
foreach ($row in $selectedBackground) { $selectedIds[$row.source_record_id] = $true }
$remaining = @($background | Where-Object { -not $selectedIds.ContainsKey($_.source_record_id) } | Sort-Object rank)
while ($selectedBackground.Count -lt 195) {
    $next = Select-NextCandidate $remaining $regionUsed $regionCapacity $blockedIds
    if ($null -eq $next) {
        # 県をまたぐ指定や沖縄のように、枠の想定より候補が少ない地域があるため、
        # 最後の不足分だけは地域枠を超えずに済む候補から補充する。
        $next = $remaining | Where-Object { -not $blockedIds.ContainsKey($_.source_record_id) } | Select-Object -First 1
    }
    if ($null -eq $next) { break }
    $selectedBackground += $next
    $remaining = @($remaining | Where-Object source_record_id -ne $next.source_record_id)
    Add-BlockedNeighbors $next $background $blockedIds
    if ($regionUsed.ContainsKey($next.region)) {
        $regionUsed[$next.region]++
        $regionCapacity[$next.region]--
    }
}

if ($selectedBackground.Count -ne 195) {
    throw "公式背景地点を195件まで選べませんでした。選択数: $($selectedBackground.Count)"
}

$finalRows = @($targetRows + $selectedBackground)
$numbered = @()
$index = 1
foreach ($row in $finalRows) {
    $numbered += [pscustomobject]@{
        no = $index
        name = $row.name
        category = $row.category
        designation = $row.designation
        prefecture = $row.prefecture
        region = $row.region
        latitude = ([double]$row.latitude).ToString('0.000000', [Globalization.CultureInfo]::InvariantCulture)
        longitude = ([double]$row.longitude).ToString('0.000000', [Globalization.CultureInfo]::InvariantCulture)
        source_type = $row.source_type
        source_url = $row.source_url
        source_record_id = $row.source_record_id
        coordinate_source = $row.coordinate_source
        selection_role = $row.selection_role
        selection_rule = $row.selection_rule
    }
    $index++
}
$numbered | Export-Csv -LiteralPath $outputPath -NoTypeInformation -Encoding utf8

$regionSummary = $numbered | Group-Object region | Sort-Object Name | ForEach-Object { "| $($_.Name) | $($_.Count) |" }
$categorySummary = $numbered | Group-Object category | Sort-Object Name | ForEach-Object { "| $($_.Name) | $($_.Count) |" }
$rawCount = $rawRows.Count
$poolCount = $pool.Count
$dedupCount = $dedup.Count
$backgroundCount = $background.Count
$created = Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz'
$method = @"
# candidate-sites-200-v2 選定メモ

作成日時: $created  
取得元: [文化庁 国指定文化財等データベース]($officialSource)  
取得レコード数: $rawCount（座標付き・建物レコードを含む）  
地点単位への整理後: $dedupCount  
アンカーから2km以内を除いた背景候補: $backgroundCount  

## 目的

元の200地点リストにあった「出典のない手選び」「同一施設の近接重複」「東海・近畿・関東への偏り」を抑え、文化庁DBで追跡できる背景母集団から再現可能に抽出する。

## 200地点の構成

- 5地点: 近畿五芒星の記事で事前登録した固定アンカー。比較可能性のため元データの座標を保持し、`selection_role=target-anchor` とした。
- 195地点: 文化庁DBの公式背景候補。`source_record_id` は同DBの台帳ID・管理対象IDの組み合わせ。
- 文化庁DBの建物レコードは、台帳ID・管理対象IDでまとめ、代表座標を1地点として採用した。
- 同一名称・同一都道府県の重複を整理し、アンカーから2km未満の背景候補は二重計上を避けるため除外した。

## 抽出ルール

- 地域枠の目標: 北海道12、東北20、関東30、北陸甲信20、東海25、近畿30、中国20、四国15、九州23、沖縄5。候補不足や空間制約がある地域は、最後に他地域へ再配分した。
- 背景カテゴリ枠の目標上限: 世界遺産15、城郭建築20、特別史跡35、特別天然記念物40、神社建築40、寺院建築45。公式候補の地域分布と空間制約により、到達しない枠の分は他カテゴリで補充した。
- 各枠内ではSHA-256による固定順位を使い、実行時刻や乱数に依存しない。
- 最終的に採用する地点同士は、2km未満にならないよう近傍候補を除外した。したがって、同一境内の別建物が大量に入ることを避けている。
- これは「日本の有名スポット200選」ではなく、「国の指定等を持つ地点を母集団にした、比較用の背景サンプル」である。

## 列の読み方

`source_url` は背景地点の公式DB入口、`source_record_id` は追跡用ID、`coordinate_source` は座標の由来、`selection_role` は記事対象か背景候補かを示す。アンカー5地点は、文化庁DBで裏取りできた地点としてではなく、記事上の仮説を検証するための固定入力として扱う。

## 地域別集計

| 地域 | 件数 |
|---|---:|
$($regionSummary -join "`n")

## カテゴリ別集計

| カテゴリ | 件数 |
|---|---:|
$($categorySummary -join "`n")

## 注意

文化庁DBの検索結果は将来更新され得るため、再取得時には取得日と件数が変わる可能性がある。記事本文では「統計的に日本全体を完全代表する200地点」とは言わず、「公式データから構成した比較用の200地点」と表現する。
"@
[IO.File]::WriteAllText($methodPath, $method, (New-Object Text.UTF8Encoding($false)))

Write-Host "作成: $outputPath"
Write-Host "作成: $methodPath"
Write-Host "総数: $($numbered.Count) / 背景: $($selectedBackground.Count) / アンカー: $($targetRows.Count)"
Write-Host "地域別:"
$numbered | Group-Object region | Sort-Object Name | Format-Table Name, Count
Write-Host "カテゴリ別:"
$numbered | Group-Object category | Sort-Object Name | Format-Table Name, Count
