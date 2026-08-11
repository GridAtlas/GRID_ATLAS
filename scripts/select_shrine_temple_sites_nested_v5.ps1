[CmdletBinding()]
param(
    [string]$DataDir = (Join-Path (Get-Location) 'docs\data\candidate-sites-500-v5-nested')
)

$ErrorActionPreference = 'Stop'
$basePath = Join-Path (Get-Location) 'docs\data\candidate-sites-200-v3\candidate-sites-200-shrines-temples-v3.csv'
$sourceDir = Join-Path (Get-Location) 'docs\data\candidate-sites-200-v2\raw'
$outputPath = Join-Path $DataDir 'candidate-sites-500-shrines-temples-v5-nested.csv'
$methodPath = Join-Path $DataDir 'candidate-sites-500-shrines-temples-v5-nested-method.md'
$officialSource = 'https://kunishitei.bunka.go.jp/bsys/index'
$sharedIdPrefix = 'kinki-shrine-temple-sites-v5-nested'
$backgroundAdditionTarget = 300
$minDistanceKm = 2.0
$gridSize = 0.02
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

function Normalize-Text([string]$Value) {
    if ($null -eq $Value) { return '' }
    return (($Value -replace '[\s　]+', '') -replace '[・･（）()「」『』、,./／]', '').ToLowerInvariant()
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

function Get-Rank([string]$Value) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Value))).Replace('-', '') }
    finally { $sha.Dispose() }
}

function Get-DistanceKm([double]$Lat1, [double]$Lon1, [double]$Lat2, [double]$Lon2) {
    $rad = [Math]::PI / 180
    $phi1 = $Lat1 * $rad; $phi2 = $Lat2 * $rad
    $dPhi = ($Lat2 - $Lat1) * $rad; $dLambda = ($Lon2 - $Lon1) * $rad
    $a = [Math]::Sin($dPhi / 2) * [Math]::Sin($dPhi / 2) + [Math]::Cos($phi1) * [Math]::Cos($phi2) * [Math]::Sin($dLambda / 2) * [Math]::Sin($dLambda / 2)
    return 6371.0088 * 2 * [Math]::Atan2([Math]::Sqrt($a), [Math]::Sqrt(1 - $a))
}

function To-Double([string]$Value) { return [double]::Parse($Value, [Globalization.CultureInfo]::InvariantCulture) }
function Format-Coord([double]$Value) { return $Value.ToString('0.000000', [Globalization.CultureInfo]::InvariantCulture) }

if (-not (Test-Path -LiteralPath $basePath)) { throw "200地点版がありません: $basePath" }
$baseRows = @(Import-Csv -LiteralPath $basePath)
if ($baseRows.Count -ne 200) { throw "200地点版の件数エラー: $($baseRows.Count)" }
$baseRows | ForEach-Object {
    $_ | Add-Member -NotePropertyName id -NotePropertyValue (('{0}-{1:d3}' -f $sharedIdPrefix, [int]$_.no)) -Force
}

$baseKeys = @{}
$basePoints = @()
foreach ($row in $baseRows) {
    $basePoints += [pscustomobject]@{ latitude = To-Double $row.latitude; longitude = To-Double $row.longitude; name = $row.name }
    if ($row.selection_role -eq 'official-background') {
        $baseKeys["$(Normalize-Text $row.name)|$($row.prefecture)"] = $true
    }
}

$rawRows = @()
foreach ($source in @(
    @{ Path = (Join-Path $sourceDir '102-shrine.csv'); Category = '神社建築'; Label = 'shrine' },
    @{ Path = (Join-Path $sourceDir '102-temple.csv'); Category = '寺院建築'; Label = 'temple' }
)) {
    if (-not (Test-Path -LiteralPath $source.Path)) { throw "公式データがありません: $($source.Path)" }
    foreach ($row in @(Import-Csv -LiteralPath $source.Path)) {
        if ([string]::IsNullOrWhiteSpace([string]$row.緯度) -or [string]::IsNullOrWhiteSpace([string]$row.経度)) { continue }
        $row | Add-Member -NotePropertyName category_v5 -NotePropertyValue $source.Category -Force
        $row | Add-Member -NotePropertyName source_label_v5 -NotePropertyValue $source.Label -Force
        $rawRows += $row
    }
}

$groups = $rawRows | Group-Object -Property { "$(Normalize-Text $_.名称)|$($_.都道府県)" }
$dedup = @{}
foreach ($group in $groups) {
    $rows = @($group.Group)
    $preferred = $rows | Sort-Object @{ Expression = { if ([string]$_.棟名 -match '本殿|本堂|正殿|拝殿|天守|門') { 0 } else { 1 } } }, @{ Expression = { [string]$_.名称 } }, @{ Expression = { [string]$_.棟名 } } | Select-Object -First 1
    $lat = To-Double ([string]$preferred.緯度); $lon = To-Double ([string]$preferred.経度)
    $name = [string]$preferred.名称; $pref = [string]$preferred.都道府県
    if ([string]::IsNullOrWhiteSpace($name) -or [string]::IsNullOrWhiteSpace($pref)) { continue }
    $key = "$(Normalize-Text $name)|$pref"
    if (-not $dedup.ContainsKey($key)) {
        $sourceId = "$($preferred.source_label_v5)-$($preferred.台帳ID)-$($preferred.'管理対象ID')"
        $candidate = [pscustomobject]@{
            name = $name; category = [string]$preferred.category_v5; designation = [string]$preferred.種別1;
            prefecture = $pref; region = Get-Region $pref; latitude = $lat; longitude = $lon;
            source_type = '文化庁・国指定文化財等DB'; source_url = $officialSource;
            source_record_id = $sourceId; coordinate_source = '文化庁DBの緯度・経度欄'; selection_role = 'official-background-addition';
        }
        $candidate | Add-Member -NotePropertyName rank -NotePropertyValue (Get-Rank "$($candidate.category)|$sourceId|$lat|$lon") -Force
        $dedup[$key] = $candidate
    }
}

# 200地点版に含まれる施設名はそのまま残し、追加候補から外す。
$available = @($dedup.Values | Where-Object {
    $candidate = $_
    $key = "$(Normalize-Text $candidate.name)|$($candidate.prefecture)"
    if ($baseKeys.ContainsKey($key)) { return $false }
    -not (@($basePoints | Where-Object { (Get-DistanceKm $candidate.latitude $candidate.longitude $_.latitude $_.longitude) -lt $minDistanceKm }).Count -gt 0)
})
if ($available.Count -lt $backgroundAdditionTarget) { throw "200地点から2km以上離れた追加候補が不足しています: $($available.Count)" }

$spatialIndex = @{}
foreach ($candidate in $available) {
    $candidate | Add-Member -NotePropertyName grid_lat_v5 -NotePropertyValue ([int][Math]::Floor($candidate.latitude / $gridSize)) -Force
    $candidate | Add-Member -NotePropertyName grid_lon_v5 -NotePropertyValue ([int][Math]::Floor($candidate.longitude / $gridSize)) -Force
    $cellKey = "$($candidate.grid_lat_v5)|$($candidate.grid_lon_v5)"
    if (-not $spatialIndex.ContainsKey($cellKey)) { $spatialIndex[$cellKey] = @() }
    $spatialIndex[$cellKey] += $candidate
}

$regionCount = @{}
foreach ($group in @($available | Group-Object region)) { $regionCount[$group.Name] = $group.Count }
$regionTarget = @{}
$regionRemainder = @{}
$availableTotal = [double]$available.Count
foreach ($region in $regionCount.Keys) {
    $rawTarget = $backgroundAdditionTarget * [double]$regionCount[$region] / $availableTotal
    $regionTarget[$region] = [Math]::Floor($rawTarget)
    $regionRemainder[$region] = $rawTarget - $regionTarget[$region]
}
$remainingRegionSlots = $backgroundAdditionTarget - (($regionTarget.Values | Measure-Object -Sum).Sum)
foreach ($entry in @($regionRemainder.GetEnumerator() | Sort-Object @{ Expression = { -[double]$_.Value } }, @{ Expression = { [string]$_.Key } } | Select-Object -First $remainingRegionSlots)) {
    $regionTarget[$entry.Key] = $regionTarget[$entry.Key] + 1
}

$categoryTarget = @{ '神社建築' = 150; '寺院建築' = 150 }
$categoryUsed = @{ '神社建築' = 0; '寺院建築' = 0 }
$regionUsed = @{}
foreach ($region in $regionCount.Keys) { $regionUsed[$region] = 0 }
$blockedIds = @{}
$selected = @()

function Add-BlockedNeighbors([object]$Selected, [hashtable]$BlockedState) {
    $centerLat = [int][Math]::Floor($Selected.latitude / $gridSize)
    $centerLon = [int][Math]::Floor($Selected.longitude / $gridSize)
    for ($latCell = $centerLat - 2; $latCell -le $centerLat + 2; $latCell++) {
        for ($lonCell = $centerLon - 2; $lonCell -le $centerLon + 2; $lonCell++) {
            $cellKey = "$latCell|$lonCell"
            if (-not $spatialIndex.ContainsKey($cellKey)) { continue }
            foreach ($candidate in @($spatialIndex[$cellKey])) {
                if ((Get-DistanceKm $Selected.latitude $Selected.longitude $candidate.latitude $candidate.longitude) -lt $minDistanceKm) { $BlockedState[$candidate.source_record_id] = $true }
            }
        }
    }
}

while ($selected.Count -lt $backgroundAdditionTarget) {
    $options = @($available | Where-Object {
        -not $blockedIds.ContainsKey($_.source_record_id) -and $categoryUsed[$_.category] -lt $categoryTarget[$_.category]
    })
    if ($options.Count -eq 0) { break }
    $underTarget = @($options | Where-Object { $regionUsed[$_.region] -lt $regionTarget[$_.region] })
    if ($underTarget.Count -gt 0) { $options = $underTarget }
    $next = $options | Sort-Object `
        @{ Expression = { -($regionTarget[$_.region] - $regionUsed[$_.region]) } }, `
        @{ Expression = { -($categoryTarget[$_.category] - $categoryUsed[$_.category]) } }, `
        @{ Expression = { $_.rank } } | Select-Object -First 1
    if ($null -eq $next) { break }
    $selected += $next
    Add-BlockedNeighbors $next $blockedIds
    $categoryUsed[$next.category] = $categoryUsed[$next.category] + 1
    $regionUsed[$next.region] = $regionUsed[$next.region] + 1
}

if ($selected.Count -ne $backgroundAdditionTarget) { throw "追加地点を300件選べませんでした: $($selected.Count)" }
if ($categoryUsed['神社建築'] -ne 150 -or $categoryUsed['寺院建築'] -ne 150) { throw "追加カテゴリ配分エラー" }

$output = @($baseRows)
$number = 201
foreach ($row in $selected) {
    $output += [pscustomobject]@{ no=$number; id=('{0}-{1:d3}' -f $sharedIdPrefix, $number); name=$row.name; category=$row.category; designation=$row.designation; prefecture=$row.prefecture; region=$row.region; latitude=(Format-Coord $row.latitude); longitude=(Format-Coord $row.longitude); source_type=$row.source_type; source_url=$row.source_url; source_record_id=$row.source_record_id; coordinate_source=$row.coordinate_source; selection_role=$row.selection_role; selection_rule='200地点版を固定; official pool addition; proportional regional target; 2km spacing; deterministic SHA-256 rank' }
    $number = $number + 1
}
$output | Export-Csv -LiteralPath $outputPath -NoTypeInformation -Encoding utf8

$regionSummary = $output | Group-Object region | Sort-Object Name | ForEach-Object { "| $($_.Name) | $($_.Count) |" }
$categorySummary = $output | Group-Object category | Sort-Object Name | ForEach-Object { "| $($_.Name) | $($_.Count) |" }
$method = @"
# candidate-sites-500-shrines-temples-v5-nested 選定メモ

## 結論

前版の200地点版を200地点すべて固定し、文化庁DB由来の追加300地点を加えた包含型の500地点版である。

## 取得元と母集団

追加候補の取得元: [文化庁 国指定文化財等データベース]($officialSource)  
公式レコード: $($rawRows.Count)件  
名称・都道府県で整理した公式候補: $($dedup.Count)件  
200地点から2km以上離れ、200地点と同名でない追加候補: $($available.Count)件  
最終構成: 既存200地点＋公式データ由来の追加300地点 = 500地点

## 追加ルール

- 200地点版の200行は変更せず、そのまま採用した。
- 200地点版と追加分には共通安定ID（`kinki-shrine-temple-sites-v5-nested-001`形式）を付与し、名前では照合しない。
- 追加分は神社建築150地点、寺院建築150地点とした。
- 200地点版の公式背景地点と同一名称・同一都道府県の候補は追加しなかった。
- 200地点版および採用済み追加地点から2km未満の候補は除外した。
- 追加分の地域枠は、200地点から2km以上離れた追加候補の地域別件数に比例させた。
- 追加順位はSHA-256で固定し、実行時刻や通常の乱数に依存しない。

## 注意

このリストは日本のすべての神社・寺院を網羅した名所ランキングではない。文化庁DBで位置情報を確認できる神社建築・寺院建築を、再現可能な比較用母集団として使っている。固定アンカー5地点は、前版と同じく記事の検証対象として残している。

## 地域別集計

| 地域 | 件数 |
|---|---:|
$($regionSummary -join "`n")

## カテゴリ別集計

| カテゴリ | 件数 |
|---|---:|
$($categorySummary -join "`n")
"@
[IO.File]::WriteAllText($methodPath, $method, (New-Object Text.UTF8Encoding($false)))
Write-Host "作成: $outputPath"
Write-Host "作成: $methodPath"
Write-Host "raw=$($rawRows.Count) dedup=$($dedup.Count) available=$($available.Count)"
Write-Host "総数: $($output.Count) / 既存: $($baseRows.Count) / 追加: $($selected.Count)"
Write-Host "追加カテゴリ: 神社=$($categoryUsed['神社建築']) 寺院=$($categoryUsed['寺院建築'])"
