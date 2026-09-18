#!/bin/zsh
# Dev server for the desktop preview: pins the user-local Node (no Homebrew on this Mac).
cd "$(dirname "$0")/.." || exit 1
export PATH="$HOME/.local/bin:$PATH"
exec npx next dev
