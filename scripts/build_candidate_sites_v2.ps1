[CmdletBinding()]
param(
    [string]$OutputDir = (Join-Path (Get-Location) 'docs\data\candidate-sites-200-v2')
)

$ErrorActionPreference = 'Stop'
$bunkaBase = 'https://kunishitei.bunka.go.jp'
$bunkaIndex = "$bunkaBase/bsys/index"
$rawDir = Join-Path $OutputDir 'raw'
New-Item -ItemType Directory -Force -Path $rawDir | Out-Null

function Get-InputToken([string]$Html) {
    $match = [regex]::Match($Html, 'name="_csrfToken"[^>]+value="([^"]+)"')
    if (-not $match.Success) { throw '文化庁DBのCSRFトークンを取得できませんでした。' }
    return $match.Groups[1].Value
}

function Get-BunkaCsv {
    param(
        [hashtable]$Query,
        [string]$RawName
    )

    $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    $topPage = Invoke-WebRequest -Uri $bunkaIndex -WebSession $session -UseBasicParsing
    $queryBody = @{} + $Query
    $queryBody['_method'] = 'POST'
    $queryBody['_csrfToken'] = Get-InputToken $topPage.Content
    $result = Invoke-WebRequest -Uri "$bunkaBase/bsys/searchlist" -Method Post -Body $queryBody -WebSession $session -UseBasicParsing
    $csvTokenMatch = [regex]::Match($result.Content, 'action="/utile/csv-list".{0,1000}?name="_csrfToken"[^>]+value="([^"]+)"')
    if (-not $csvTokenMatch.Success) { throw "CSV出力フォームを取得できませんでした: $RawName" }

    $csvBody = @{
        '_method' = 'POST'
        '_csrfToken' = $csvTokenMatch.Groups[1].Value
        'screen_id' = 'index'
        'page_no' = '1'
    }
    foreach ($key in $Query.Keys) { $csvBody[$key] = $Query[$key] }

    $csvResponse = Invoke-WebRequest -Uri "$bunkaBase/utile/csv-list" -Method Post -Body $csvBody -WebSession $session -UseBasicParsing
    $bytes = $csvResponse.RawContentStream.ToArray()
    $csvText = [Text.Encoding]::UTF8.GetString($bytes).TrimStart([char]0xFEFF)
    if ($csvText.Length -lt 100 -or $csvText -notmatch '名称') { throw "CSVデータが空、または想定外です: $RawName" }
    $rawPath = Join-Path $rawDir "$RawName.csv"
    [IO.File]::WriteAllText($rawPath, $csvText, (New-Object Text.UTF8Encoding($false)))
    return @{
        Name = $RawName
        Path = $rawPath
        Rows = @($csvText | ConvertFrom-Csv)
    }
}

$queries = @(
    @{ Name = '102-shrine'; Query = @{ screen_id='index'; page_no='1'; register_sub_id='102'; kind1_102='近世以前／神社'; sortTarget='area'; sortType='asc' } },
    @{ Name = '102-temple'; Query = @{ screen_id='index'; page_no='1'; register_sub_id='102'; kind1_102='近世以前／寺院'; sortTarget='area'; sortType='asc' } },
    @{ Name = '102-castle'; Query = @{ screen_id='index'; page_no='1'; register_sub_id='102'; kind1_102='近世以前／城郭'; sortTarget='area'; sortType='asc' } },
    @{ Name = '401-special-historic'; Query = @{ screen_id='index'; page_no='1'; register_sub_id='401'; 'entry_kind1_401[3]'='特別史跡'; sortTarget='area'; sortType='asc' } },
    @{ Name = '401-special-natural'; Query = @{ screen_id='index'; page_no='1'; register_sub_id='401'; 'entry_kind1_401[5]'='特別天然記念物'; sortTarget='area'; sortType='asc' } },
    @{ Name = '901-world-heritage'; Query = @{ screen_id='index'; page_no='1'; register_sub_id='901'; sortTarget='area'; sortType='asc' } }
)

$allRows = @()
foreach ($item in $queries) {
    Write-Host "取得中: $($item.Name)"
    $result = Get-BunkaCsv -Query $item.Query -RawName $item.Name
    Write-Host "  $(@($result.Rows).Count) 行"
    foreach ($row in $result.Rows) {
        if ([string]::IsNullOrWhiteSpace([string]$row.'緯度') -or [string]::IsNullOrWhiteSpace([string]$row.'経度')) { continue }
        $row | Add-Member -NotePropertyName source_query -NotePropertyValue $item.Name -Force
        $allRows += $row
    }
}

$allRows | Export-Csv -NoTypeInformation -Encoding utf8 (Join-Path $OutputDir 'raw-combined.csv')
Write-Host "取得完了: $($allRows.Count) 行"
