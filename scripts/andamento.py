# -*- coding: utf-8 -*-
"""Mede o andamento do acervo. Grava site/public/andamento.json e, com --stdout, imprime o JSON.

A versão local do site lê este arquivo (o Vite regenera a cada consulta). O site público
mostra o retrato gravado no último envio.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TX = ROOT / "TRANSCRICOES"
AC = ROOT / "ACERVO"
PUB = ROOT / "site" / "public"
WHISPER_TOTAL = 33
GUIAS_TOTAL = 8
CURSOS_TOTAL = 30


def contar(pasta: Path, ext: str) -> int:
    if not pasta.exists():
        return 0
    return sum(1 for p in pasta.glob(f"*{ext}") if p.is_file() and not p.name.startswith("_"))


def status(caminho: Path) -> dict[str, int]:
    if not caminho.exists():
        return {}
    dados = json.loads(caminho.read_text(encoding="utf-8"))
    tot: dict[str, int] = {}
    for item in dados.values():
        chave = item.get("status") or "?"
        tot[chave] = tot.get(chave, 0) + 1
    return tot


def medir() -> dict:
    videos = json.loads((PUB / "data" / "videos.json").read_text(encoding="utf-8"))
    textos = json.loads((PUB / "data" / "textos.json").read_text(encoding="utf-8"))
    off = sum(1 for v in videos if v.get("off"))
    no_ar = len(videos) - off
    extr = status(TX / "_estado_extracao.json")
    whis = status(TX / "_estado_whisper.json")
    mp4 = contar(AC / "VIDEOS", ".mp4")
    gb = round(sum(p.stat().st_size for p in (AC / "VIDEOS").glob("*.mp4")) / 1e9, 2) if (AC / "VIDEOS").exists() else 0
    return {
        "em": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "gb": gb,
        "removidos": off,
        "etapas": [
            {"id": "videos", "nome": "Vídeos em MP4 no acervo", "feito": mp4, "total": no_ar,
             "detalhe": f"{gb} GB salvos · pausa de 20 s entre vídeos"},
            {"id": "seminario", "nome": "Textos integrais do Seminário", "feito": contar(AC / "SEMINARIO" / "textos", ".json"),
             "total": len(textos), "detalhe": "artigos abertos em JSON e Markdown"},
            {"id": "legendas", "nome": "Legendas com marcação de tempo", "feito": extr.get("ok", 0),
             "total": no_ar, "detalhe": f"sem acesso: {extr.get('sem_acesso', 0)} · erros a repetir: {extr.get('erro', 0)}"},
            {"id": "estudo", "nome": "Edição para estudo", "feito": contar(TX / "ESTUDO", ".md"),
             "total": extr.get("ok", 0) or 1, "detalhe": "parágrafos com tempo, a partir das legendas já extraídas"},
            {"id": "whisper", "nome": "Retranscrição fina das aulas completas", "feito": whis.get("ok", 0),
             "total": WHISPER_TOTAL, "detalhe": f"Whisper small em fatias de 20 min · falhas: {whis.get('erro', 0)}"},
            {"id": "cursos", "nome": "Cursos, capas e guias", "feito": contar(AC / "SEMINARIO" / "cursos", ".json") + contar(AC / "SEMINARIO" / "guias", ".json"),
             "total": CURSOS_TOTAL + GUIAS_TOTAL, "detalhe": "30 fichas de curso e 8 guias (parte pública)"},
        ],
    }


def main() -> None:
    dado = medir()
    destino = PUB / "andamento.json"
    destino.write_text(json.dumps(dado, ensure_ascii=False, indent=1), encoding="utf-8")
    if "--stdout" in sys.argv:
        print(json.dumps(dado, ensure_ascii=False))


if __name__ == "__main__":
    main()
