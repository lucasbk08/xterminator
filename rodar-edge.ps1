$ErrorActionPreference = "Stop"
$envDir = Join-Path $env:LOCALAPPDATA "XTerminator\venv"
$python = Join-Path $envDir "Scripts\python.exe"

if (!(Test-Path $python)) {
    py -3.12 -m venv $envDir
    if ($LASTEXITCODE -ne 0) { throw "Falha ao criar a venv do Windows." }
}

& $python -c "import importlib.util, sys; sys.exit(0 if importlib.util.find_spec('playwright') else 1)"
if ($LASTEXITCODE -ne 0) {
    & $python -m pip install playwright
    if ($LASTEXITCODE -ne 0) { throw "Falha ao instalar o Playwright." }
}

& $python (Join-Path $PSScriptRoot "xterminator.py")
exit $LASTEXITCODE
