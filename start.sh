#!/usr/bin/env bash
# Convenience script to start all components.
# Edit LLAMA_DIR and MODEL to match your setup.

set -e

LLAMA_DIR="${LLAMA_DIR:-$(pwd)/llama.cpp}"
MODEL="${MODEL:-$(pwd)/models/deepseek-coder-6.7b-instruct.Q4_K_M.gguf}"
THREADS="${THREADS:-$(nproc --ignore=2 || echo 4)}"   # physical cores minus 2

echo "==> Starting llama.cpp server..."
"$LLAMA_DIR/build/bin/llama-server" \
  -m "$MODEL" \
  -c 4096 \
  --threads "$THREADS" \
  --parallel 4 \
  --port 8080 \
  --host 127.0.0.1 \
  --batch-size 512 \
  --mlock \
  --no-mmap \
  --log-disable &
LLAMA_PID=$!

# Wait for llama.cpp to be ready
echo "==> Waiting for llama.cpp to load model..."
until curl -sf http://127.0.0.1:8080/health > /dev/null 2>&1; do
  sleep 1
done
echo "==> llama.cpp ready."

echo "==> Starting middleware..."
cd "$(dirname "$0")/middleware"
npm run dev &
MW_PID=$!

echo ""
echo "==> Local Copilot running!"
echo "    llama.cpp: http://127.0.0.1:8080"
echo "    Middleware: http://127.0.0.1:3000"
echo "    Press Ctrl+C to stop all components."

trap "kill $LLAMA_PID $MW_PID 2>/dev/null; exit" INT TERM
wait
