#!/usr/bin/env python3
"""sc_retrieve.py — recupera chunks densos de 06 - Fontes usando embeddings do Smart Connections.

Reusa o índice .smart-env/ que o plugin já mantém. Não recalcula embeddings.

Uso:
    python sc_retrieve.py "asfixia mecânica" --top 5 --autor franca
    python sc_retrieve.py "lesão por arma branca" --top 10 --pasta "06 - Fontes"
"""
from __future__ import annotations
import argparse
import json
import re
import sys
from pathlib import Path

VAULT = Path("C:/Projetos de IA/Estudo de Medicina Legal IA/Estudo de Medicina Legal")
SC_DIR = VAULT / ".smart-env"


def list_embedding_files() -> list[Path]:
    """Smart Connections grava embeddings em .smart-env/multi/*.ajson e similares."""
    candidates: list[Path] = []
    if not SC_DIR.exists():
        return candidates
    for sub in ("multi", "main"):
        d = SC_DIR / sub
        if d.exists():
            candidates.extend(d.rglob("*.ajson"))
            candidates.extend(d.rglob("*.json"))
    return candidates


def keyword_score(text: str, query: str) -> float:
    """Fallback simples por contagem de termos quando embeddings não disponíveis."""
    if not text:
        return 0.0
    text_l = text.lower()
    terms = [t for t in re.findall(r"\w+", query.lower()) if len(t) >= 3]
    if not terms:
        return 0.0
    hits = sum(text_l.count(t) for t in terms)
    return hits / max(len(text_l.split()), 1)


def retrieve_keyword(query: str, top: int, pasta: str | None, autor: str | None) -> list[dict]:
    """Modo fallback: grep + score por densidade de termos."""
    pasta_path = VAULT / (pasta or "06 - Fontes")
    if not pasta_path.exists():
        print(f"pasta não existe: {pasta_path}", file=sys.stderr)
        return []
    results = []
    for path in pasta_path.rglob("*.md"):
        if autor:
            if autor.lower() not in path.name.lower() and autor.lower() not in str(path).lower():
                if autor.lower() not in path.read_text(encoding="utf-8", errors="replace").lower()[:2000]:
                    continue
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        score = keyword_score(text, query)
        if score > 0:
            snippet = text[:500].replace("\n", " ")
            results.append({
                "path": str(path.relative_to(VAULT)),
                "score": score,
                "snippet": snippet,
            })
    results.sort(key=lambda r: r["score"], reverse=True)
    return results[:top]


def retrieve_sc(query: str, top: int, pasta: str | None, autor: str | None) -> list[dict]:
    """Modo principal: usa embeddings do Smart Connections (quando disponíveis).

    Nota: Smart Connections usa estrutura própria; sem cliente oficial Python, lemos
    os arquivos .ajson como JSON-lines e fazemos busca simples por overlap de chunks
    indexados que mencionem o tema. Para retrieval vetorial real, seria necessário
    Node/JS rodando o SDK do plugin — fora de escopo aqui.

    Por ora, retornamos lista vazia quando o índice não é interpretável; caller cai pra
    retrieve_keyword.
    """
    files = list_embedding_files()
    if not files:
        return []
    matches = []
    query_terms = set(t.lower() for t in re.findall(r"\w+", query) if len(t) >= 4)
    for f in files:
        try:
            content = f.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        text_lower = content.lower()
        if not any(t in text_lower for t in query_terms):
            continue
        # Extrai paths citados no índice
        for path_match in re.finditer(r'"key":\s*"([^"]+\.md)"', content):
            p = path_match.group(1)
            if pasta and pasta not in p:
                continue
            full = VAULT / p
            if full.exists():
                try:
                    note_text = full.read_text(encoding="utf-8", errors="replace")
                except Exception:
                    continue
                if autor and autor.lower() not in p.lower() and autor.lower() not in note_text[:2000].lower():
                    continue
                score = keyword_score(note_text, query)
                if score > 0:
                    matches.append({
                        "path": p,
                        "score": score,
                        "snippet": note_text[:500].replace("\n", " "),
                    })
    matches.sort(key=lambda m: m["score"], reverse=True)
    seen = set()
    out = []
    for m in matches:
        if m["path"] in seen:
            continue
        seen.add(m["path"])
        out.append(m)
        if len(out) >= top:
            break
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("query", help="termo de busca")
    ap.add_argument("--top", type=int, default=5)
    ap.add_argument("--pasta", default="06 - Fontes", help="restringe à pasta")
    ap.add_argument("--autor", help="filtra por autor (franca, hercules, palermo, etc.)")
    ap.add_argument("--json", action="store_true", help="output JSON")
    args = ap.parse_args()

    results = retrieve_sc(args.query, args.top, args.pasta, args.autor)
    if not results:
        results = retrieve_keyword(args.query, args.top, args.pasta, args.autor)

    if args.json:
        print(json.dumps(results, ensure_ascii=False, indent=2))
        return

    if not results:
        print("nenhum resultado", file=sys.stderr)
        sys.exit(1)

    for i, r in enumerate(results, 1):
        print(f"\n[{i}] score={r['score']:.4f}")
        print(f"  path: {r['path']}")
        print(f"  wikilink: [[{r['path'].replace('.md', '')}]]")
        print(f"  snippet: {r['snippet'][:200]}...")


if __name__ == "__main__":
    main()
