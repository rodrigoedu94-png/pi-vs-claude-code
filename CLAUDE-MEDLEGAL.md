# MedLegal Orchestrator

Sistema de agentes para estudo de Medicina Legal. **Pi é o harness/orquestrador**; especialistas são subagents; conteúdo denso vem dos livros indexados; agents são portáveis para Claude Code e Gemini CLI.

## Arquitetura em 6 pilares

1. **Question-Driven** — toda nota responde a questões reais em `03 - Questoes/`
2. **Books as Memory** — `06 - Fontes` indexada via Smart Connections é a knowledge base
3. **Author-Agents** — `franca`, `hercules`, `palermo` citam só suas fontes
4. **CoALA Memory** — procedural (prompts) + semantic (Smart Connections) + episodic (Hermes) + working (Pi context)
5. **Pi como orquestrador** — delega para Claude Code / Gemini CLI quando faz sentido
6. **Cross-CLI** — agents sincronizados via `scripts/sync-agents.sh`

## Estrutura

```
pi/
├── .pi/
│   ├── settings.json          # 4 packages (mcp-adapter, subagents, hermes, obsidian)
│   ├── obsidian.json          # vault path travado
│   ├── prompts/prime.md       # orquestrador master
│   ├── agents/
│   │   ├── franca.md          # autor — clássico, didático
│   │   ├── hercules.md        # autor — pericial, diagnóstico
│   │   ├── palermo.md         # autor — concursos, banca
│   │   ├── forensic-expert.md # orquestra os 3 autores
│   │   ├── question-pattern-analyst.md
│   │   ├── note-architect.md
│   │   ├── summary-writer.md
│   │   ├── verifier.md        # gate anti-alucinação
│   │   └── flashcard-generator.md
│   └── hermes/                # memória estruturada (criada pelo package)
├── .mcp.json                  # obsidian + sequential-thinking + filesystem
├── scripts/
│   ├── scan_questions.py      # perfila banca por tema
│   ├── sc_retrieve.py         # busca em embeddings do Smart Connections
│   └── sync-agents.sh         # propaga agents para Claude Code e Gemini CLI
├── run.sh                     # launcher (usa key-router do Pi-Harness)
└── CLAUDE.md                  # este arquivo
```

## Como rodar

```bash
# 1. Boot do Pi (instala 4 packages na primeira vez)
bash run.sh

# 2. Sincroniza agents para outras CLIs (uma vez ou após editar agents)
bash scripts/sync-agents.sh

# 3. Perfilar banca de um tema
python scripts/scan_questions.py --tema "Asfixia" --banca CESPE

# 4. Buscar trechos densos em fontes (modo fallback keyword se SC não pronto)
python scripts/sc_retrieve.py "lesão por arma branca" --autor franca --top 5
```

## Plugins Obsidian que o sistema confia

Já instalados no vault — Pi assume que existem:

- **Smart Connections** — embeddings de `06 - Fontes` (semantic memory)
- **Spaced Repetition** — consome `04 - Flashcards/*` gerados pelo agent
- **Templater + QuickAdd** — automação de notas
- **Dataview** — queries em frontmatter
- **Tasks** — pendências
- **Obsidian Git** — snapshot antes de edições em lote
- **Local REST API** — vault como API (para integração futura com inbox_worker do Agente Gemini)
- **Linter** — higiene de markdown
- **Omnisearch** — busca textual rica

## Integração com outros agentes do workspace

- **Agente Medicina Legal** (`../Agente Medicina Legal/`) — sistema Gemini production com 7 agentes, verifier, budget tracker, RAG nativo, inbox worker. O Pi pode delegar tasks pesadas via `incoming/*.md` que o inbox_worker já consome.
- **Claude Code** — agents disponíveis sob `~/.claude/agents/medlegal/*` após sync
- **Gemini CLI** — agents disponíveis sob `~/.gemini/agents/medlegal/*` após sync

## Princípios de operação

1. **Verifier sempre** — nenhuma nota é gravada sem passar pelo gate anti-alucinação
2. **Citação obrigatória** — wikilink para fonte indexada em todo slot preenchido
3. **Granularidade atômica** — uma ideia por nota; resumos densos por tema separados
4. **Divergência registrada** — autores divergem? `[DIVERGÊNCIA AUTORAL]` no corpo
5. **Gap não é falha** — slot sem cobertura é declarado `[CARECE DE FONTE]`, nunca preenchido por invenção
6. **Pi é harness** — guardrails (verifier, budget, hermes) vivem aqui; inteligência domínio vive nos agents

## Gaps prioritários do vault (detectados na análise)

1. **Flashcards** — só 10 cards para ~7000 questões. Pipeline `flashcard-generator` resolve.
2. **Simulados** — só 8. Agent gerador a desenhar (next).
3. **Sobreposição de IA em plugins** — 6 plugins Smart* + Copilot + RealClaudian + Agent Client. Decidir stack canônico.
4. **Perfis de banca** — gerar para os top 20 assuntos via `scan_questions.py --all`.

## Atalhos para o orquestrador

Quando o usuário pede algo, o orquestrador identifica o tipo:

| Pedido | Pipeline |
|---|---|
| "cria nota sobre X" | pattern-analyst → forensic-expert (autores) → note-architect → verifier → grava |
| "revisa o tema Y" | summary-writer (agrega notas do tema) |
| "gera flashcards de Z" | flashcard-generator (sobre nota ou tema) |
| "o que cai sobre W" | question-pattern-analyst (consulta `03 - Questoes/`) |
| "como França trata X" | despacha direto pro agent `franca` |
| "compara França e Hércules em X" | forensic-expert orquestra os dois |
| "audita vault" | varredura estrutural + relatório em `09 - Sistema/` |
