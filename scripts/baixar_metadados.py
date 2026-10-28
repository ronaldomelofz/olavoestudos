"""Baixa metadados completos (sem vídeo) de todos os IDs em data/raw/all_ids.txt.

Gera data/raw/meta/<id>.json com os campos úteis ao estudo. Retomável: pula IDs já salvos e
IDs com erro permanente (privado, removido); refaz os que falharam por bloqueio anti-bot.
Usa o cliente web_safari, que hoje escapa do "Sign in to confirm you're not a bot"; se o
bloqueio persistir, o script para sozinho para ser retomado mais tarde.
Uso: python scripts/baixar_metadados.py [n_paralelos] [pausa_segundos]
"""
import json
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Event, Lock

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
META = RAW / "meta"
CAMPOS = [
    "id", "title", "description", "upload_date", "duration", "view_count", "like_count",
    "tags", "chapters", "live_status", "availability", "language", "channel_id",
]
PERMANENTES = ("Private video", "no longer available", "Video unavailable", "removed")
BLOQUEIO = "not a bot"
MAX_BLOQUEIOS_SEGUIDOS = 15
PAUSA = 1.5

parar = Event()
trava = Lock()
bloqueios_seguidos = 0


def baixar(vid: str) -> str:
    global bloqueios_seguidos
    destino = META / f"{vid}.json"
    erro = destino.with_suffix(".err")
    if destino.exists():
        return "skip"
    if erro.exists() and any(p in erro.read_text(encoding="utf-8") for p in PERMANENTES):
        return "skip"
    if parar.is_set():
        return "adiado"
    proc = subprocess.run(
        ["yt-dlp", "-j", "--skip-download", "--no-warnings", "--no-playlist",
         "--ignore-no-formats-error", "--extractor-args", "youtube:player_client=web_safari",
         f"https://www.youtube.com/watch?v={vid}"],
        capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=180,
    )
    time.sleep(PAUSA)
    if proc.returncode != 0 or not proc.stdout.strip():
        erro.write_text(proc.stderr[-2000:], encoding="utf-8")
        if BLOQUEIO in proc.stderr:
            with trava:
                bloqueios_seguidos += 1
                if bloqueios_seguidos >= MAX_BLOQUEIOS_SEGUIDOS:
                    parar.set()
        return "erro"
    with trava:
        bloqueios_seguidos = 0
    info = json.loads(proc.stdout.splitlines()[0])
    dados = {k: info.get(k) for k in CAMPOS}
    if dados["chapters"]:
        dados["chapters"] = [{"t": int(c["start_time"]), "title": c["title"]} for c in dados["chapters"]]
    destino.write_text(json.dumps(dados, ensure_ascii=False), encoding="utf-8")
    erro.unlink(missing_ok=True)
    return "ok"


def main() -> None:
    global PAUSA
    paralelos = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    PAUSA = float(sys.argv[2]) if len(sys.argv) > 2 else PAUSA
    META.mkdir(parents=True, exist_ok=True)
    ids = [l.strip() for l in (RAW / "all_ids.txt").read_text().splitlines() if l.strip()]
    contagem = {"ok": 0, "skip": 0, "erro": 0, "adiado": 0}
    with ThreadPoolExecutor(paralelos) as pool:
        for i, r in enumerate(pool.map(baixar, ids), 1):
            contagem[r] += 1
            if i % 25 == 0 or i == len(ids):
                print(f"{i}/{len(ids)} {contagem}", flush=True)
    if parar.is_set():
        print("Bloqueio anti-bot persistente: rode de novo mais tarde para completar.", flush=True)


if __name__ == "__main__":
    main()
