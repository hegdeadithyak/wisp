# Requires -Version 5.0
<#
.SYNOPSIS
    Installs Wisp and its dependencies.
    NOTE: Mark as "To be tested" based on current experimental status for Windows.
#>

$ErrorActionPreference = "Stop"

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "              Wisp Installation Script (Windows)          " -ForegroundColor Cyan
Write-Host "                    *** TO BE TESTED ***                  " -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# Function to check command existence
function Test-Command {
    param ($command)
    $found = Get-Command $command -ErrorAction SilentlyContinue
    if (-not $found) {
        Write-Error "❌ $command is required but it's not installed. Please install it and ensure it's in your PATH. Aborting."
        exit 1
    }
}

Test-Command "git"
Test-Command "cmake"
Test-Command "npm"
Test-Command "python"
Test-Command "pip"

Write-Host "✅ All prerequisites found! Starting installation..." -ForegroundColor Green
Write-Host ""

# 1. Setup - llama.cpp
Write-Host "📦 [1/4] Setting up llama.cpp..." -ForegroundColor Cyan
if (-Not (Test-Path "llama.cpp")) {
    git clone https://github.com/ggerganov/llama.cpp
}
Set-Location llama.cpp
cmake -B build -DLLAMA_NATIVE=ON
$cores = $env:NUMBER_OF_PROCESSORS
cmake --build build --config Release -j $cores
Set-Location ..
Write-Host "✅ llama.cpp built successfully!" -ForegroundColor Green
Write-Host ""

# 2. Download model
Write-Host "🧠 [2/4] Downloading DeepSeek-Coder model..." -ForegroundColor Cyan
pip install huggingface_hub
huggingface-cli download TheBloke/deepseek-coder-6.7B-instruct-GGUF deepseek-coder-6.7b-instruct.Q4_K_M.gguf --local-dir .\models
Write-Host "✅ Model downloaded successfully!" -ForegroundColor Green
Write-Host ""

# 3. Setup - Middleware
Write-Host "⚙️ [3/4] Installing Middleware dependencies..." -ForegroundColor Cyan
Set-Location middleware
npm install
npm run build
Set-Location ..
Write-Host "✅ Middleware installed successfully!" -ForegroundColor Green
Write-Host ""

# 4. Setup - VS Code Extension
Write-Host "🔌 [4/4] Installing VS Code Extension dependencies..." -ForegroundColor Cyan
Set-Location vscode-extension
npm install
npm run compile
Set-Location ..
Write-Host "✅ VS Code Extension compiled successfully!" -ForegroundColor Green
Write-Host ""

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "🎉                  Installation Complete!                 " -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "You can now start Wisp!"
Write-Host "(Please run the equivalents of start.sh or start the components manually for now)"
Write-Host ""
Write-Host "To use the extension, open the 'vscode-extension' directory in VS Code and press F5."
