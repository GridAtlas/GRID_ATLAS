[CmdletBinding()]
param(
    [string]$DataDir = (Join-Path (Get-Location) 'docs\data\candidate-sites-500-v4')
)

$ErrorActionPreference = 'Stop'
$sourceDir = Join-Path (Get-Location) 'docs\data\candidate-sites-200-v2\raw'
$outputPath = Join-Path $DataDir 'candidate-sites-500-shrines-temples-v4.csv'
$methodPath = Join-Path $DataDir 'candidate-sites-500-shrines-temples-v4-method.md'
$officialSource = 'https://kunishitei.bunka.go.jp/bsys/index'
$anchorSource = 'provided:近畿五芒星の5地点'
$backgroundTarget = 495
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

$rawRows = @()
foreach ($source in @(
    @{ Path = (Join-Path $sourceDir '102-shrine.csv'); Category = '神社建築'; Label = 'shrine' },
    @{ Path = (Join-Path $sourceDir '102-temple.csv'); Category = '寺院建築'; Label = 'temple' }
)) {
    if (-not (Test-Path -LiteralPath $source.Path)) { throw "公式データがありません: $($source.Path)" }
    foreach ($row in @(Import-Csv -LiteralPath $source.Path)) {
        if ([string]::IsNullOrWhiteSpace([string]$row.緯度) -or [string]::IsNullOrWhiteSpace([string]$row.経度)) { continue }
        $row | Add-Member -NotePropertyName category_v4 -NotePropertyValue $source.Category -Force
        $row | Add-Member -NotePropertyName source_label_v4 -NotePropertyValue $source.Label -Force
        $rawRows += $row
    }
}

# 同じ施設の建物別レコードを名称・都道府県でまとめる。
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
        $sourceId = "$($preferred.source_label_v4)-$($preferred.台帳ID)-$($preferred.'管理対象ID')"
        $candidate = [pscustomobject]@{
            name = $name; category = [string]$preferred.category_v4; designation = [string]$preferred.種別1;
            prefecture = $pref; region = Get-Region $pref; latitude = $lat; longitude = $lon;
            source_type = '文化庁・国指定文化財等DB'; source_url = $officialSource;
            source_record_id = $sourceId; coordinate_source = '文化庁DBの緯度・経度欄'; selection_role = 'official-background';
        }
        $candidate | Add-Member -NotePropertyName rank -NotePropertyValue (Get-Rank "$($candidate.category)|$sourceId|$lat|$lon") -Force
        $dedup[$key] = $candidate
    }
}

$anchors = @(
    [pscustomobject]@{ name='伊勢神宮 内宮'; prefecture='三重県'; latitude=34.455; longitude=136.7252; source_record_id='anchor-001' },
    [pscustomobject]@{ name='熊野本宮大社'; prefecture='和歌山県'; latitude=33.8406; longitude=135.7734; source_record_id='anchor-002' },
    [pscustomobject]@{ name='伊弉諾神宮'; prefecture='兵庫県'; latitude=34.4601; longitude=134.8525; source_record_id='anchor-003' },
    [pscustomobject]@{ name='元伊勢皇大神社'; prefecture='京都府'; latitude=35.4304; longitude=135.1543; source_record_id='anchor-004' },
    [pscustomobject]@{ name='伊吹山'; prefecture='滋賀県'; latitude=35.4178; longitude=136.4064; source_record_id='anchor-005' }
)

$available = @($dedup.Values | Where-Object {
    $candidate = $_
    -not (@($anchors | Where-Object { (Get-DistanceKm $candidate.latitude $candidate.longitude $_.latitude $_.longitude) -lt $minDistanceKm }).Count -gt 0)
})
if ($available.Count -lt $backgroundTarget) { throw "2km除外後の候補が不足しています: $($available.Count)" }

# 近接除外は緯度・経度の小さなグリッドで候補を絞ってから測地距離を計算する。
# 500地点では全候補との総当たりを避けることで、選定の再現性を保ったまま処理を軽くする。
$spatialIndex = @{}
foreach ($candidate in $available) {
    $candidate | Add-Member -NotePropertyName grid_lat_v4 -NotePropertyValue ([int][Math]::Floor($candidate.latitude / $gridSize)) -Force
    $candidate | Add-Member -NotePropertyName grid_lon_v4 -NotePropertyValue ([int][Math]::Floor($candidate.longitude / $gridSize)) -Force
    $cellKey = "$($candidate.grid_lat_v4)|$($candidate.grid_lon_v4)"
    if (-not $spatialIndex.ContainsKey($cellKey)) { $spatialIndex[$cellKey] = @() }
    $spatialIndex[$cellKey] += $candidate
}

# 公式候補の地域別件数に比例した地域枠を最大剰余法で作る。
$regionCount = @{}
foreach ($group in @($available | Group-Object region)) { $regionCount[$group.Name] = $group.Count }
$regionTarget = @{}
$regionRemainder = @{}
$availableTotal = [double]$available.Count
foreach ($region in $regionCount.Keys) {
    $rawTarget = $backgroundTarget * [double]$regionCount[$region] / $availableTotal
    $regionTarget[$region] = [Math]::Floor($rawTarget)
    $regionRemainder[$region] = $rawTarget - $regionTarget[$region]
}
$remainingRegionSlots = $backgroundTarget - (($regionTarget.Values | Measure-Object -Sum).Sum)
foreach ($entry in @($regionRemainder.GetEnumerator() | Sort-Object @{ Expression = { -[double]$_.Value } }, @{ Expression = { [string]$_.Key } } | Select-Object -First $remainingRegionSlots)) {
    $regionTarget[$entry.Key]++
}

$categoryTarget = @{ '神社建築' = 247; '寺院建築' = 248 }
$categoryUsed = @{ '神社建築' = 0; '寺院建築' = 0 }
$regionUsed = @{}
foreach ($region in $regionCount.Keys) { $regionUsed[$region] = 0 }
$blockedIds = @{}
$selected = @()

function Add-BlockedNeighbors([object]$Selected, [object[]]$AllCandidates, [hashtable]$BlockedState) {
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

while ($selected.Count -lt $backgroundTarget) {
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
    Add-BlockedNeighbors $next $available $blockedIds
    $categoryUsed[$next.category]++
    $regionUsed[$next.region]++
}

if ($selected.Count -ne $backgroundTarget) { throw "背景地点を495件選べませんでした: $($selected.Count); カテゴリ=$($categoryUsed | Out-String)" }
if ($categoryUsed['神社建築'] -ne 247 -or $categoryUsed['寺院建築'] -ne 248) { throw "カテゴリ配分エラー: 神社=$($categoryUsed['神社建築']) 寺院=$($categoryUsed['寺院建築'])" }

$output = @()
$number = 1
foreach ($anchor in $anchors) {
    $output += [pscustomobject]@{ no=$number; name=$anchor.name; category='近畿五芒星・固定アンカー'; designation='記事の検証対象'; prefecture=$anchor.prefecture; region=Get-Region $anchor.prefecture; latitude=(Format-Coord $anchor.latitude); longitude=(Format-Coord $anchor.longitude); source_type='記事の固定アンカー'; source_url=$anchorSource; source_record_id=$anchor.source_record_id; coordinate_source='記事で先に固定した座標'; selection_role='target-anchor'; selection_rule='fixed before official background sampling' }
    $number++
}
foreach ($row in $selected) {
    $output += [pscustomobject]@{ no=$number; name=$row.name; category=$row.category; designation=$row.designation; prefecture=$row.prefecture; region=$row.region; latitude=(Format-Coord $row.latitude); longitude=(Format-Coord $row.longitude); source_type=$row.source_type; source_url=$row.source_url; source_record_id=$row.source_record_id; coordinate_source=$row.coordinate_source; selection_role=$row.selection_role; selection_rule='shrine/temple official pool; proportional regional target; 2km spacing; deterministic SHA-256 rank' }
    $number++
}
$output | Export-Csv -LiteralPath $outputPath -NoTypeInformation -Encoding utf8

$regionSummary = $output | Group-Object region | Sort-Object Name | ForEach-Object { "| $($_.Name) | $($_.Count) |" }
$categorySummary = $output | Group-Object category | Sort-Object Name | ForEach-Object { "| $($_.Name) | $($_.Count) |" }
$method = @"
# candidate-sites-500-shrines-temples-v4 選定メモ

取得元: [文化庁 国指定文化財等データベース]($officialSource)  
背景母集団: 102「近世以前／神社」および102「近世以前／寺院」の座標付きレコード $($rawRows.Count)件  
名称・都道府県で整理した候補: $($dedup.Count)件  
固定アンカーから2km以上の候補: $($available.Count)件  
最終構成: 固定アンカー5地点＋公式データ由来の神社・寺院495地点 = 500地点

## 方針

前版と同じく、背景候補は文化庁DBの神社建築・寺院建築に限定した。動植物、ホタル、地質、景観、城郭などは含めていない。伊吹山を含む近畿五芒星の5地点は、記事で先に固定した比較対象として別区分で残している。

## 選定ルール

- 神社建築247地点、寺院建築248地点を選んだ。
- 地域配分は、固定アンカーを除いた公式候補の地域別件数に比例させ、最大剰余法で495枠に配分した。
- 同一名称・同一都道府県の建物別レコードは1地点に整理し、本殿・本堂などを優先した。
- 固定アンカーおよび採用済み地点から2km未満の候補は除外した。
- 採用順位はSHA-256で固定し、実行時刻や通常の乱数に依存しない。

## 注意

この500地点版は、日本のすべての神社・寺院を網羅した名所ランキングではない。文化庁の国指定文化財等DBで、位置情報を確認できる神社建築・寺院建築を再現可能な入口として使った比較用リストである。また、5つの固定アンカーだけは公式候補からの抽出ではなく、記事の検証対象として先に固定した地点である。

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
Write-Host "総数: $($output.Count) / 背景: $($selected.Count) / アンカー: $($anchors.Count)"
Write-Host "カテゴリ: 神社=$($categoryUsed['神社建築']) 寺院=$($categoryUsed['寺院建築'])"
Write-Host "地域枠: $((($regionTarget.GetEnumerator() | Sort-Object Key | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ', '))"
