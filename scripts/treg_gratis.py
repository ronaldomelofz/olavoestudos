"""Chama só endpoints Treg documentados como gratuitos (cost.type == free, usd == 0).

Uso:
  python scripts/treg_gratis.py listar
  python scripts/treg_gratis.py detalhe tinyfish.web.fetch
  python scripts/treg_gratis.py fetch https://olavodecarvalho.com.br/textos/quem-e-olavo-de-carvalho
  python scripts/treg_gratis.py youtube-detail dQw4w9WgXcQ
  python scripts/treg_gratis.py youtube-search "olavo de carvalho cof"

Requer `treg login` uma vez (conta grátis). Nunca chama ferramentas pagas.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path

BASE = "https://treg.to"
# Lista fechada: só o que o catálogo marca como free / $0 (verificado em 2026-10-30).
PERMITIDOS = {
    "tinyfish.web.fetch": "Lê página pública em Markdown (útil para textos oficiais).",
    "tinyfish.web.search.news": "Busca notícias (índice TinyFish).",
    "tinyfish.web.search.publications": "Busca publicações/papers.",
    "youtube.youtube.video.detail": "Metadados de um vídeo do YouTube.",
    "youtube.youtube.search.videos": "Busca vídeos no YouTube por palavra-chave.",
    "youtube.youtube.video.comments": "Comentários públicos de um vídeo.",
    "youtube.youtube.channel.videos.uploads": "Lista uploads de um canal (playlist).",
    "crawl4ai.web.extract.estimate": "Estima custo de scrape (não baixa a página).",
}

# Explicitamente proibidos mesmo se o preço aparecer como 0.0 (roteados cobram).
PROIBIDOS = {
    "treg.web.extract",
    "treg.web.search",
    "treg.web.search.news",
    "treg.web.search.publications",
    "linkup.web.fetch",
    "firecrawl.web.crawl",
    "brightdata.web.scrape.job.start",
}


def token() -> str:
    env = os.environ.get("TREG_TOKEN") or os.environ.get("X_TREG_TOKEN")
    if env:
        return env.strip()
    cfg = Path.home() / ".treg" / "config.json"
    if cfg.exists():
        d = json.loads(cfg.read_text(encoding="utf-8"))
        for k in ("token", "api_token", "access_token"):
            if d.get(k):
                return str(d[k])
        # formatos recentes
        if isinstance(d.get("auth"), dict) and d["auth"].get("token"):
            return str(d["auth"]["token"])
    # tenta via CLI
    r = subprocess.run(["treg", "--json", "whoami"], capture_output=True, text=True)
    if r.returncode == 0:
        try:
            j = json.loads(r.stdout)
            for k in ("token", "api_token"):
                if j.get(k):
                    return str(j[k])
        except json.JSONDecodeError:
            pass
    raise SystemExit(
        "Sem token Treg. Rode uma vez (grátis):  treg login\n"
        "Ou exporte TREG_TOKEN=...  Não usamos saldo — só endpoints free."
    )


def catalog_get(eid: str) -> dict:
    req = urllib.request.Request(
        f"{BASE}/catalog/endpoints/{urllib.parse.quote(eid)}",
        headers={"Accept": "application/json", "User-Agent": "olavoestudos-gratis"},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())


def assert_gratis(eid: str) -> None:
    if eid in PROIBIDOS:
        raise SystemExit(f"Recusado: {eid} pode gerar cobrança (roteado/pago).")
    if eid not in PERMITIDOS:
        raise SystemExit(
            f"Recusado: {eid} não está na lista gratuita deste projeto.\n"
            f"Permitidos: {', '.join(sorted(PERMITIDOS))}"
        )
    d = catalog_get(eid)
    cost = (d.get("endpoint") or {}).get("cost") or {}
    tipo = cost.get("type")
    usd = cost.get("usd", cost.get("value"))
    note = (cost.get("note") or "").lower()
    if tipo != "free" or (usd not in (0, 0.0, None)) or "not free" in note:
        raise SystemExit(
            f"Recusado em tempo real: {eid} já não está free no catálogo "
            f"(type={tipo!r} usd={usd!r}). Atualize PERMITIDOS."
        )


def call(eid: str, *, method: str = "GET", query: dict | None = None, data: dict | None = None) -> dict:
    assert_gratis(eid)
    url = f"{BASE}/call/{eid}"
    if query:
        url += "?" + urllib.parse.urlencode(query)
    body = None if data is None else json.dumps(data).encode()
    headers = {
        "Accept": "application/json",
        "User-Agent": "olavoestudos-gratis",
        "X-Treg-Token": token(),
    }
    if body is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=120) as r:
        custo = r.headers.get("X-Treg-Cost-Micro")
        if custo and int(custo) > 0:
            raise SystemExit(f"Abortado: a chamada cobrou {custo} microdólares. Não esperávamos custo.")
        return {
            "status": r.status,
            "cost_micro": custo or "0",
            "served_by": r.headers.get("X-Treg-Served-By"),
            "body": json.loads(r.read().decode()),
        }


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    ap = argparse.ArgumentParser(description="Treg só com ferramentas gratuitas")
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("listar", help="mostra a lista permitida")
    p = sub.add_parser("detalhe")
    p.add_argument("id")
    p = sub.add_parser("fetch", help="tinyfish.web.fetch → Markdown")
    p.add_argument("url")
    p = sub.add_parser("youtube-detail")
    p.add_argument("id")
    p = sub.add_parser("youtube-search")
    p.add_argument("q")
    p.add_argument("--max", type=int, default=10)

    a = ap.parse_args()
    if a.cmd == "listar":
        for i, desc in PERMITIDOS.items():
            print(f"{i}\n  {desc}")
        return 0
    if a.cmd == "detalhe":
        assert_gratis(a.id)
        print(json.dumps(catalog_get(a.id), ensure_ascii=False, indent=2)[:4000])
        return 0
    if a.cmd == "fetch":
        out = call(
            "tinyfish.web.fetch",
            method="POST",
            data={"urls": [a.url], "format": "markdown"},
        )
        print(json.dumps(out, ensure_ascii=False, indent=2)[:8000])
        return 0
    if a.cmd == "youtube-detail":
        out = call(
            "youtube.youtube.video.detail",
            query={"part": "snippet,statistics,contentDetails", "id": a.id},
        )
        print(json.dumps(out, ensure_ascii=False, indent=2)[:8000])
        return 0
    if a.cmd == "youtube-search":
        out = call(
            "youtube.youtube.search.videos",
            query={"part": "snippet", "q": a.q, "maxResults": str(a.max), "type": "video"},
        )
        print(json.dumps(out, ensure_ascii=False, indent=2)[:8000])
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
