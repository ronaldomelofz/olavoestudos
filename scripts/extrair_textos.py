# -*- coding: utf-8 -*-
"""Fase A — extração minuciosa dos textos dos vídeos a partir das legendas do YouTube.

Método herdado do projeto Pedro Augusto (extrair_textos_videos.py), adaptado:
  1. yt-dlp -j com player_client=web_embedded (o único cliente que devolve as faixas de legenda
     sem pedir login neste IP; a youtube-transcript-api está bloqueada);
  2. preferência: legenda manual pt > automática pt-orig > automática pt > manual/automática en;
  3. baixa a faixa json3 (segmentos com tempo) direto da URL informada pelo YouTube;
  4. grava TRANSCRICOES/BRUTO/<id>.json (segmentos [t, texto]) e <id>.txt (cabeçalho do Pedro);
  5. estado retomável em TRANSCRICOES/_estado_extracao.json; pausa entre vídeos e a cada lote;
     cooldown em bloqueio anti-bot e parada após bloqueios seguidos.

Vídeos sem nenhuma legenda ficam marcados "sem_legenda" para a Fase B (Whisper, retranscrever.py).

Uso: python scripts/extrair_textos.py [--limite N] [--pausa 8] [--lote 10] [--pausa-lote 60]
                                      [--so-extras] [--ids ID ...] [--refazer]
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
import urllib.request
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
TX = ROOT / "TRANSCRICOES"
BRUTO = TX / "BRUTO"
ESTADO = TX / "_estado_extracao.json"
LOG = TX / "_log_extracao.txt"
sys.path.insert(0, str(ROOT / "scripts"))
from fontes import FONTES_EXTRA, entradas  # noqa: E402

CLIENTE = "youtube:player_client=web_embedded"
BLOQUEIO = ("Sign in to confirm", "HTTP Error 429", "Too Many Requests", "confirm you're not a bot")
PERMANENTE = ("Private video", "no longer available", "Video unavailable", "removed by the uploader")
MAX_BLOQUEIOS = 5
COOLDOWN = 180


def log(msg: str) -> None:
    linha = f"[{datetime.now().strftime('%H:%M:%S')}] {msg}"
    print(linha, flush=True)
    with LOG.open("a", encoding="utf-8") as f:
        f.write(linha + "\n")


def ordem_prioridade() -> list[str]:
    """Fontes novas (aulas completas) > COF oficial > demais playlists oficiais > resto do canal."""
    ids: list[str] = []
    for f in FONTES_EXTRA:
        ids += [e["id"] for e in entradas(RAW / "extra", f)]
    pls = {p.stem: json.loads(p.read_text(encoding="utf-8")) for p in (RAW / "pl").glob("*.json")}
    primeiro = sorted(pls.values(), key=lambda d: (d["title"] != "Curso Online de Filosofia (COF)",
                                                   d["title"] != "Trechos do COF"))
    for d in primeiro:
        ids += [e["id"] for e in d["entries"]]
    site = ROOT / "site" / "public" / "data" / "videos.json"
    acervo = None
    if site.exists():
        acervo = [v["id"] for v in json.loads(site.read_text(encoding="utf-8"))]
        ids += acervo
        acervo = set(acervo)
    vistos, saida = set(), []
    for i in ids:
        if i and i not in vistos and (acervo is None or i in acervo):
            vistos.add(i)
            saida.append(i)
    return saida


def info(vid: str) -> tuple[dict | None, str]:
    cmd = ["yt-dlp", "-j", "--skip-download", "--no-warnings", "--ignore-no-formats-error",
           "--extractor-args", CLIENTE, f"https://www.youtube.com/watch?v={vid}"]
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=180)
    if r.returncode == 0 and r.stdout.strip():
        return json.loads(r.stdout.splitlines()[-1]), ""
    return None, (r.stderr or "")[-600:]


def escolher_faixa(m: dict) -> tuple[str, str] | None:
    """(url_json3, descrição da fonte) da melhor faixa disponível."""
    manual, auto = m.get("subtitles") or {}, m.get("automatic_captions") or {}
    original = (m.get("language") or "pt")[:2]
    ordem = [("manual", manual, "pt"), ("manual", manual, "pt-BR"), ("automática", auto, "pt-orig"),
             ("automática", auto, "pt-BR-orig"), ("automática", auto, "pt")]
    if original == "en":
        ordem = [("manual", manual, "en"), ("automática", auto, "en-orig"), ("automática", auto, "en")] + ordem
    else:
        ordem += [("manual", manual, "en"), ("automática", auto, "en-orig")]
    for tipo, faixas, lang in ordem:
        if lang == "pt" and tipo == "automática" and original not in ("pt", ""):
            continue
        for f in faixas.get(lang) or []:
            if f.get("ext") == "json3" and f.get("url"):
                return f["url"], f"legenda {tipo} ({lang})"
    return None


def baixar_json3(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def segmentos(j3: dict) -> list[list]:
    """Eventos json3 -> [[t_segundos, texto], ...] sem linhas vazias nem repetições de rolagem."""
    segs: list[list] = []
    for ev in j3.get("events") or []:
        if not ev.get("segs"):
            continue
        txt = "".join(s.get("utf8", "") for s in ev["segs"]).replace("\n", " ").strip()
        txt = " ".join(txt.split())
        if not txt:
            continue
        t = round(ev.get("tStartMs", 0) / 1000, 2)
        if segs and segs[-1][1] == txt:
            continue
        segs.append([t, txt])
    return segs


def gravar(vid: str, m: dict, fonte: str, segs: list[list]) -> int:
    texto = " ".join(s[1] for s in segs)
    dado = {
        "id": vid, "titulo": m.get("title"), "canal": m.get("channel"), "duracao": m.get("duration"),
        "fonte_texto": fonte, "extraido_em": datetime.now().isoformat(timespec="seconds"),
        "palavras": len(texto.split()), "segs": segs,
    }
    (BRUTO / f"{vid}.json").write_text(json.dumps(dado, ensure_ascii=False), encoding="utf-8")
    cab = (f"Título: {m.get('title')}\nVideo ID: {vid}\nURL: https://www.youtube.com/watch?v={vid}\n"
           f"Canal: {m.get('channel')}\nDuração (s): {m.get('duration')}\nFonte do texto: {fonte}\n"
           f"Extraído em: {dado['extraido_em']}\n" + "=" * 72 + "\n\n")
    (BRUTO / f"{vid}.txt").write_text(cab + texto + "\n", encoding="utf-8")
    return dado["palavras"]


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--limite", type=int, default=0)
    ap.add_argument("--pausa", type=float, default=8)
    ap.add_argument("--lote", type=int, default=10)
    ap.add_argument("--pausa-lote", type=float, default=60)
    ap.add_argument("--so-extras", action="store_true")
    ap.add_argument("--ids", nargs="*")
    ap.add_argument("--refazer", action="store_true")
    a = ap.parse_args()

    BRUTO.mkdir(parents=True, exist_ok=True)
    estado = json.loads(ESTADO.read_text(encoding="utf-8")) if ESTADO.exists() else {}
    ids = a.ids or ordem_prioridade()
    if a.so_extras:
        extras = {e["id"] for f in FONTES_EXTRA for e in entradas(RAW / "extra", f)}
        ids = [i for i in ids if i in extras]
    pend = [i for i in ids if a.refazer or (estado.get(i, {}).get("status") not in ("ok", "sem_legenda", "indisponivel")
                                             and not (BRUTO / f"{i}.json").exists())]
    if a.limite:
        pend = pend[: a.limite]
    log("=" * 60)
    log(f"EXTRAÇÃO (legendas) | fila={len(ids)} pendentes={len(pend)} pausa={a.pausa}s lote={a.lote}")

    bloqueios, feitos = 0, 0
    for n, vid in enumerate(pend, 1):
        t0 = time.time()
        try:
            m, erro = info(vid)
            if m is None:
                if any(b in erro for b in BLOQUEIO):
                    bloqueios += 1
                    log(f"[{n}/{len(pend)}] BLOQUEIO {vid} ({bloqueios}/{MAX_BLOQUEIOS}) — cooldown {COOLDOWN}s")
                    if bloqueios >= MAX_BLOQUEIOS:
                        log("Parando: bloqueios seguidos. Rode de novo mais tarde (o estado foi salvo).")
                        break
                    time.sleep(COOLDOWN)
                    continue
                st = "indisponivel" if any(p in erro for p in PERMANENTE) else "erro"
                estado[vid] = {"status": st, "erro": erro.strip()[-200:], "em": datetime.now().isoformat(timespec="seconds")}
                log(f"[{n}/{len(pend)}] {st.upper()} {vid}: {erro.strip()[-120:]}")
                continue
            bloqueios = 0
            if (m.get("title") or "").startswith("youtube video #"):
                estado[vid] = {"status": "sem_acesso", "em": datetime.now().isoformat(timespec="seconds")}
                log(f"[{n}/{len(pend)}] SEM ACESSO {vid} (incorporação restrita; tentar outro método)")
                continue
            faixa = escolher_faixa(m)
            if not faixa:
                estado[vid] = {"status": "sem_legenda", "dur": m.get("duration"), "em": datetime.now().isoformat(timespec="seconds")}
                log(f"[{n}/{len(pend)}] SEM LEGENDA {vid} · {(m.get('title') or '')[:60]}")
                continue
            time.sleep(1.5)
            segs = segmentos(baixar_json3(faixa[0]))
            palavras = gravar(vid, m, faixa[1], segs)
            estado[vid] = {"status": "ok", "fonte": faixa[1], "palavras": palavras, "dur": m.get("duration"),
                           "em": datetime.now().isoformat(timespec="seconds")}
            feitos += 1
            log(f"[{n}/{len(pend)}] OK {vid} {palavras} palavras · {faixa[1]} · {round(time.time()-t0,1)}s · "
                f"{(m.get('title') or '')[:55]}")
        except Exception as e:  # noqa: BLE001
            estado[vid] = {"status": "erro", "erro": str(e)[:200], "em": datetime.now().isoformat(timespec="seconds")}
            log(f"[{n}/{len(pend)}] FALHA {vid}: {e}")
            if "429" in str(e):
                bloqueios += 1
                if bloqueios >= MAX_BLOQUEIOS:
                    log("Parando: excesso de requisições seguidas. Rode de novo mais tarde (o estado foi salvo).")
                    break
                log(f"  excesso de requisições ({bloqueios}/{MAX_BLOQUEIOS}) — cooldown {COOLDOWN}s")
                time.sleep(COOLDOWN)
        finally:
            ESTADO.write_text(json.dumps(estado, ensure_ascii=False, indent=1), encoding="utf-8")
        if n < len(pend):
            time.sleep(a.pausa)
            if a.lote and n % a.lote == 0:
                log(f"— lote {n}/{len(pend)} · pausa {a.pausa_lote}s —")
                time.sleep(a.pausa_lote)

    tot = {s: sum(1 for v in estado.values() if v.get("status") == s) for s in ("ok", "sem_legenda", "indisponivel", "erro")}
    log(f"Fim da rodada: novos={feitos} · estado geral {tot}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
