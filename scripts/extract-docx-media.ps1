$downloads = Join-Path $env:USERPROFILE 'Downloads'
$docx = Get-ChildItem -LiteralPath $downloads -Filter '*.docx' |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
if (-not $docx) { Write-Error 'No docx in Downloads'; exit 1 }
Write-Host "Using:" $docx.FullName
$zip = Join-Path $env:TEMP 'ilog.zip'
$out = Join-Path $env:TEMP 'ilog_out'
Copy-Item -LiteralPath $docx.FullName -Destination $zip -Force
if (Test-Path $out) { Remove-Item -Recurse -Force $out }
Expand-Archive -LiteralPath $zip -DestinationPath $out -Force
$media = Join-Path $out 'word\media'
if (-not (Test-Path $media)) { Write-Error 'No word/media folder'; exit 1 }
Get-ChildItem -LiteralPath $media | Select-Object Name, Length
