#!/bin/bash
# sync-agents.sh — propaga os .pi/agents/*.md para outras CLIs
# Mantém Pi como source of truth; Claude Code e Gemini CLI ficam em sync.
set -e
cd "$(dirname "$0")/.."

SOURCE="$(pwd)/.pi/agents"
[ -d "$SOURCE" ] || { echo "fonte não existe: $SOURCE"; exit 1; }

# Claude Code — agents globais sob namespace medlegal/
CLAUDE_TARGET="$HOME/.claude/agents/medlegal"
mkdir -p "$CLAUDE_TARGET"
cp -v "$SOURCE"/*.md "$CLAUDE_TARGET/"

# Gemini CLI — agents globais sob namespace medlegal/
GEMINI_TARGET="$HOME/.gemini/agents/medlegal"
mkdir -p "$GEMINI_TARGET"
cp -v "$SOURCE"/*.md "$GEMINI_TARGET/"

# Prompts master também
mkdir -p "$CLAUDE_TARGET/_prompts" "$GEMINI_TARGET/_prompts"
cp -v "$(pwd)/.pi/prompts/prime.md" "$CLAUDE_TARGET/_prompts/" 2>/dev/null || true
cp -v "$(pwd)/.pi/prompts/prime.md" "$GEMINI_TARGET/_prompts/" 2>/dev/null || true

echo ""
echo "✓ Sync completo"
echo "  Pi:          $SOURCE  (source of truth)"
echo "  Claude Code: $CLAUDE_TARGET"
echo "  Gemini CLI:  $GEMINI_TARGET"
echo ""
echo "Para invocar:"
echo "  Pi:          'pi' neste diretório, then ativa subagent"
echo "  Claude Code: 'claude' menciona @franca / @hercules / etc."
echo "  Gemini CLI:  'gemini --agent medlegal/franca \"...\"'"
