#!/usr/bin/env bash
# Convenience script to install Wisp and its dependencies.

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "                  Wisp Installation Script                 "
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check prerequisites
command -v git >/dev/null 2>&1 || { echo >&2 "❌ git is required but it's not installed. Aborting."; exit 1; }
command -v cmake >/dev/null 2>&1 || { echo >&2 "❌ cmake is required but it's not installed. Aborting."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo >&2 "❌ npm is required but it's not installed. Aborting."; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo >&2 "❌ python3 is required but it's not installed. Aborting."; exit 1; }
command -v pip3 >/dev/null 2>&1 || { echo >&2 "❌ pip3 is required but it's not installed. Aborting."; exit 1; }

echo "✅ All prerequisites found! Starting installation..."
echo ""

# 1. Setup - llama.cpp
echo "📦 [1/4] Setting up llama.cpp..."
if [ ! -d "llama.cpp" ]; then
  git clone https://github.com/ggerganov/llama.cpp
fi
cd llama.cpp
cmake -B build -DLLAMA_NATIVE=ON
cmake --build build --config Release -j$(nproc)
cd ..
echo "✅ llama.cpp built successfully!"
echo ""

# 2. Download model
echo "🧠 [2/4] Downloading DeepSeek-Coder model..."
pip3 install huggingface_hub
~/.local/bin/huggingface-cli download \
  TheBloke/deepseek-coder-6.7B-instruct-GGUF \
  deepseek-coder-6.7b-instruct.Q4_K_M.gguf \
  --local-dir ./models
echo "✅ Model downloaded successfully!"
echo ""

# 3. Setup - Middleware
echo "⚙️ [3/4] Installing Middleware dependencies..."
cd middleware
npm install
npm run build || true # Just in case it's dev-only setup
cd ..
echo "✅ Middleware installed successfully!"
echo ""

# 4. Setup - VS Code Extension
echo "🔌 [4/4] Installing VS Code Extension dependencies..."
cd vscode-extension
npm install
npm run compile
cd ..
echo "✅ VS Code Extension compiled successfully!"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉                  Installation Complete!                 "
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "You can now start Wisp by running:"
echo "  ./start.sh"
echo ""
echo "To use the extension, open the 'vscode-extension' folder in VS Code and press F5,"
echo "or package it into a VSIX and install it directly."
