# -*- coding: utf-8 -*-
"""Acervo local dos vídeos: MP4 (H.264 até 480p + áudio original pt), miniatura e ficha.

Saída: ACERVO/VIDEOS/<id>.mp4 · <id>.jpg · <id>.info.json
Ordem: a mesma da extração de textos (aulas das coleções novas, COF, playlists, resto do canal).
Lento e retomável: pula o que já existe; pausa 20 s entre vídeos e 90 s a cada 10; cooldown de
5 min em bloqueio anti-bot e parada após 4 bloqueios seguidos. Estado em ACERVO/VIDEOS/_estado.json.
Uso: python scripts/baixar_videos.py [--limite N] [--pausa 20] [--ids ID ...]
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / "ACERVO" / "VIDEOS"
ESTADO = DEST / "_estado.json"
LOG = DEST / "_log.txt"
sys.path.insert(0, str(ROOT / "scripts"))
from extrair_textos import ordem_prioridade  # noqa: E402

FORMATO = ("bv*[height<=480][vcodec^=avc1]+ba[ext=m4a][format_note*=original]/"
           "bv*[height<=480][vcodec^=avc1]+ba[ext=m4a]/b[height<=480][ext=mp4]/b[height<=480]/b")
BLOQUEIO = ("Sign in to confirm", "HTTP Error 429", "Too Many Requests", "not a bot")
PERMANENTE = ("Private video", "Video unavailable", "removed", "no longer available", "account associated")


def log(msg: str) -> None:
    linha = f"[{datetime.now().strftime('%H:%M:%S')}] {msg}"
    print(linha, flush=True)
    with LOG.open("a", encoding="utf-8") as f:
        f.write(linha + "\n")


def baixar(vid: str) -> tuple[bool, str]:
    cmd = ["yt-dlp", "--no-warnings", "--no-playlist", "-f", FORMATO, "--merge-output-format", "mp4",
           "--write-thumbnail", "--convert-thumbnails", "jpg", "--write-info-json", "--retries", "5",
           "--fragment-retries", "10", "-o", str(DEST / "%(id)s.%(ext)s"), f"https://www.youtube.com/watch?v={vid}"]
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=6 * 3600)
    return r.returncode == 0 and (DEST / f"{vid}.mp4").exists(), (r.stderr or "")[-500:]


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--limite", type=int, default=0)
    ap.add_argument("--pausa", type=float, default=20)
    ap.add_argument("--ids", nargs="*")
    a = ap.parse_args()
    DEST.mkdir(parents=True, exist_ok=True)
    estado = json.loads(ESTADO.read_text(encoding="utf-8")) if ESTADO.exists() else {}
    tx = ROOT / "TRANSCRICOES" / "_estado_extracao.json"
    fora = {i for i, s in json.loads(tx.read_text(encoding="utf-8")).items()
            if s.get("status") in ("sem_acesso", "indisponivel")} if tx.exists() else set()
    fila = a.ids or [i for i in ordem_prioridade() if i not in fora]
    pend = [i for i in fila if not (DEST / f"{i}.mp4").exists() and estado.get(i, {}).get("status") != "indisponivel"]
    if a.limite:
        pend = pend[: a.limite]
    log("=" * 60)
    log(f"VÍDEOS | fila={len(fila)} pendentes={len(pend)} pausa={a.pausa}s")

    bloqueios = 0
    for n, vid in enumerate(pend, 1):
        t0 = time.time()
        ok, erro = baixar(vid)
        if ok:
            bloqueios = 0
            mb = round((DEST / f"{vid}.mp4").stat().st_size / 1e6, 1)
            estado[vid] = {"status": "ok", "mb": mb, "em": datetime.now().isoformat(timespec="seconds")}
            log(f"[{n}/{len(pend)}] OK {vid} {mb} MB em {round(time.time() - t0)}s")
        elif any(b in erro for b in BLOQUEIO):
            bloqueios += 1
            log(f"[{n}/{len(pend)}] BLOQUEIO {vid} ({bloqueios}/4) — cooldown 300s")
            if bloqueios >= 4:
                log("Parando: bloqueios seguidos. Rode de novo mais tarde (estado salvo).")
                break
            time.sleep(300)
        else:
            st = "indisponivel" if any(p in erro for p in PERMANENTE) else "erro"
            estado[vid] = {"status": st, "erro": erro.strip()[-200:], "em": datetime.now().isoformat(timespec="seconds")}
            log(f"[{n}/{len(pend)}] {st.upper()} {vid}: {erro.strip()[-140:]}")
        for resto in DEST.glob(f"{vid}.f*"):
            resto.unlink(missing_ok=True)
        ESTADO.write_text(json.dumps(estado, ensure_ascii=False, indent=1), encoding="utf-8")
        if n < len(pend):
            time.sleep(a.pausa)
            if n % 10 == 0:
                log(f"— lote {n}/{len(pend)} · pausa 90s —")
                time.sleep(90)
    total = sum(p.stat().st_size for p in DEST.glob("*.mp4")) / 1e9
    log(f"Fim da rodada · {len(list(DEST.glob('*.mp4')))} vídeos no acervo · {total:.1f} GB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
