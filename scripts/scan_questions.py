#!/usr/bin/env python3
"""scan_questions.py — perfila banca por tema.

Varre 03 - Questoes/Medicina Legal/, agrupa por `assunto` no frontmatter,
identifica padrões (tipos de pergunta, autores citados, vocabulário recorrente)
e grava perfil em 09 - Sistema/perfis-banca/<assunto>-<banca>.md

Uso:
    python scan_questions.py --tema "Asfixia" [--banca CESPE] [--limit 100]
    python scan_questions.py --all  # perfila todos os assuntos com >= 10 questoes
"""
from __future__ import annotations
import argparse
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

VAULT = Path("C:/Projetos de IA/Estudo de Medicina Legal IA/Estudo de Medicina Legal")
QUESTOES_DIR = VAULT / "03 - Questoes" / "Medicina Legal" / "Medicina Legal"
OUTPUT_DIR = VAULT / "09 - Sistema" / "perfis-banca"

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)

# Heurísticas de tipo de pergunta (regex sobre o enunciado)
TIPO_PATTERNS = {
    "definicao": [r"\bo que é\b", r"\bconceito\b", r"\bdefinição\b", r"\bdefini-se\b"],
    "classificacao": [r"\bclassifica", r"\btipos de\b", r"\bcategorias\b", r"\bgrupos\b"],
    "mecanismo": [r"\bcomo ocorre\b", r"\bmecanismo\b", r"\bfisiopatologia\b", r"\bprocesso de\b"],
    "sinal_diagnostico": [r"\bsinal\b", r"\bpatognomônic", r"\bdiagnóstic", r"\bachado\b"],
    "diferencial": [r"\bdiferença entre\b", r"\bdiferencial\b", r"\bdistingue\b", r"\bcontrasta\b"],
    "cronologia": [r"\bcronologia\b", r"\bapós quanto tempo\b", r"\bhoras\b.*\bmorte\b", r"\bsucessão\b"],
    "artigo_legal": [r"\bart\.?\s*\d", r"\bartigo\b.*\bCP\b", r"\bcódigo penal\b", r"\bCPP\b"],
    "caso_clinico": [r"\bsituação\b.*\bperito\b", r"\bperito\s+constatou\b", r"\bna autópsia\b"],
}

AUTORES = ["frança", "franca", "hércules", "hercules", "hygino", "palermo", "croce", "vanrell"]


def parse_frontmatter(text: str) -> dict[str, str]:
    m = FRONTMATTER_RE.match(text)
    if not m:
        return {}
    fm = {}
    for line in m.group(1).splitlines():
        if ":" in line:
            k, _, v = line.partition(":")
            fm[k.strip()] = v.strip().strip('"').strip("'")
    return fm


def classify_tipo(enunciado: str) -> list[str]:
    enun = enunciado.lower()
    tipos = []
    for tipo, patterns in TIPO_PATTERNS.items():
        if any(re.search(p, enun) for p in patterns):
            tipos.append(tipo)
    return tipos or ["outro"]


def extract_enunciado(text: str) -> str:
    m = re.search(r"## Enunciado\s*\n(.+?)(?:\n##|\Z)", text, re.DOTALL)
    return m.group(1).strip() if m else ""


def analyze_questions(filter_tema: str | None, filter_banca: str | None, limit: int) -> dict:
    by_assunto: dict[str, list[dict]] = defaultdict(list)
    for path in QUESTOES_DIR.rglob("*.md"):
        if path.name.startswith("MOC") or "Analise" in path.name:
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        fm = parse_frontmatter(text)
        assunto = fm.get("assunto", "")
        banca = fm.get("banca", "")
        if filter_tema and filter_tema.lower() not in assunto.lower():
            continue
        if filter_banca and filter_banca.lower() not in banca.lower():
            continue
        enun = extract_enunciado(text)
        by_assunto[assunto].append({
            "id": fm.get("questao_id", path.stem),
            "banca": banca,
            "ano": fm.get("ano", ""),
            "enunciado": enun,
            "tipos": classify_tipo(enun),
            "path": str(path.relative_to(VAULT)),
        })
    if limit:
        for k in by_assunto:
            by_assunto[k] = by_assunto[k][:limit]
    return by_assunto


def build_profile(assunto: str, questoes: list[dict]) -> str:
    if len(questoes) < 5:
        confianca = "BAIXA (amostra < 5)"
    elif len(questoes) < 20:
        confianca = "MÉDIA"
    else:
        confianca = "ALTA"

    tipos_count = Counter()
    for q in questoes:
        for t in q["tipos"]:
            tipos_count[t] += 1
    total = sum(tipos_count.values()) or 1
    tipos_pct = [(t, c, c * 100 // total) for t, c in tipos_count.most_common()]

    bancas = Counter(q["banca"] for q in questoes if q["banca"])
    anos = Counter(q["ano"] for q in questoes if q["ano"])

    palavras = Counter()
    for q in questoes:
        for w in re.findall(r"\b[a-zA-ZÀ-ÿ]{6,}\b", q["enunciado"].lower()):
            if w not in {"questão", "alternativa", "correta", "assinale", "acerca"}:
                palavras[w] += 1
    vocab = palavras.most_common(15)

    autores_cit = Counter()
    for q in questoes:
        for a in AUTORES:
            if a in q["enunciado"].lower():
                autores_cit[a] += 1

    md = [f"---", f"assunto: \"{assunto}\"", f"total_questoes: {len(questoes)}",
          f"confianca: {confianca}", "tipo: perfil-banca", f"gerado_em_script: scan_questions.py", "---", ""]
    md.append(f"# Perfil de Banca — {assunto}\n")
    md.append(f"> Confiança: **{confianca}** · {len(questoes)} questões analisadas\n")

    md.append("## Distribuição por tipo de pergunta")
    for t, c, p in tipos_pct:
        md.append(f"- **{t}**: {c} questões ({p}%)")
    md.append("")

    if bancas:
        md.append("## Distribuição por banca")
        for b, c in bancas.most_common():
            md.append(f"- {b}: {c}")
        md.append("")

    if anos:
        md.append("## Distribuição por ano")
        for a, c in sorted(anos.items()):
            md.append(f"- {a}: {c}")
        md.append("")

    if autores_cit:
        md.append("## Autores citados nos enunciados")
        for a, c in autores_cit.most_common():
            md.append(f"- {a}: {c} questão(ões)")
        md.append("")

    md.append("## Vocabulário recorrente (top 15)")
    for w, c in vocab:
        md.append(f"- {w} ({c}x)")
    md.append("")

    md.append("## Orientação para note-architect")
    if tipos_pct:
        top3 = [t[0] for t in tipos_pct[:3]]
        md.append(f"- **Slots prioritários**: {', '.join(top3)}")
    if any(t[0] == "artigo_legal" for t in tipos_pct[:5]):
        md.append("- Inclua slot **Marco legal** com texto literal de artigo")
    if any(t[0] == "diferencial" for t in tipos_pct[:5]):
        md.append("- Inclua slot **Diferencial** com tabela comparativa")
    md.append("")

    md.append("## Questões amostradas (primeiras 10)")
    for q in questoes[:10]:
        md.append(f"- [[{q['path']}|{q['id']}]] ({q['banca']} {q['ano']}) — {', '.join(q['tipos'])}")
    return "\n".join(md)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tema", help="filtra por assunto (substring)")
    ap.add_argument("--banca", help="filtra por banca")
    ap.add_argument("--limit", type=int, default=200, help="max questoes por assunto")
    ap.add_argument("--all", action="store_true", help="perfila todos assuntos com >= 10 questoes")
    args = ap.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    by_assunto = analyze_questions(args.tema, args.banca, args.limit)

    if not by_assunto:
        print("nenhuma questão encontrada com os filtros", file=sys.stderr)
        sys.exit(1)

    gerados = 0
    for assunto, qs in by_assunto.items():
        if args.all and len(qs) < 10:
            continue
        slug = re.sub(r"[^a-zA-Z0-9]+", "-", assunto.lower()).strip("-")[:60]
        banca_slug = (args.banca or "geral").lower()
        out = OUTPUT_DIR / f"{slug}-{banca_slug}.md"
        out.write_text(build_profile(assunto, qs), encoding="utf-8")
        print(f"✓ {out.relative_to(VAULT)} ({len(qs)} questoes)")
        gerados += 1
    print(f"\nTotal: {gerados} perfis gerados em {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
