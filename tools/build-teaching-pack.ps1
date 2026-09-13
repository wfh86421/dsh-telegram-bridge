# build-teaching-pack.ps1 — 把 README 與 docs/*.md 合併成單檔教學包（給 NotebookLM 上傳／離線閱讀）
# 用法：powershell -NoProfile -ExecutionPolicy Bypass -File tools\build-teaching-pack.ps1
$ErrorActionPreference = "Continue"
$root = Split-Path $PSScriptRoot -Parent
$files = @((Join-Path $root "README.md")) + @(Get-ChildItem (Join-Path $root "docs") -Filter *.md | Sort-Object Name | ForEach-Object { $_.FullName })
$outDir = Join-Path $root "dist"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }
$out = Join-Path $outDir "DSH-Telegram-Bridge-Teaching-Pack.md"
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("# DSH Telegram 橋接器 · 完整教學包（單檔版）")
[void]$sb.AppendLine()
[void]$sb.AppendLine("> **這是自動產生的合訂本**（由 tools\build-teaching-pack.ps1 合併 README 與 docs/*.md）。")
[void]$sb.AppendLine("> 原始檔在 docs/；想看單篇請直接開那一份。此檔用途：① 一次上傳到 NotebookLM ② 離線閱讀／分享。")
[void]$sb.AppendLine("> 產生時間：$(Get-Date -Format 'yyyy-MM-dd HH:mm')｜來源檔：$($files.Count) 份｜基準版本：@deepseek-ai/dsh 0.1.5-rc.1")
[void]$sb.AppendLine()
[void]$sb.AppendLine("---")
[void]$sb.AppendLine()
[void]$sb.AppendLine("## 目錄")
[void]$sb.AppendLine()
foreach ($f in $files) { [void]$sb.AppendLine("- " + (Split-Path $f -Leaf)) }
[void]$sb.AppendLine()
foreach ($f in $files) {
  $name = Split-Path $f -Leaf
  $txt = ([System.IO.File]::ReadAllText($f, [System.Text.UTF8Encoding]::new($false))).TrimEnd()
  [void]$sb.AppendLine(); [void]$sb.AppendLine("---"); [void]$sb.AppendLine()
  [void]$sb.AppendLine("<!-- ===== 來源檔：$name ===== -->"); [void]$sb.AppendLine()
  [void]$sb.AppendLine($txt); [void]$sb.AppendLine()
}
[System.IO.File]::WriteAllText($out, $sb.ToString(), [System.Text.UTF8Encoding]::new($false))
Write-Host ("已產生 {0}（{1} bytes，合併 {2} 份）" -f $out, (Get-Item $out).Length, $files.Count)