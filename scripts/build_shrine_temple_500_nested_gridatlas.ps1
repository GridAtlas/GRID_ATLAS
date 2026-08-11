[CmdletBinding()]
param(
    [string]$CsvPath = (Join-Path (Get-Location) 'docs\data\candidate-sites-500-v5-nested\candidate-sites-500-shrines-temples-v5-nested.csv'),
    [string]$OutputPath = (Join-Path (Get-Location) 'docs\data\candidate-sites-500-v5-nested\kinki-shrine-temple-sites-v5-nested-500.gridatlas')
)

$ErrorActionPreference = 'Stop'
$rows = @(Import-Csv -LiteralPath $CsvPath)
if ($rows.Count -ne 500) { throw "CSVの件数が500ではありません: $($rows.Count)" }
if (@($rows | Where-Object { [string]::IsNullOrWhiteSpace([string]$_.id) }).Count -gt 0) { throw "CSVに安定IDがない地点があります" }

$places = @()
foreach ($row in $rows) {
    $noteParts = @($row.category, $row.designation, $row.prefecture, $row.selection_role) | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) }
    $places += [ordered]@{
        id = [string]$row.id
        name = [string]$row.name
        position = [ordered]@{
            latitude = [double]$row.latitude
            longitude = [double]$row.longitude
        }
        note = ($noteParts -join ' / ')
    }
}

$document = [ordered]@{
    type = 'place-list'
    schemaVersion = 1
    id = 'kinki-shrine-temple-sites-v5-nested-500'
    name = '公式データ 神社・寺院500地点（200＋300包含型）'
    description = '前回の200地点を固定し、文化庁 国指定文化財等データベース由来の神社建築・寺院建築300地点を追加した包含型リスト。'
    attribution = [ordered]@{
        name = '文化庁 国指定文化財等データベース／GRID ATLAS'
        url = 'https://kunishitei.bunka.go.jp/bsys/index'
    }
    places = $places
}

$jsonOptions = @{ Depth = 10; Compress = $false; EscapeHandling = 'EscapeNonAscii' }
$documentText = (($document | ConvertTo-Json @jsonOptions) + "`n")
$utf8 = New-Object Text.UTF8Encoding($false)
$documentBytes = $utf8.GetBytes($documentText)
$sha = [Security.Cryptography.SHA256]::Create()
try { $documentHash = [BitConverter]::ToString($sha.ComputeHash($documentBytes)).Replace('-', '').ToLowerInvariant() }
finally { $sha.Dispose() }

$manifest = [ordered]@{
    format = 'gridatlas-package'
    formatVersion = 1
    exportedAt = '2026-08-11T00:00:00.000Z'
    document = [ordered]@{
        path = 'document.json'
        mediaType = 'application/vnd.gridatlas.place-list+json'
        byteLength = $documentBytes.Length
        sha256 = $documentHash
    }
    resources = @()
    requiredExtensions = @()
    extensions = [ordered]@{}
}
$manifestText = (($manifest | ConvertTo-Json @jsonOptions) + "`n")
$manifestBytes = $utf8.GetBytes($manifestText)

$outputFull = [IO.Path]::GetFullPath($OutputPath)
$tempDir = Join-Path ([IO.Path]::GetTempPath()) ('gridatlas-500-nested-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
try {
    $manifestPath = Join-Path $tempDir 'manifest.json'
    $documentPath = Join-Path $tempDir 'document.json'
    [IO.File]::WriteAllBytes($manifestPath, $manifestBytes)
    [IO.File]::WriteAllBytes($documentPath, $documentBytes)
    $outputParent = Split-Path -Parent $outputFull
    New-Item -ItemType Directory -Force -Path $outputParent | Out-Null
    if (Test-Path -LiteralPath $outputFull) { Remove-Item -LiteralPath $outputFull -Force }
    Compress-Archive -LiteralPath @($manifestPath, $documentPath) -DestinationPath $outputFull -CompressionLevel Optimal
}
finally {
    if (Test-Path -LiteralPath $tempDir) { Remove-Item -LiteralPath $tempDir -Recurse -Force }
}

Write-Host "作成: $outputFull"
Write-Host "地点数: $($places.Count)"
Write-Host "document.json: $($documentBytes.Length) bytes / sha256=$documentHash"
