[CmdletBinding()]
param(
    [string]$CsvPath = (Join-Path (Get-Location) 'docs\data\candidate-sites-500-v4\candidate-sites-500-shrines-temples-v4.csv'),
    [string]$GridAtlasPath = (Join-Path (Get-Location) 'docs\data\candidate-sites-500-v4\kinki-shrine-temple-sites-v4-500.gridatlas')
)

$ErrorActionPreference = 'Stop'
function D([double]$a,[double]$b,[double]$c,[double]$d) {
    $r = [Math]::PI / 180
    $p1 = $a*$r; $p2 = $c*$r; $dp = ($c-$a)*$r; $dl = ($d-$b)*$r
    $x = [Math]::Sin($dp/2)*[Math]::Sin($dp/2) + [Math]::Cos($p1)*[Math]::Cos($p2)*[Math]::Sin($dl/2)*[Math]::Sin($dl/2)
    return 6371.0088 * 2 * [Math]::Atan2([Math]::Sqrt($x),[Math]::Sqrt(1-$x))
}

$rows = @(Import-Csv -LiteralPath $CsvPath)
if ($rows.Count -ne 500) { throw "CSV件数エラー: $($rows.Count)" }
if (@($rows.source_record_id | Sort-Object -Unique).Count -ne 500) { throw 'CSVのsource_record_idに重複があります。' }
$bad = @($rows | Where-Object {
    $lat = [double]$_.latitude; $lon = [double]$_.longitude
    $lat -lt 20 -or $lat -gt 46 -or $lon -lt 122 -or $lon -gt 146
})
if ($bad.Count -gt 0) { throw "CSV座標範囲エラー: $($bad.Count)" }
$categoryCounts = @{}
foreach ($group in @($rows | Group-Object category)) { $categoryCounts[$group.Name] = $group.Count }
if ($categoryCounts['近畿五芒星・固定アンカー'] -ne 5 -or $categoryCounts['神社建築'] -ne 247 -or $categoryCounts['寺院建築'] -ne 248) {
    throw "CSVカテゴリ配分エラー: $($categoryCounts | Out-String)"
}

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
    if ($manifest.format -ne 'gridatlas-package' -or $manifest.formatVersion -ne 1) { throw 'GRID ATLAS manifestの形式エラー' }
    if ($manifest.document.path -ne 'document.json' -or [int]$manifest.document.byteLength -ne $documentBytes.Length -or $manifest.document.sha256 -ne $actualHash) { throw 'GRID ATLAS documentのハッシュまたはbyteLengthが不一致です。' }
    if ($document.type -ne 'place-list' -or [int]$document.schemaVersion -ne 1 -or @($document.places).Count -ne 500) { throw 'GRID ATLAS documentの地点数またはスキーマエラー' }
    if (@($document.places.id | Sort-Object -Unique).Count -ne 500) { throw 'GRID ATLAS place idに重複があります。' }
}
finally { $archive.Dispose() }

Write-Host 'PASS: CSV 500件 / source_record_id重複なし / 座標範囲正常'
Write-Host 'PASS: 神社247件 / 寺院248件 / 固定アンカー5件'
Write-Host 'PASS: 2km未満の地点ペアなし'
Write-Host "PASS: GRID ATLAS 500地点 / document.sha256=$actualHash"
Write-Host '地域別:'
$rows | Group-Object region | Sort-Object Name | Format-Table Name,Count -AutoSize
