# notebooklm-sync.ps1 — 把這套教學文件推到 NotebookLM（給二次開發者用）
#
# 為什麼要有這支：NotebookLM 的登入會過期（`notebooklm list` 會回 Authentication expired），
# 而「建筆記本 → 逐一加來源 → 等索引完成」是一串固定步驟；寫成腳本才可重複、可驗證。
#
# 前置：① `notebooklm` CLI 已安裝（notebooklm-py）② 已 `notebooklm login`
# 用法：
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\notebooklm-sync.ps1
#   ... -Notebook "DSH Telegram 橋接器"   # 自訂筆記本名稱
#   ... -Local                            # 只做本地檢查，不呼叫 NotebookLM
#   ... -DryRun                           # 印出會執行哪些指令，但不真的跑
#
# 行為：
#   1. 檢查 notebooklm 可用性與登入狀態；未登入就明確告訴使用者要跑 `notebooklm login`
#   2. 建立筆記本（若同名已存在則沿用）
#   3. 把 docs\*.md ＋ README.md 逐一加為來源（已加過的同名來源會跳過）
#   4. 等來源索引完成（source wait，逾時只警告不中斷）
#   5. 最後印出筆記本 id 與來源清單（可貼進回報）
param(
  [string]$Notebook = "DSH Telegram 橋接器",
  [switch]$Local,
  [switch]$DryRun
)
$ErrorActionPreference = "Continue"
try { [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false) } catch {}

$root = Split-Path $PSScriptRoot -Parent
$files = @()
$files += (Join-Path $root "README.md")
$files += @(Get-ChildItem (Join-Path $root "docs") -Filter *.md -ErrorAction SilentlyContinue | Sort-Object Name | ForEach-Object { $_.FullName })
$files = @($files | Where-Object { Test-Path $_ })

Write-Host "== NotebookLM 同步 =="
Write-Host ("   套件根：{0}" -f $root)
Write-Host ("   來源檔：{0} 個" -f $files.Count)
foreach ($f in $files) { Write-Host ("     - " + (Split-Path $f -Leaf)) }

if ($Local) { Write-Host "`n[-Local] 只做本地檢查，結束。"; exit 0 }

$cli = Get-Command notebooklm -ErrorAction SilentlyContinue
if (-not $cli) { Write-Host "`n[ERROR] 找不到 notebooklm CLI。安裝：pip install notebooklm-py" -ForegroundColor Red; exit 1 }
Write-Host ("`n   CLI：{0}" -f $cli.Source)

Write-Host "`n[1/5] 檢查登入狀態…"
$status = (& notebooklm list --json 2>&1 | Out-String)
if ($status -match 'Authentication expired|Run .notebooklm login') {
  Write-Host "[ERROR] NotebookLM 登入已過期 → 請先在一般視窗執行：notebooklm login" -ForegroundColor Red
  exit 2
}
Write-Host "   OK"

Write-Host "`n[2/5] 取得／建立筆記本…"
$nbId = ""
try {
  $list = (& notebooklm list --json 2>&1 | Out-String | ConvertFrom-Json)
  $hit = @($list.notebooks | Where-Object { $_.title -eq $Notebook })
  if ($hit.Count -gt 0) { $nbId = $hit[0].id; Write-Host ("   沿用既有：{0}" -f $nbId) }
} catch { }
if (-not $nbId) {
  if ($DryRun) { Write-Host ("   [dry-run] notebooklm create `"{0}`" --json" -f $Notebook) }
  else {
    $created = (& notebooklm create $Notebook --json 2>&1 | Out-String | ConvertFrom-Json)
    $nbId = $created.id
    Write-Host ("   已建立：{0}" -f $nbId)
  }
}
if (-not $nbId -and -not $DryRun) { Write-Host "[ERROR] 拿不到筆記本 id" -ForegroundColor Red; exit 1 }

Write-Host "`n[3/5] 加入來源（同名已存在就跳過）…"
$existing = @()
try {
  if ($nbId) {
    $srcs = (& notebooklm source list --notebook $nbId --json 2>&1 | Out-String | ConvertFrom-Json)
    $existing = @($srcs.sources | ForEach-Object { $_.title })
  }
} catch { }
foreach ($f in $files) {
  $name = Split-Path $f -Leaf
  if ($existing -contains $name) { Write-Host ("   [skip] {0}（已存在）" -f $name); continue }
  if ($DryRun) { Write-Host ("   [dry-run] notebooklm source add `"{0}`" --notebook {1}" -f $f, $nbId); continue }
  $r = (& notebooklm source add $f --notebook $nbId --json 2>&1 | Out-String)
  if ($r -match '"source_id"') { Write-Host ("   [ok]   {0}" -f $name) } else { Write-Host ("   [warn] {0}：{1}" -f $name, $r.Trim().Substring(0, [math]::Min(120, $r.Trim().Length))) }
}

Write-Host "`n[4/5] 等來源索引完成（最多 5 分鐘）…"
if (-not $DryRun -and $nbId) {
  try {
    $srcs2 = (& notebooklm source list --notebook $nbId --json 2>&1 | Out-String | ConvertFrom-Json)
    foreach ($s in @($srcs2.sources)) {
      if ($s.status -eq 'ready') { continue }
      & notebooklm source wait $s.id --notebook $nbId --timeout 300 | Out-Null
    }
  } catch { Write-Host "   [warn] 等待索引時發生問題（不中斷）" }
}

Write-Host "`n[5/5] 結果"
if ($nbId) {
  $final = (& notebooklm source list --notebook $nbId --json 2>&1 | Out-String | ConvertFrom-Json)
  $ready = @($final.sources | Where-Object { $_.status -eq 'ready' }).Count
  Write-Host ("   筆記本 id：{0}" -f $nbId)
  Write-Host ("   來源：{0} 個（ready {1}）" -f @($final.sources).Count, $ready)
  Write-Host ("   網址：https://notebooklm.google.com/notebook/{0}" -f $nbId)
}
if ($DryRun) { Write-Host "`n[dry-run] 沒有真的呼叫任何寫入指令。" }
exit 0
