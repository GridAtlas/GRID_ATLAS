[CmdletBinding()]
param(
    [string]$BaseCsvPath = (Join-Path (Get-Location) 'docs\data\candidate-sites-200-v3\candidate-sites-200-shrines-temples-v3.csv'),
    [string]$CsvPath = (Join-Path (Get-Location) 'docs\data\candidate-sites-500-v5-nested\candidate-sites-500-shrines-temples-v5-nested.csv'),
    [string]$GridAtlasPath = (Join-Path (Get-Location) 'docs\data\candidate-sites-500-v5-nested\kinki-shrine-temple-sites-v5-nested-500.gridatlas')
)

$ErrorActionPreference = 'Stop'
function D([double]$a,[double]$b,[double]$c,[double]$d) {
    $r = [Math]::PI / 180
    $p1 = $a*$r; $p2 = $c*$r; $dp = ($c-$a)*$r; $dl = ($d-$b)*$r
    $x = [Math]::Sin($dp/2)*[Math]::Sin($dp/2) + [Math]::Cos($p1)*[Math]::Cos($p2)*[Math]::Sin($dl/2)*[Math]::Sin($dl/2)
    return 6371.0088 * 2 * [Math]::Atan2([Math]::Sqrt($x),[Math]::Sqrt(1-$x))
}

$baseRows = @(Import-Csv -LiteralPath $BaseCsvPath)
$rows = @(Import-Csv -LiteralPath $CsvPath)
if ($baseRows.Count -ne 200 -or $rows.Count -ne 500) { throw "件数エラー: base=$($baseRows.Count) final=$($rows.Count)" }
$fields = @($baseRows[0].PSObject.Properties.Name)
for ($i = 0; $i -lt 200; $i++) {
    foreach ($field in $fields) {
        if ([string]$baseRows[$i].$field -cne [string]$rows[$i].$field) { throw "既存200地点の変更を検出: 行=$($i+1) field=$field" }
    }
}
if (@($rows.source_record_id | Sort-Object -Unique).Count -ne 500) { throw 'source_record_idの重複があります。' }
$bad = @($rows | Where-Object { [double]$_.latitude -lt 20 -or [double]$_.latitude -gt 46 -or [double]$_.longitude -lt 122 -or [double]$_.longitude -gt 146 })
if ($bad.Count -gt 0) { throw "座標範囲エラー: $($bad.Count)" }
$categoryCounts = @{}
foreach ($group in @($rows | Group-Object category)) { $categoryCounts[$group.Name] = $group.Count }
if ($categoryCounts['近畿五芒星・固定アンカー'] -ne 5 -or $categoryCounts['神社建築'] -ne 254 -or $categoryCounts['寺院建築'] -ne 241) { throw "カテゴリ配分エラー: $($categoryCounts | Out-String)" }

$pairs = @()
for ($i=0; $i -lt $rows.Count; $i++) {
    for ($j=$i+1; $j -lt $rows.Count; $j++) {
        $km = D ([double]$rows[$i].latitude) ([double]$rows[$i].longitude) ([double]$rows[$j].latitude) ([double]$rows[$j].longitude)
        if ($km -lt 2) { $pairs += [pscustomobject]@{ km=[Math]::Round($km,3); a=$rows[$i].name; b=$rows[$j].name } }
    }
}
if ($pairs.Count -gt 0) { throw "2km未満の地点ペアがあります: $($pairs.Count)" }

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead([IO.Path]::GetFullPath($GridAtlasPath))
try {
    $names = @($archive.Entries | ForEach-Object FullName | Sort-Object)
    if ($names.Count -ne 2 -or $names -notcontains 'manifest.json' -or $names -notcontains 'document.json') { throw "GRID ATLASのルート構成エラー: $($names -join ', ')" }
    $manifestEntry = $archive.GetEntry('manifest.json')
    $documentEntry = $archive.GetEntry('document.json')
    $manifestReader = New-Object IO.StreamReader($manifestEntry.Open(), (New-Object Text.UTF8Encoding($false)))
    $manifestText = $manifestReader.ReadToEnd(); $manifestReader.Dispose()
    $documentStream = New-Object IO.MemoryStream
    $documentInput = $documentEntry.Open(); $documentInput.CopyTo($documentStream); $documentInput.Dispose()
    $documentBytes = $documentStream.ToArray(); $documentStream.Dispose()
    $documentText = [Text.Encoding]::UTF8.GetString($documentBytes)
    $manifest = $manifestText | ConvertFrom-Json
    $document = $documentText | ConvertFrom-Json
    $hash = [Security.Cryptography.SHA256]::Create()
    try { $actualHash = [BitConverter]::ToString($hash.ComputeHash($documentBytes)).Replace('-', '').ToLowerInvariant() }
    finally { $hash.Dispose() }
    if ($manifest.format -ne 'gridatlas-package' -or $manifest.formatVersion -ne 1) { throw 'manifestの形式エラー' }
    if ($manifest.document.path -ne 'document.json' -or [int]$manifest.document.byteLength -ne $documentBytes.Length -or $manifest.document.sha256 -ne $actualHash) { throw 'documentのハッシュまたはbyteLengthが不一致です。' }
    if ($document.type -ne 'place-list' -or [int]$document.schemaVersion -ne 1 -or @($document.places).Count -ne 500) { throw 'documentの地点数またはスキーマエラー' }
    if (@($document.places.id | Sort-Object -Unique).Count -ne 500) { throw 'place idに重複があります。' }
}
finally { $archive.Dispose() }

Write-Host 'PASS: 前回200地点を完全包含'
Write-Host 'PASS: 500件 / source_record_id重複なし / 座標範囲正常'
Write-Host 'PASS: 追加は神社150件 / 寺院150件'
Write-Host 'PASS: 2km未満の地点ペアなし'
Write-Host "PASS: GRID ATLAS 500地点 / document.sha256=$actualHash"
