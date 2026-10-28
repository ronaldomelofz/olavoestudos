# -*- coding: utf-8 -*-
"""Fase B — retranscrição fina com Whisper (método retranscrever_fina.py do Pedro Augusto).

Para vídeos sem legenda (estado "sem_legenda" da Fase A) ou, com --fino, para refazer aulas
prioritárias que só têm legenda automática. Ritmo lento, qualidade acima de velocidade:
  * baixa só o áudio original (pt) em baixa taxa: TRANSCRICOES/_audio/<id>.*  (apagado ao final);
  * faster-whisper small, CPU int8, beam 5, best_of 5, temperature 0, condition_on_previous_text,
    VAD (silêncio mínimo 450 ms, margem 200 ms) e PROMPT com o vocabulário do curso;
  * grava TRANSCRICOES/BRUTO/<id>.json no mesmo formato da Fase A (a legenda anterior vai para
    BRUTO/_legenda/ como backup); depois rode editar_estudo.py;
  * estado em TRANSCRICOES/_estado_whisper.json; pausa 8 s entre vídeos e 45 s a cada 5.

Uso: python scripts/retranscrever.py [--ids ID ...] [--fino] [--limite N] [--modelo small]
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TX = ROOT / "TRANSCRICOES"
BRUTO = TX / "BRUTO"
AUDIO = TX / "_audio"
ESTADO_A = TX / "_estado_extracao.json"
ESTADO = TX / "_estado_whisper.json"
LOG = TX / "_log_whisper.txt"
sys.path.insert(0, str(ROOT / "scripts"))
from fontes import FONTES_EXTRA  # noqa: E402

PROMPT = (
    "Aula de filosofia em português do Brasil, do professor Olavo de Carvalho, no Curso Online de "
    "Filosofia (COF). Aristóteles, Platão, Sócrates, Husserl, Louis Lavelle, Eric Voegelin, Mário "
    "Ferreira dos Santos, René Guénon, Frithjof Schuon, Leibniz, Kant, Hegel, Marx, Gramsci, Lukács, "
    "Escola de Frankfurt, paralaxe cognitiva, consciência de imortalidade, teoria dos quatro discursos, "
    "dialética, retórica, poética, analítica, vida intelectual, educação liberal, epistemologia."
)
AUDIO_FMT = "ba[format_note*=original][abr<=96]/ba[format_note*=original]/ba[language^=pt]/ba"
COLECOES_AULA = {"PL52ZkoPcWL64AIbTB1UCCdwlW1oMeDJvN", "PLZ7ZiwzkjKE4SiZ-BB1SdpjfdICYbVldT",
                 "PL04bwAw9nF3ZfJydE6yhZtDMyQOsnCF7e", "avulsos"}


def log(msg: str) -> None:
    linha = f"[{datetime.now().strftime('%H:%M:%S')}] {msg}"
    print(linha, flush=True)
    with LOG.open("a", encoding="utf-8") as f:
        f.write(linha + "\n")


def baixar_audio(vid: str) -> tuple[Path, dict]:
    local = ROOT / "ACERVO" / "VIDEOS" / f"{vid}.mp4"
    ficha = local.with_suffix(".info.json")
    if local.exists() and ficha.exists():
        return local, json.loads(ficha.read_text(encoding="utf-8"))
    AUDIO.mkdir(parents=True, exist_ok=True)
    cmd = ["yt-dlp", "-f", AUDIO_FMT, "--no-warnings", "--no-playlist", "--write-info-json",
           "-o", str(AUDIO / f"{vid}.%(ext)s"), f"https://www.youtube.com/watch?v={vid}"]
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=3600)
    arquivos = [p for p in AUDIO.glob(f"{vid}.*") if p.suffix not in (".json", ".part", ".ytdl")]
    if r.returncode != 0 or not arquivos:
        raise RuntimeError((r.stderr or "falha no download")[-300:])
    info = json.loads((AUDIO / f"{vid}.info.json").read_text(encoding="utf-8"))
    return arquivos[0], info


PARTE_S = 20 * 60


def _trechos(modelo, audio: Path, offset: float) -> list[list]:
    segs, _ = modelo.transcribe(
        str(audio), language="pt", beam_size=5, best_of=5, temperature=0.0,
        condition_on_previous_text=True, initial_prompt=PROMPT, vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 450, "speech_pad_ms": 200},
    )
    return [[round(s.start + offset, 2), " ".join(s.text.split())] for s in segs if s.text.strip()]


def transcrever(modelo, audio: Path, duracao: float | None) -> list[list]:
    """Aulas longas vão em fatias de 20 min: o mel inteiro em float64 estoura a memória."""
    if not duracao or duracao <= PARTE_S + 90:
        return _trechos(modelo, audio, 0)
    tmp = AUDIO / f"_partes_{audio.stem}"
    if tmp.exists():
        shutil.rmtree(tmp)
    tmp.mkdir(parents=True)
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(audio), "-vn", "-ac", "1", "-ar", "16000",
         "-f", "segment", "-segment_time", str(PARTE_S), str(tmp / "p_%03d.wav")],
        check=True, capture_output=True,
    )
    segs: list[list] = []
    offset = 0.0
    for parte in sorted(tmp.glob("p_*.wav")):
        segs += _trechos(modelo, parte, offset)
        sonda = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(parte)],
            capture_output=True, text=True,
        )
        offset += float((sonda.stdout or "0").strip() or 0)
    shutil.rmtree(tmp, ignore_errors=True)
    return segs


def alvos(a) -> list[str]:
    if a.ids:
        return a.ids
    estado = json.loads(ESTADO_A.read_text(encoding="utf-8")) if ESTADO_A.exists() else {}
    if a.fino:
        from fontes import entradas
        ids = []
        for f in FONTES_EXTRA:
            if f["id"] in COLECOES_AULA:
                ids += [e["id"] for e in entradas(ROOT / "data" / "raw" / "extra", f)]
        return [i for i in dict.fromkeys(ids)
                if not estado.get(i, {}).get("fonte", "").startswith("legenda manual")
                and estado.get(i, {}).get("status") not in ("sem_acesso", "indisponivel")]
    return [i for i, v in estado.items() if v.get("status") == "sem_legenda"]


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--ids", nargs="*")
    ap.add_argument("--fino", action="store_true", help="refazer aulas que só têm legenda automática")
    ap.add_argument("--limite", type=int, default=0)
    ap.add_argument("--modelo", default="small")
    ap.add_argument("--pausa", type=float, default=8)
    ap.add_argument("--manter-audio", action="store_true")
    a = ap.parse_args()

    BRUTO.mkdir(parents=True, exist_ok=True)
    estado = json.loads(ESTADO.read_text(encoding="utf-8")) if ESTADO.exists() else {}
    pend = [i for i in alvos(a) if estado.get(i, {}).get("status") != "ok" or a.ids]
    if a.limite:
        pend = pend[: a.limite]
    log("=" * 60)
    log(f"RETRANSCRIÇÃO FINA | modelo={a.modelo} | pendentes={len(pend)}")
    if not pend:
        return 0

    from faster_whisper import WhisperModel

    threads = max(2, (os.cpu_count() or 4) - 2)
    log(f"Carregando Whisper {a.modelo} (CPU int8, threads={threads})…")
    modelo = WhisperModel(a.modelo, device="cpu", compute_type="int8", cpu_threads=threads, num_workers=1)
    log("Modelo pronto.")

    for n, vid in enumerate(pend, 1):
        t0 = time.time()
        try:
            audio, info = baixar_audio(vid)
            log(f"[{n}/{len(pend)}] áudio {audio.name} ({audio.stat().st_size // 1024} KB) · {info.get('title', '')[:60]}")
            segs = transcrever(modelo, audio, info.get("duration"))
            anterior = BRUTO / f"{vid}.json"
            if anterior.exists():
                (BRUTO / "_legenda").mkdir(exist_ok=True)
                shutil.copy2(anterior, BRUTO / "_legenda" / anterior.name)
            texto = " ".join(s[1] for s in segs)
            fonte = f"whisper {a.modelo} (retranscrição fina)"
            dado = {"id": vid, "titulo": info.get("title"), "canal": info.get("channel"),
                    "duracao": info.get("duration"), "fonte_texto": fonte,
                    "extraido_em": datetime.now().isoformat(timespec="seconds"),
                    "palavras": len(texto.split()), "segs": segs}
            anterior.write_text(json.dumps(dado, ensure_ascii=False), encoding="utf-8")
            cab = (f"Título: {dado['titulo']}\nVideo ID: {vid}\nURL: https://www.youtube.com/watch?v={vid}\n"
                   f"Canal: {dado['canal']}\nDuração (s): {dado['duracao']}\nFonte do texto: {fonte}\n"
                   f"Extraído em: {dado['extraido_em']}\n" + "=" * 72 + "\n\n")
            (BRUTO / f"{vid}.txt").write_text(cab + texto + "\n", encoding="utf-8")
            seg = round(time.time() - t0)
            ritmo = round(seg / max(1, dado["duracao"] or 1), 2)
            estado[vid] = {"status": "ok", "palavras": dado["palavras"], "seg": seg, "ritmo": ritmo,
                           "em": dado["extraido_em"]}
            log(f"  OK {dado['palavras']} palavras em {seg}s (ritmo {ritmo}× a duração)")
            if not a.manter_audio:
                for p in AUDIO.glob(f"{vid}.*"):
                    p.unlink(missing_ok=True)
        except Exception as e:  # noqa: BLE001
            estado[vid] = {"status": "erro", "erro": str(e)[:300], "em": datetime.now().isoformat(timespec="seconds")}
            log(f"  FALHA {vid}: {e}")
        finally:
            ESTADO.write_text(json.dumps(estado, ensure_ascii=False, indent=1), encoding="utf-8")
        if n < len(pend):
            time.sleep(a.pausa)
            if n % 5 == 0:
                log("— pausa de lote 45s —")
                time.sleep(45)
    log("Fim da rodada.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
