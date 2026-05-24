set dotenv-load := true
set windows-shell := ["C:/Program Files/Git/bin/bash.exe", "-c"]

default:
    @just --list

# prime

# Launch Claude Code and run /prime
primecc:
    claude --dangerously-skip-permissions --model "opus[1m]" "/prime"

# Launch Pi and run /prime
primepi:
    pi "/prime"

# g1

# 1. default pi
pi:
    pi

# 2. Pure focus pi: strip footer and status line entirely
ext-pure-focus:
    pi -e extensions/pure-focus.ts

# 3. Minimal pi: model name + 10-block context meter
ext-minimal:
    pi -e extensions/minimal.ts -e extensions/theme-cycler.ts

# 4. Cross-agent pi: load commands from .claude/, .gemini/, .codex/ dirs
ext-cross-agent:
    pi -e extensions/cross-agent.ts -e extensions/minimal.ts

# 5. Purpose gate pi: declare intent before working, persistent widget, focus the system prompt on the ONE PURPOSE for this agent
ext-purpose-gate:
    pi -e extensions/purpose-gate.ts -e extensions/minimal.ts

# 6. Customized footer pi: Tool counter, model, branch, cwd, cost, etc.
ext-tool-counter:
    pi -e extensions/tool-counter.ts

# 7. Tool counter widget: tool call counts in a below-editor widget
ext-tool-counter-widget:
    pi -e extensions/tool-counter-widget.ts -e extensions/minimal.ts

# 8. Subagent widget: /sub <task> with live streaming progress
ext-subagent-widget:
    pi -e extensions/subagent-widget.ts -e extensions/pure-focus.ts -e extensions/theme-cycler.ts

# 9. TillDone: task-driven discipline — define tasks before working
ext-tilldone:
    pi -e extensions/tilldone.ts -e extensions/theme-cycler.ts

#g2

# 10. Agent team: dispatcher orchestrator with team select and grid dashboard
ext-agent-team:
    pi -e extensions/agent-team.ts -e extensions/theme-cycler.ts

# 11. System select: /system to pick an agent persona as system prompt
ext-system-select:
    pi -e extensions/system-select.ts -e extensions/minimal.ts -e extensions/theme-cycler.ts

# 12. Launch with Damage-Control safety auditing
ext-damage-control:
    pi -e extensions/damage-control.ts -e extensions/minimal.ts -e extensions/theme-cycler.ts

# 12b. Damage-Control (continue): same rules, but blocked turns keep running with actionable feedback
ext-damage-control-continue:
    pi -e extensions/damage-control-continue.ts -e extensions/minimal.ts -e extensions/theme-cycler.ts

# 13. Agent chain: sequential pipeline orchestrator
ext-agent-chain:
    pi -e extensions/agent-chain.ts -e extensions/theme-cycler.ts

#g3

# 14. Pi Pi: meta-agent that builds Pi agents with parallel expert research
ext-pi-pi:
    pi -e extensions/pi-pi.ts -e extensions/theme-cycler.ts

# 15. Session Replay: scrollable timeline overlay of session history (legit)
ext-session-replay:
    pi -e extensions/session-replay.ts -e extensions/minimal.ts

# 16. Theme cycler: Ctrl+X forward, Ctrl+Q backward, /theme picker
ext-theme-cycler:
    pi -e extensions/theme-cycler.ts -e extensions/minimal.ts

# utils

# Open pi with one or more stacked extensions in a new terminal: just open minimal tool-counter
open +exts:
    #!/usr/bin/env bash
    args=""
    for ext in {{exts}}; do
        args="$args -e extensions/$ext.ts"
    done
    cmd="cd '{{justfile_directory()}}' && pi$args"
    escaped="${cmd//\\/\\\\}"
    escaped="${escaped//\"/\\\"}"
    osascript -e "tell application \"Terminal\" to do script \"$escaped\""

# Open every extension in its own terminal window
all:
    just open pi
    just open pure-focus 
    just open minimal theme-cycler
    just open cross-agent minimal
    just open purpose-gate minimal
    just open tool-counter
    just open tool-counter-widget minimal
    just open subagent-widget pure-focus theme-cycler
    just open tilldone theme-cycler
    just open agent-team theme-cycler
    just open system-select minimal theme-cycler
    just open damage-control minimal theme-cycler
    just open agent-chain theme-cycler
    just open pi-pi theme-cycler

# ------------------------ coms + coms-net (HTTP/SSE hub) ------------------------

# Coms: peer-to-peer, same machine messaging between Pi agents
# Pass any pi/extension flags through, e.g.: just ext-coms --name dev --color "#72F1B8"
local-coms *args:
    pi -e extensions/coms.ts -e extensions/minimal.ts -e extensions/theme-cycler.ts {{args}}

# Start a local coms-net server (binds 127.0.0.1, OS-claimed port)
# Auto-kills any stale process holding the pinned port first.
coms-net-server:
    -lsof -ti :${PI_COMS_NET_PORT:-52965} | xargs -r kill -TERM 2>/dev/null
    bun scripts/coms-net-server.ts

# Start a LAN-visible coms-net server (binds 0.0.0.0, requires PI_COMS_NET_AUTH_TOKEN)
# Auto-kills any stale process holding the pinned port first.
coms-net-server-lan:
    -lsof -ti :${PI_COMS_NET_PORT:-52965} | xargs -r kill -TERM 2>/dev/null
    PI_COMS_NET_HOST=0.0.0.0 bun scripts/coms-net-server.ts

# Pi with networked coms client (auto-discovers local server.json)
# Pass any flags through, e.g.: just ext-coms-net --name dev --server-url http://… --auth-token …
coms *args:
    pi -e extensions/coms-net.ts -e extensions/minimal.ts -e extensions/theme-cycler.ts {{args}}

# coms-net with gpt-5.5 (extra args still pass through, e.g. --name dev)
coms1 *args:
    pi -e extensions/coms-net.ts -e extensions/minimal.ts -e extensions/theme-cycler.ts --provider openai --model gpt-5.5 {{args}}

# coms-net with claude-opus-4-7
coms2 *args:
    pi -e extensions/coms-net.ts -e extensions/minimal.ts -e extensions/theme-cycler.ts --model claude-opus-4-7 {{args}}

# coms-net with deepseek/deepseek-v4-pro
coms3 *args:
    pi -e extensions/coms-net.ts -e extensions/minimal.ts -e extensions/theme-cycler.ts --model deepseek/deepseek-v4-pro {{args}}

# coms-net with z-ai/glm-5.1
coms4 *args:
    pi -e extensions/coms-net.ts -e extensions/minimal.ts -e extensions/theme-cycler.ts --model z-ai/glm-5.1 {{args}}

# ============================================================
# MedLegal recipes (added by pi-agent-hardening migration)
# ============================================================

# Boot MedLegal Pi (minimal — sem extensions extras)
medlegal:
    bash run.sh

# MedLegal + damage-control + hooks (proteção em edits do vault)
medlegal-safe:
    bash run.sh -e extensions/damage-control.ts -e extensions/tool-counter.ts

# MedLegal foco profundo (pure-focus + tool-counter)
medlegal-zen:
    bash run.sh -e extensions/pure-focus.ts -e extensions/tool-counter.ts

# MedLegal orquestração (agent-team + agent-chain + subagent-widget)
medlegal-orch:
    bash run.sh -e extensions/agent-team.ts -e extensions/agent-chain.ts -e extensions/subagent-widget.ts -e extensions/tool-counter.ts

# Propaga agents .pi/agents/*.md para Claude Code e Gemini CLI
sync-agents:
    bash scripts/sync-agents.sh

# Perfila banca por tema (gera perfil em 09 - Sistema/perfis-banca/)
scan tema="Asfixi":
    python scripts/scan_questions.py --tema "{{tema}}" --limit 200

# Perfila banca por tema + banca específica (ex: just scan-banca Asfixi CESPE)
scan-banca tema banca:
    python scripts/scan_questions.py --tema "{{tema}}" --banca "{{banca}}" --limit 200

# Perfila TODOS assuntos com >= 10 questões (demorado, gera ~50 perfis)
scan-all:
    python scripts/scan_questions.py --all

# Busca chunks densos em 06 - Fontes (Smart Connections embeddings + fallback keyword)
retrieve query:
    python scripts/sc_retrieve.py "{{query}}" --top 5

# Busca filtrando por autor (franca, hercules, palermo)
retrieve-autor query autor:
    python scripts/sc_retrieve.py "{{query}}" --autor "{{autor}}" --top 5

# ============================================================
# Pool de chaves AI Studio (key-router local)
# ============================================================

# Status do pool (sem expor valores de chave)
pool-status:
    node scripts/key-pool-status.mjs

# Remove chaves banidas (com backup automático)
pool-prune:
    node scripts/key-pool-prune.mjs

# Marca chave: cooldown | banned | clear  (ex: just pool-mark cooldown C3)
pool-mark action key:
    node scripts/key-mark.mjs {{action}} {{key}}

# Testa roteamento para um modelo (ex: just pool-test gemini-3.1-flash-lite)
pool-test model="gemini-3.1-flash-lite":
    node scripts/key-router.mjs {{model}}

# ============================================================
# Provider switch (controla qual API o Pi usa)
# ============================================================

# Mostra provider/modelo ativos no Pi global
provider-show:
    @echo "=== Pi global (~/.pi/agent/settings.json) ==="
    @cat ~/.pi/agent/settings.json | grep -E 'defaultProvider|defaultModel'
    @echo ""
    @echo "=== Auth providers ativos ==="
    @cat ~/.pi/agent/auth.json | python -c "import sys,json; d=json.load(sys.stdin); print('\n'.join(d.keys()) if d else '(vazio)')"

# Switch para AI Studio (pool de 8 chaves, free tier)
provider-aistudio:
    @python -c "import json,os; p=os.path.expanduser('~/.pi/agent/settings.json'); d=json.load(open(p)); d['defaultProvider']='google'; d['defaultModel']='google/gemini-3.1-flash-lite'; json.dump(d, open(p,'w'), indent=2)"
    @echo "✓ Provider = google (AI Studio) | Modelo = gemini-3.1-flash-lite"

# Switch para Vertex AI (requer chave Vertex no auth.json)
provider-vertex:
    @python -c "import json,os; p=os.path.expanduser('~/.pi/agent/settings.json'); d=json.load(open(p)); d['defaultProvider']='google-vertex'; d['defaultModel']='gemini-3-pro-preview'; json.dump(d, open(p,'w'), indent=2)"
    @echo "✓ Provider = google-vertex | precisa de chave Vertex em auth.json"

# Switch para Anthropic (requer OAuth login antes)
provider-anthropic:
    @python -c "import json,os; p=os.path.expanduser('~/.pi/agent/settings.json'); d=json.load(open(p)); d['defaultProvider']='anthropic'; d['defaultModel']='claude-sonnet-4-6'; json.dump(d, open(p,'w'), indent=2)"
    @echo "✓ Provider = anthropic | rode '/login anthropic' no Pi se ainda não autenticou"
