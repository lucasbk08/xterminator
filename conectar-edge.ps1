param([switch]$Reiniciar)
$ErrorActionPreference = "Stop"
$endpoint = "http://127.0.0.1:9222"
function Test-DebugEdge {
    try {
        $info = Invoke-RestMethod "$endpoint/json/version" -TimeoutSec 2
        return [bool]$info.webSocketDebuggerUrl
    } catch { return $false }
}
if (!(Test-DebugEdge)) {
    $processos = Get-Process msedge -ErrorAction SilentlyContinue
    if ($processos -and !$Reiniciar) {
        throw "Feche o Edge ou execute com -Reiniciar depois de salvar seu trabalho."
    }
    if ($processos) {
        $processos | Where-Object { $_.MainWindowHandle -ne 0 } | ForEach-Object { [void]$_.CloseMainWindow() }
        Start-Sleep -Seconds 3
        # Encerra apenas os processos de fundo que mantiveram o Edge aberto.
        if (Get-Process msedge -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }) {
            throw "Uma janela ainda esta aberta. Feche-a para continuar."
        }
        Get-Process msedge -ErrorAction SilentlyContinue | Stop-Process
    }
    $edge = Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe"
    Start-Process $edge -ArgumentList '--remote-debugging-port=9222', '--remote-debugging-address=127.0.0.1', '--profile-directory=Default', 'https://x.com/home'
    for ($i = 0; $i -lt 20; $i++) {
        if (Test-DebugEdge) { break }
        Start-Sleep -Seconds 1
    }
    if (!(Test-DebugEdge)) { throw "O Edge nao disponibilizou a conexao de automacao neste perfil." }
}
$env:XTERMINATOR_CDP_URL = $endpoint
try { & (Join-Path $PSScriptRoot "rodar-edge.ps1") }
finally { Remove-Item Env:XTERMINATOR_CDP_URL -ErrorAction SilentlyContinue }
