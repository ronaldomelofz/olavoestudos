"""Extrai a faixa de áudio de cada MP4 do acervo para ACERVO/AUDIOS/<id>.m4a (cópia, sem reencode).

100% local e automático — não precisa de rede nem de login.
Uso: python scripts/extrair_audios.py [--limite N] [--ids ID ...]
"""
from __future__ import annotations

import argparse
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VIDEOS = ROOT / "ACERVO" / "VIDEOS"
AUDIOS = ROOT / "ACERVO" / "AUDIOS"


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--limite", type=int, default=0)
    ap.add_argument("--ids", nargs="*")
    a = ap.parse_args()
    AUDIOS.mkdir(parents=True, exist_ok=True)
    vids = sorted(VIDEOS.glob("*.mp4"))
    if a.ids:
        vids = [VIDEOS / f"{i}.mp4" for i in a.ids if (VIDEOS / f"{i}.mp4").exists()]
    feitos = pulados = falhas = 0
    for i, mp4 in enumerate(vids, 1):
        if a.limite and feitos >= a.limite:
            break
        dest = AUDIOS / f"{mp4.stem}.m4a"
        if dest.exists() and dest.stat().st_size > 0 and dest.stat().st_mtime >= mp4.stat().st_mtime:
            pulados += 1
            continue
        t0 = time.time()
        r = subprocess.run(
            [
                "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                "-i", str(mp4), "-vn", "-acodec", "copy", str(dest),
            ],
            capture_output=True,
            text=True,
        )
        if r.returncode != 0 or not dest.exists() or dest.stat().st_size == 0:
            # fallback: reencode AAC se a cópia falhar
            r2 = subprocess.run(
                [
                    "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                    "-i", str(mp4), "-vn", "-c:a", "aac", "-b:a", "96k", str(dest),
                ],
                capture_output=True,
                text=True,
            )
            if r2.returncode != 0 or not dest.exists():
                falhas += 1
                print(f"[{i}/{len(vids)}] FALHA {mp4.stem}: {(r.stderr or r2.stderr)[:120]}")
                dest.unlink(missing_ok=True)
                continue
        feitos += 1
        mb = dest.stat().st_size / 1e6
        print(f"[{i}/{len(vids)}] OK {mp4.stem} {mb:.1f} MB em {time.time()-t0:.1f}s")
    print(f"Fim: novos={feitos} pulados={pulados} falhas={falhas} · pasta {AUDIOS}")
    return 0 if falhas == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
