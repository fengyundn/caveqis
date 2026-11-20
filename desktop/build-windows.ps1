param([string]$PythonExe, [switch]$UseInstalledDependencies)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
Push-Location -LiteralPath $PSScriptRoot
try {
    $build = Join-Path $PSScriptRoot '.build'
    $venv = Join-Path $build 'venv'
    $python = Join-Path $venv 'Scripts\python.exe'
    $repo = Split-Path -Parent $PSScriptRoot
    $static = Join-Path $repo 'static'
    $icon = Join-Path $build 'caveqis.ico'
    if (-not $UseInstalledDependencies) {
        if (-not (Test-Path -LiteralPath $python)) {
            if ($PythonExe) {
                & $PythonExe -m venv $venv
            } else {
                py -3.12 -m venv $venv
            }
        }
        & $python -m pip install -r ../requirements.txt -r requirements-build.txt
        npm.cmd ci --no-audit --no-fund
    }

    & $python -c "import platform,sys; sys.exit(0 if platform.machine().upper() == 'AMD64' else '64-bit x86 Python is required')"
    & $python prepare_resources.py
    $pyinstallerArgs = @(
        '--noconfirm', '--onedir', '--name', 'caveqis-engine',
        '--paths', $repo, '--add-data', "${static}:static", '--icon', $icon,
        '--specpath', '.build', '--workpath', '.build/pyinstaller', '--distpath', '.build/engine',
        'engine_entry.py'
    )
    & $python -m PyInstaller @pyinstallerArgs
    npm.cmd run build:win
} finally {
    Pop-Location
}
