[CmdletBinding()]
param(
    [string]$DataDir = (Join-Path (Get-Location) 'docs\data\candidate-sites-200-v3')
)

$ErrorActionPreference = 'Stop'
$sourceDir = Join-Path (Get-Location) 'docs\data\candidate-sites-200-v2\raw'
$outputPath = Join-Path $DataDir 'candidate-sites-200-shrines-temples-v3.csv'
$methodPath = Join-Path $DataDir 'candidate-sites-200-shrines-temples-v3-method.md'
$officialSource = 'https://kunishitei.bunka.go.jp/bsys/index'
$anchorSource = 'provided:近畿五芒星の5地点'
$sharedIdPrefix = 'kinki-shrine-temple-sites-v5-nested'
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

$rawRows = @()
foreach ($source in @(
    @{ Path = (Join-Path $sourceDir '102-shrine.csv'); Category = '神社建築' },
    @{ Path = (Join-Path $sourceDir '102-temple.csv'); Category = '寺院建築' }
)) {
    if (-not (Test-Path -LiteralPath $source.Path)) { throw "公式データがありません: $($source.Path)" }
    foreach ($row in @(Import-Csv -LiteralPath $source.Path)) {
        if ([string]::IsNullOrWhiteSpace([string]$row.緯度) -or [string]::IsNullOrWhiteSpace([string]$row.経度)) { continue }
        $row | Add-Member -NotePropertyName category_v3 -NotePropertyValue $source.Category -Force
        $rawRows += $row
    }
}

# 同じ施設の建物別レコードを名称・都道府県でまとめる。
$groups = $rawRows | Group-Object -Property { "$(Normalize-Text $_.名称)|$($_.都道府県)" }
$dedup = @{}
foreach ($group in $groups) {
    $rows = @($group.Group)
    $preferred = $rows | Sort-Object @{ Expression = { if ([string]$_.棟名 -match '本殿|本堂|正殿|拝殿|天守|門') { 0 } else { 1 } } }, @{ Expression = { [string]$_.名称 } } | Select-Object -First 1
    $lat = To-Double ([string]$preferred.緯度); $lon = To-Double ([string]$preferred.経度)
    $name = [string]$preferred.名称; $pref = [string]$preferred.都道府県
    if ([string]::IsNullOrWhiteSpace($name) -or [string]::IsNullOrWhiteSpace($pref)) { continue }
    $key = "$(Normalize-Text $name)|$pref"
    if (-not $dedup.ContainsKey($key)) {
        $dedup[$key] = [pscustomobject]@{
            name = $name; category = [string]$preferred.category_v3; designation = [string]$preferred.種別1;
            prefecture = $pref; region = Get-Region $pref; latitude = $lat; longitude = $lon;
            source_type = '文化庁・国指定文化財等DB'; source_url = $officialSource;
            source_record_id = "$($preferred.台帳ID)-$($preferred.'管理対象ID')";
            coordinate_source = '文化庁DBの緯度・経度欄'; selection_role = 'official-background';
        }
    }
}

$anchors = @(
    [pscustomobject]@{ name='伊勢神宮 内宮'; prefecture='三重県'; latitude=34.455; longitude=136.7252; source_record_id='anchor-001' },
    [pscustomobject]@{ name='熊野本宮大社'; prefecture='和歌山県'; latitude=33.8406; longitude=135.7734; source_record_id='anchor-002' },
    [pscustomobject]@{ name='伊弉諾神宮'; prefecture='兵庫県'; latitude=34.4601; longitude=134.8525; source_record_id='anchor-003' },
    [pscustomobject]@{ name='元伊勢皇大神社'; prefecture='京都府'; latitude=35.4304; longitude=135.1543; source_record_id='anchor-004' },
    [pscustomobject]@{ name='伊吹山'; prefecture='滋賀県'; latitude=35.4178; longitude=136.4064; source_record_id='anchor-005' }
)

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

$regionQuota = [ordered]@{ '北海道'=12; '東北'=20; '関東'=30; '北陸甲信'=20; '東海'=25; '近畿'=30; '中国'=20; '四国'=15; '九州'=23; '沖縄'=5 }
$categoryQuota = [ordered]@{ '神社建築'=100; '寺院建築'=95 }
$regionUsed = @{}
$regionCapacity = @{}
foreach ($region in $regionQuota.Keys) {
    $regionUsed[$region] = @($anchors | Where-Object { (Get-Region $_.prefecture) -eq $region }).Count
    $regionCapacity[$region] = [Math]::Max(0, $regionQuota[$region] - $regionUsed[$region])
}
$categoryUsed = @{ '神社建築'=0; '寺院建築'=0 }
$blockedIds = @{}
$selected = @()

function Add-BlockedNeighbors([object]$Selected, [object[]]$AllCandidates, [hashtable]$BlockedState) {
    foreach ($candidate in $AllCandidates) {
        if ((Get-DistanceKm $Selected.latitude $Selected.longitude $candidate.latitude $candidate.longitude) -lt 2) { $BlockedState[$candidate.source_record_id] = $true }
    }
}

function Select-Next([object[]]$Candidates, [hashtable]$RegionUsedState, [hashtable]$RegionCapacityState, [hashtable]$BlockedState) {
    $eligible = @($Candidates | Where-Object { $RegionCapacityState.ContainsKey($_.region) -and $RegionCapacityState[$_.region] -gt 0 -and -not $BlockedState.ContainsKey($_.source_record_id) })
    if ($eligible.Count -eq 0) { return $null }
    return $eligible | Sort-Object @{ Expression = { [double]$RegionUsedState[$_.region] / [double]$RegionCapacityState[$_.region] } }, @{ Expression = { $_.rank } } | Select-Object -First 1
}

foreach ($category in @('神社建築','寺院建築')) {
    $categoryCandidates = @($background | Where-Object category -eq $category | Sort-Object rank)
    while ($categoryUsed[$category] -lt $categoryQuota[$category]) {
        $next = Select-Next $categoryCandidates $regionUsed $regionCapacity $blockedIds
        if ($null -eq $next) { break }
        $selected += $next
        Add-BlockedNeighbors $next $background $blockedIds
        $categoryCandidates = @($categoryCandidates | Where-Object source_record_id -ne $next.source_record_id)
        $regionUsed[$next.region]++; $regionCapacity[$next.region]--; $categoryUsed[$category]++
    }
}

$remaining = @($background | Where-Object { -not $blockedIds.ContainsKey($_.source_record_id) } | Sort-Object rank)
while ($selected.Count -lt 195) {
    $next = Select-Next $remaining $regionUsed $regionCapacity $blockedIds
    if ($null -eq $next) { $next = $remaining | Where-Object { -not $blockedIds.ContainsKey($_.source_record_id) } | Select-Object -First 1 }
    if ($null -eq $next) { break }
    $selected += $next
    Add-BlockedNeighbors $next $background $blockedIds
    $remaining = @($remaining | Where-Object source_record_id -ne $next.source_record_id)
    if ($regionUsed.ContainsKey($next.region)) { $regionUsed[$next.region]++; $regionCapacity[$next.region]-- }
}
if ($selected.Count -ne 195) { throw "背景地点を195件選べませんでした: $($selected.Count)" }

$output = @()
$number = 1
foreach ($anchor in $anchors) {
    $output += [pscustomobject]@{ no=$number; id=('{0}-{1:d3}' -f $sharedIdPrefix, $number); name=$anchor.name; category='近畿五芒星・固定アンカー'; designation='記事の検証対象'; prefecture=$anchor.prefecture; region=Get-Region $anchor.prefecture; latitude=([double]$anchor.latitude).ToString('0.000000',[Globalization.CultureInfo]::InvariantCulture); longitude=([double]$anchor.longitude).ToString('0.000000',[Globalization.CultureInfo]::InvariantCulture); source_type='記事の固定アンカー'; source_url=$anchorSource; source_record_id=$anchor.source_record_id; coordinate_source='記事で先に固定した座標'; selection_role='target-anchor'; selection_rule='fixed before background sampling' }
    $number++
}
foreach ($row in $selected) {
    $output += [pscustomobject]@{ no=$number; id=('{0}-{1:d3}' -f $sharedIdPrefix, $number); name=$row.name; category=$row.category; designation=$row.designation; prefecture=$row.prefecture; region=$row.region; latitude=([double]$row.latitude).ToString('0.000000',[Globalization.CultureInfo]::InvariantCulture); longitude=([double]$row.longitude).ToString('0.000000',[Globalization.CultureInfo]::InvariantCulture); source_type=$row.source_type; source_url=$row.source_url; source_record_id=$row.source_record_id; coordinate_source=$row.coordinate_source; selection_role=$row.selection_role; selection_rule='shrine/temple official pool; region+category quotas; 2km spacing; deterministic SHA-256 rank' }
    $number++
}
$output | Export-Csv -LiteralPath $outputPath -NoTypeInformation -Encoding utf8

$regionSummary = $output | Group-Object region | Sort-Object Name | ForEach-Object { "| $($_.Name) | $($_.Count) |" }
$categorySummary = $output | Group-Object category | Sort-Object Name | ForEach-Object { "| $($_.Name) | $($_.Count) |" }
$method = @"
# candidate-sites-200-shrines-temples-v3 選定メモ

取得元: [文化庁 国指定文化財等データベース]($officialSource)  
背景母集団: 102「近世以前／神社」および102「近世以前／寺院」の座標付きレコード 2,793件  
最終構成: 固定アンカー5地点＋神社・寺院の背景195地点  

## 方針

このリストは「国指定文化財を何でも集めた200地点」ではなく、近畿五芒星のような「意味のある聖地」を比較するための母集団である。背景候補は神社建築と寺院建築に限定し、動植物、ホタル、地質、景観、城郭などは含めない。

伊吹山は近畿五芒星の検証対象として記事の冒頭で固定したため、背景母集団とは別区分のアンカーとして残した。

## 選定ルール

- 神社建築100地点、寺院建築95地点を目標枠とした。
- 地点IDは、後続の500地点版と照合できる共通安定ID（`kinki-shrine-temple-sites-v5-nested-001`形式）を付与した。
- 北海道、東北、関東、北陸甲信、東海、近畿、中国、四国、九州、沖縄に地域枠を設けた。
- 同一名称・同一都道府県の建物別レコードを1地点に整理した。
- アンカーおよび採用済み地点から2km未満の候補は除外した。
- 枠内の順位はSHA-256で固定し、実行時刻や通常の乱数に依存しない。

## 注意

「有名」の完全な客観定義はできないため、文化庁DBの神社・寺院建築という再現可能な入口を使った。したがって、これは日本の全宗教施設を代表する標本ではなく、国指定等を持つ社寺を中心にした比較用リストである。

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
Write-Host "総数: $($output.Count) / 背景: $($selected.Count) / アンカー: $($anchors.Count)"
