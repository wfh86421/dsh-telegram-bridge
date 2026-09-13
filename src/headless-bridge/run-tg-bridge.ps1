<#
run-tg-bridge.ps1 — 啟動 Telegram ↔ DSH 橋接器（由 47_TG橋接器.cmd 呼叫）

為什麼要有這支包裝：.cmd 必須純 ASCII（編碼鐵律），中文訊息與路徑一律放 .ps1。
用法：
  powershell -File tools\run-tg-bridge.ps1            # 常駐（關窗即停止）
  ... -Once            只輪詢一輪（除錯）
  ... -Test "任務"      端到端測試：直接派一個任務並把結果貼回 TG
  ... -Selftest        離線自我測試（不連網、不發 TG）
  ... -Cap 10 -TimeoutMin 15   每日成本上限／單則逾時
#>
param(
  [string]$Test = "",
  [switch]$Once,
  [switch]$Selftest,
  [switch]$DryRun,
  [double]$Cap = 10,
  [double]$TimeoutMin = 15
)
$ErrorActionPreference = "Continue"
try { [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false) } catch {}
$W = "C:\Users\User\.dsh\profiles\web"
$NODE = "D:\Program Files\nodejs\node.exe"
if (-not (Test-Path $NODE)) { $NODE = "node" }
$bridge = Join-Path $W "tools\tg-bridge.mjs"
if (-not (Test-Path $bridge)) { Write-Host "[ERROR] 找不到 $bridge → 先跑 41_改完腳本一鍵驗證 或 sync-tooling-to-vault"; exit 1 }
$bargs = @($bridge)
if ($Selftest) { $bargs += @("--selftest", "--dry-run") }
elseif ($Test) { $bargs += @("--test", $Test) }
elseif ($Once) { $bargs += @("--once") }
if ($DryRun -and -not $Selftest) { $bargs += "--dry-run" }
$bargs += @("--cap", [string]$Cap, "--timeout-min", [string]$TimeoutMin)
Write-Host "== DSH Telegram 橋接器 =="
Write-Host ("   node   : " + $NODE)
Write-Host ("   bridge : " + $bridge)
Write-Host ("   上限   : " + $Cap + " CNY/日｜單則逾時 " + $TimeoutMin + " 分")
Write-Host ""
& $NODE @bargs
exit $LASTEXITCODE
