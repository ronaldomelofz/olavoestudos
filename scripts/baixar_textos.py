# -*- coding: utf-8 -*-
"""Acervo local do Seminário de Filosofia (olavodecarvalho.com.br): texto integral dos artigos
abertos, parte pública dos guias (são pagos) e ficha completa dos cursos.

Saída: ACERVO/SEMINARIO/textos/<slug>.json (resposta da API, HTML limpo) e <slug>.md (texto)
       ACERVO/SEMINARIO/guias/<slug>.json · ACERVO/SEMINARIO/cursos/<id>.json
       ACERVO/SEMINARIO/imagens/<arquivo>
Retomável (pula o que já existe); pausa de 1,5 s entre requisições e 30 s a cada 100.
Uso: python scripts/baixar_textos.py [--pausa 1.5] [--refazer]
"""
from __future__ import annotations

import argparse
import html
import json
import re
import sys
import time
import urllib.request
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEM = ROOT / "data" / "raw" / "site" / "seminario.json"
DEST = ROOT / "ACERVO" / "SEMINARIO"
API = "https://api.olavodecarvalho.com.br"
CAB = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/130.0 Safari/537.36",
    "Origin": "https://olavodecarvalho.com.br",
    "Referer": "https://olavodecarvalho.com.br/",
    "Accept": "application/json",
}
PERIGOSO = re.compile(r"<(script|style|iframe|object|embed)\b[^>]*>.*?</\1>|\son\w+=\"[^\"]*\"|\son\w+='[^']*'", re.I | re.S)


def get(url: str, binario: bool = False):
    req = urllib.request.Request(url, headers=CAB)
    for tentativa in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                dado = r.read()
            return dado if binario else json.loads(dado.decode("utf-8"))
        except Exception as e:  # noqa: BLE001
            if tentativa == 3:
                raise
            espera = 30 * (tentativa + 1)
            print(f"  tentativa {tentativa + 1} falhou ({e}); aguardando {espera}s", flush=True)
            time.sleep(espera)


def limpar_html(h: str | None) -> str:
    return PERIGOSO.sub("", h or "")


def para_texto(h: str) -> str:
    t = re.sub(r"(?i)<br\s*/?>", "\n", h)
    t = re.sub(r"(?i)</(p|div|h[1-6]|li|blockquote)>", "\n\n", t)
    t = re.sub(r"(?i)<li[^>]*>", "- ", t)
    t = re.sub(r"<[^>]+>", "", t)
    t = html.unescape(t).replace("\u00a0", " ")
    return re.sub(r"\n{3,}", "\n\n", re.sub(r"[ \t]+", " ", t)).strip()


def imagem(url: str | None) -> str | None:
    if not url:
        return None
    nome = re.sub(r"[^\w.\-]", "_", url.split("?")[0].rsplit("/", 1)[-1])
    alvo = DEST / "imagens" / nome
    if not alvo.exists():
        try:
            alvo.write_bytes(get(url, binario=True))
        except Exception as e:  # noqa: BLE001
            print(f"  imagem falhou {url}: {e}", flush=True)
            return None
    return nome


def salvar_artigo(pasta: str, slug: str) -> dict:
    d = get(f"{API}/articles/detail/index/{slug}")["data"]
    for campo in ("text", "summary", "principal_points", "references", "bibliography"):
        d[campo] = limpar_html(d.get(campo))
    d["capa_local"] = imagem(d.get("cover_files_url"))
    d["baixado_em"] = datetime.now().isoformat(timespec="seconds")
    (DEST / pasta / f"{slug}.json").write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")
    partes = [f"# {d['title']}", "",
              f"{d.get('publication_author') or 'Olavo de Carvalho'} · {d.get('full_publication_date') or ''}",
              f"Fonte: https://olavodecarvalho.com.br/textos/{slug}", ""]
    for campo, titulo in (("summary", "Resumo"), ("principal_points", "Pontos principais")):
        if d.get(campo):
            partes += [f"## {titulo}", "", para_texto(d[campo]), ""]
    partes += [para_texto(d["text"]), ""]
    for campo, titulo in (("references", "Referências"), ("bibliography", "Bibliografia")):
        if d.get(campo):
            partes += [f"## {titulo}", "", para_texto(d[campo]), ""]
    if d.get("is_truncated"):
        partes += ["> Conteúdo restrito a assinantes: apenas a parte pública foi salva.", ""]
    (DEST / pasta / f"{slug}.md").write_text("\n".join(partes), encoding="utf-8")
    return d


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--pausa", type=float, default=1.5)
    ap.add_argument("--refazer", action="store_true")
    ap.add_argument("--so-cursos", action="store_true", help="rebaixar só as fichas e capas dos cursos")
    a = ap.parse_args()
    for p in ("textos", "guias", "cursos", "imagens"):
        (DEST / p).mkdir(parents=True, exist_ok=True)
    s = json.loads(SEM.read_text(encoding="utf-8"))

    fila = [("cursos", str(c["id"])) for c in s["courses"]]
    if a.so_cursos:
        a.refazer = True
    else:
        fila += [("guias", g["slug"]) for g in s["guides"]]
        fila += [("textos", t["slug"]) for t in s["articles"]]
    feitos = falhas = 0
    for n, (pasta, chave) in enumerate(fila, 1):
        alvo = DEST / pasta / f"{chave}.json"
        if alvo.exists() and not a.refazer:
            continue
        try:
            if pasta == "cursos":
                d = get(f"{API}/courses/detail/index/{chave}")["data"]
                d["sinopsis"] = limpar_html(d.get("sinopsis"))
                d["capa_local"] = imagem(d.get("thumbnail_files_url") or d.get("cover_files_url"))
                d["baixado_em"] = datetime.now().isoformat(timespec="seconds")
                alvo.write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")
            else:
                d = salvar_artigo(pasta, chave)
                if d.get("is_truncated"):
                    print(f"[{n}/{len(fila)}] {pasta}/{chave}: só parte pública (pago)", flush=True)
            feitos += 1
            if feitos % 25 == 0:
                print(f"[{n}/{len(fila)}] {feitos} salvos · {pasta}/{chave}", flush=True)
        except Exception as e:  # noqa: BLE001
            falhas += 1
            print(f"[{n}/{len(fila)}] FALHA {pasta}/{chave}: {e}", flush=True)
        time.sleep(a.pausa)
        if feitos and feitos % 100 == 0:
            time.sleep(30)
    print(f"Fim: {feitos} salvos nesta rodada, {falhas} falhas.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
