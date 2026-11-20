$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$toolboxPython = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $toolboxPython)) {
    $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if (-not $pythonCommand) { throw '请先安装 Python 3.10 或更新版本，并将 Python 加入 PATH。' }
    & $pythonCommand.Source -m venv (Join-Path $PSScriptRoot '.venv')
    if ($LASTEXITCODE -ne 0) { throw '创建 Python 环境失败。' }
}
& $toolboxPython -c "import importlib.util,sys; sys.exit(0 if all(importlib.util.find_spec(n) for n in ('flask','sympy','waitress')) else 1)"
if ($LASTEXITCODE -ne 0) {
    Write-Host '首次启动，正在安装计算依赖…'
    & $toolboxPython -m pip install -r (Join-Path $PSScriptRoot 'requirements.txt')
    if ($LASTEXITCODE -ne 0) { throw '安装依赖失败，请检查网络连接。' }
}
$toolboxUrl = 'http://127.0.0.1:8765/'
try {
    $toolboxHealth = Invoke-RestMethod -Uri ($toolboxUrl + 'api/health') -TimeoutSec 2
    if ($toolboxHealth.engine -eq 'SymPy' -and $toolboxHealth.ok) {
        Start-Process $toolboxUrl
        Write-Host '工具箱已在运行，已打开网页。'
        exit 0
    }
} catch { }
# Open the browser after the service is ready. The helper window stays hidden.
$toolboxBrowserJob = Start-Job -ArgumentList $toolboxUrl -ScriptBlock {
    param($address)
    for ($attempt=0; $attempt -lt 25; $attempt++) {
        try {
            $health = Invoke-RestMethod -Uri ($address + 'api/health') -TimeoutSec 1
            if ($health.ok) { Start-Process $address; break }
        } catch { }
        Start-Sleep -Milliseconds 400
    }
}
Write-Host 'CAVEQIS · 数学工具箱'
Write-Host ('访问：' + $toolboxUrl)
Write-Host '保持此窗口开启；按 Ctrl+C 停止服务。'
try { & $toolboxPython (Join-Path $PSScriptRoot 'app.py') }
finally { Stop-Job $toolboxBrowserJob -ErrorAction SilentlyContinue; Remove-Job $toolboxBrowserJob -Force -ErrorAction SilentlyContinue }
