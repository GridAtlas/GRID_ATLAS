[CmdletBinding()]
param(
    [string]$CsvPath = (Join-Path (Get-Location) 'docs\data\candidate-sites-200-v2\candidate-sites-200-v2.csv')
)

$ErrorActionPreference = 'Stop'
$rows = @(Import-Csv -LiteralPath $CsvPath)
function D([double]$a,[double]$b,[double]$c,[double]$d) {
    $r = [Math]::PI / 180
    $p1 = $a*$r; $p2 = $c*$r; $dp = ($c-$a)*$r; $dl = ($d-$b)*$r
    $x = [Math]::Sin($dp/2)*[Math]::Sin($dp/2) + [Math]::Cos($p1)*[Math]::Cos($p2)*[Math]::Sin($dl/2)*[Math]::Sin($dl/2)
    return 6371.0088 * 2 * [Math]::Atan2([Math]::Sqrt($x),[Math]::Sqrt(1-$x))
}

if ($rows.Count -ne 200) { throw "件数エラー: $($rows.Count)" }
if (@($rows.source_record_id | Sort-Object -Unique).Count -ne 200) { throw 'source_record_id の重複があります。' }
$bad = @($rows | Where-Object {
    $lat = [double]$_.latitude; $lon = [double]$_.longitude
    $lat -lt 20 -or $lat -gt 46 -or $lon -lt 122 -or $lon -gt 146
})
if ($bad.Count -gt 0) { throw "座標範囲エラー: $($bad.Count)" }

$pairs = @()
for ($i=0; $i -lt $rows.Count; $i++) {
    for ($j=$i+1; $j -lt $rows.Count; $j++) {
        $km = D ([double]$rows[$i].latitude) ([double]$rows[$i].longitude) ([double]$rows[$j].latitude) ([double]$rows[$j].longitude)
        if ($km -lt 2) { $pairs += [pscustomobject]@{ km=[Math]::Round($km,3); a=$rows[$i].name; b=$rows[$j].name } }
    }
}

Write-Host "PASS: 200件 / source_record_id重複なし / 座標範囲正常"
Write-Host "2km未満の地点ペア: $($pairs.Count)"
if ($pairs.Count -gt 0) { $pairs | Sort-Object km | Select-Object -First 10 | Format-Table -AutoSize }
Write-Host '地域別:'
$rows | Group-Object region | Sort-Object Name | Format-Table Name,Count -AutoSize
Write-Host 'カテゴリ別:'
$rows | Group-Object category | Sort-Object Name | Format-Table Name,Count -AutoSize
