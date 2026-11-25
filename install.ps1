# Install the desktop app from the latest stable GitHub release.
$ErrorActionPreference = 'Stop'
$repo = '4mGLn/todoffice'
$cpu = $env:PROCESSOR_ARCHITEW6432
if (-not $cpu) { $cpu = $env:PROCESSOR_ARCHITECTURE }
switch ($cpu) {
    'AMD64' { $suffix = '.exe' }
    'ARM64' { $suffix = '-arm64.exe' }
    default { throw "Unsupported Windows architecture: $cpu" }
}

try {
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest"
} catch {
    if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 404) {
        throw "No stable TodOffice release is available: https://github.com/$repo/releases"
    }
    throw
}
$tag = $release.tag_name
if ($tag -cnotmatch '^v?([0-9][0-9A-Za-z.+-]*)$') { throw "Unexpected release tag: $tag" }
$version = $Matches[1]
$name = "TodOffice-Setup-$version$suffix"
$asset = $release.assets | Where-Object { $_.name -ceq $name }
if (-not $asset) { throw "$name is unavailable in release $tag." }

$work = Join-Path ([IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $work | Out-Null
try {
    $installer = Join-Path $work $name
    Invoke-WebRequest -UseBasicParsing -Uri $asset.browser_download_url -OutFile $installer
    if ((Get-Item $installer).Length -ne $asset.size) { throw 'Incomplete installer download.' }
    if ($asset.digest -like 'sha256:*') {
        $hash = (Get-FileHash -Algorithm SHA256 -Path $installer).Hash
        if ($hash -ne $asset.digest.Substring(7)) { throw 'Installer checksum mismatch.' }
    }
    $result = Start-Process -FilePath $installer -ArgumentList '/S' -Wait -PassThru
    if ($result.ExitCode -ne 0) { throw "Installer exited with code $($result.ExitCode)." }
    Write-Output "Installed TodOffice $version"
} finally {
    Remove-Item -LiteralPath $work -Recurse -Force
}
