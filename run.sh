#!/bin/bash
# MedLegal Pi launcher — limpa, especializada no cofre
set -e
cd "$(dirname "$0")"

MODEL="${PI_MODEL:-gemini-3.1-flash-lite}"

# Router local tem prioridade; fallback para auxiliar se não existir
LOCAL_ROUTER="$(dirname "$0")/scripts/key-router.mjs"
AUX_ROUTER="/c/Users/rodri/Projetos de IA/Pi/scripts/key-router.mjs"

if [ -f "$LOCAL_ROUTER" ]; then
    ROUTER="$LOCAL_ROUTER"
elif [ -f "$AUX_ROUTER" ]; then
    ROUTER="$AUX_ROUTER"
    echo "⚠ usando key-router do auxiliar (copie scripts/ para remover dependência)"
fi

if [ -n "$ROUTER" ]; then
    KEY=$(node "$ROUTER" "$MODEL" 2>/tmp/medlegal-router.log)
    [ -s /tmp/medlegal-router.log ] && cat /tmp/medlegal-router.log
    if [ -z "$KEY" ]; then echo "key-router falhou — defina GEMINI_API_KEY manualmente"; exit 2; fi
    export GEMINI_API_KEY="$KEY" GOOGLE_API_KEY="$KEY" GOOGLE_GENAI_API_KEY="$KEY"
elif [ -z "$GEMINI_API_KEY" ]; then
    echo "Defina GEMINI_API_KEY no env (router não encontrado)"
    exit 2
fi

echo "→ MedLegal Pi (model: $MODEL)"
exec pi --provider google --model "$MODEL" "$@"
