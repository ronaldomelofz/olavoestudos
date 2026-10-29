# -*- coding: utf-8 -*-
"""Mede o andamento do acervo. Grava site/public/andamento.json e, com --stdout, imprime o JSON.

A versão local do site lê este arquivo (o Vite regenera a cada consulta). O site público
mostra o retrato gravado no último envio.
"""
from __future__ import annotations

import json
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TX = ROOT / "TRANSCRICOES"
AC = ROOT / "ACERVO"
PUB = ROOT / "site" / "public"
WHISPER_TOTAL = 33
GUIAS_TOTAL = 8
CURSOS_TOTAL = 30
# Arquivos de controle; IDs do YouTube também podem começar com "_".
CONTROLE = ("_estado", "_log", "_indice", "_andamento")


def contar(pasta: Path, ext: str) -> int:
    if not pasta.exists():
        return 0
    return sum(1 for p in pasta.glob(f"*{ext}") if p.is_file() and not p.name.startswith(CONTROLE))


def status(caminho: Path) -> dict[str, int]:
    if not caminho.exists():
        return {}
    dados = json.loads(caminho.read_text(encoding="utf-8"))
    tot: dict[str, int] = {}
    for item in dados.values():
        chave = item.get("status") or "?"
        tot[chave] = tot.get(chave, 0) + 1
    return tot


CACHE = TX / "_andamento_cache.json"
TAREFAS = (
    ("videos", "Download dos vídeos", ("baixar_videos", "yt-dlp")),
    ("legendas", "Legendas", ("extrair_textos",)),
    ("whisper", "Retranscrição fina", ("retranscrever",)),
)
LOGS = {
    "videos": AC / "VIDEOS" / "_log.txt",
    "legendas": TX / "_log_extracao.txt",
    "whisper": TX / "_log_whisper.txt",
}


def ultima(caminho: Path) -> tuple[str, float]:
    if not caminho.exists():
        return "", 0.0
    dado = caminho.stat()
    with caminho.open("rb") as f:
        f.seek(max(0, dado.st_size - 2500))
        texto = f.read().decode("utf-8", "replace")
    linhas = [ln.strip() for ln in texto.splitlines() if ln.strip() and "it/s" not in ln and "%|" not in ln]
    return (linhas[-1][:180] if linhas else ""), dado.st_mtime


def processos() -> list[tuple[str, int, int]]:
    """(comando resumido, pid, tempo de CPU em unidades de 100 ns) dos processos do acervo."""
    cmd = (
        "Get-CimInstance Win32_Process -Filter \"Name='python.exe' OR Name='yt-dlp.exe' OR Name='ffmpeg.exe'\" "
        "| ForEach-Object { $c = [string]$_.CommandLine; if ($c.Length -gt 160) { $c = $c.Substring(0,160) }; "
        "$c = $c -replace '\\|','/' -replace '\\s+',' '; "
        "'{0}|{1}|{2}' -f $c, $_.ProcessId, ($_.UserModeTime + $_.KernelModeTime) }"
    )
    try:
        r = subprocess.run(["powershell", "-NoProfile", "-Command", cmd], capture_output=True, text=True,
                           encoding="utf-8", errors="replace", timeout=12)
    except Exception:
        return []
    saida = []
    for ln in (r.stdout or "").splitlines():
        partes = ln.strip().split("|")
        if len(partes) != 3:
            continue
        try:
            saida.append((partes[0], int(partes[1]), int(float(partes[2]))))
        except ValueError:
            continue
    return saida


def arquivo_em_gravacao() -> dict | None:
    pasta = AC / "VIDEOS"
    if not pasta.exists():
        return None
    candidatos = [p for p in pasta.iterdir()
                  if p.is_file() and (".part" in p.name or ".temp" in p.name or ".f" in p.name or p.suffix == ".ytdl")]
    if not candidatos:
        return None
    p = max(candidatos, key=lambda x: x.stat().st_mtime)
    return {"arquivo": p.name, "mb": round(p.stat().st_size / 1e6, 2)}


def pulso(cache: dict) -> list[dict]:
    agora = time.time()
    procs = processos()
    anterior = cache.get("cpu") or {}
    cpu_agora: dict[str, int] = {}
    donos: dict[str, bool] = {chave: False for chave, _, _ in TAREFAS}
    delta: dict[str, int] = {chave: 0 for chave, _, _ in TAREFAS}
    for cmd, pid, tempo in procs:
        cpu_agora[str(pid)] = tempo
        dono = ""
        for chave, _, marcas in TAREFAS:
            if any(m in cmd for m in marcas):
                dono = chave
        if "ffmpeg" in cmd:
            dono = "whisper" if "segment" in cmd or ".wav" in cmd else "videos"
        if dono:
            donos[dono] = True
            velho = anterior.get(str(pid))
            if isinstance(velho, int) and tempo >= velho:
                delta[dono] += tempo - velho
    cache["cpu"] = cpu_agora
    gravando = arquivo_em_gravacao()
    vivos = []
    for chave, nome, _ in TAREFAS:
        linha, visto = ultima(LOGS[chave])
        idade = round(agora - visto, 1) if visto else None
        em_pausa = "pausa" in linha.lower()
        cpu = delta[chave] > 1_000_000  # > 0,1 s de CPU desde a leitura anterior
        if chave == "videos" and (gravando or donos[chave]):
            estado = "ativo"
        elif donos[chave] and (cpu or not anterior or (idade is not None and idade < 30)):
            estado = "ativo"
        elif donos[chave] and idade is not None and idade > 180:
            estado = "ocioso"
        elif em_pausa and idade is not None and idade < 150:
            estado = "pausa"
        elif donos[chave]:
            estado = "ativo"
        else:
            estado = "parado"
        item = {"id": chave, "nome": nome, "estado": estado, "visto_em": round(visto, 1), "linha": linha}
        if chave == "videos" and gravando:
            item["arquivo"] = gravando["arquivo"]
            item["mb"] = gravando["mb"]
        if cpu:
            item["cpu"] = True
        vivos.append(item)
    return vivos


def medir() -> dict:
    videos = json.loads((PUB / "data" / "videos.json").read_text(encoding="utf-8"))
    textos = json.loads((PUB / "data" / "textos.json").read_text(encoding="utf-8"))
    off = sum(1 for v in videos if v.get("off"))
    no_ar = len(videos) - off
    extr = status(TX / "_estado_extracao.json")
    whis = status(TX / "_estado_whisper.json")
    mp4 = contar(AC / "VIDEOS", ".mp4")
    gb = round(sum(p.stat().st_size for p in (AC / "VIDEOS").glob("*.mp4")) / 1e9, 2) if (AC / "VIDEOS").exists() else 0
    try:
        cache = json.loads(CACHE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        cache = {}
    agora = time.time()
    if agora - cache.get("medido_em", 0) < 4 and cache.get("dado"):
        fresco = cache["dado"]
        fresco["agora"] = round(agora, 1)
        fresco["em"] = datetime.now().strftime("%H:%M:%S")
        return fresco
    dado = {
        "agora": round(agora, 1),
        "em": datetime.now().strftime("%H:%M:%S"),
        "gb": gb,
        "vivos": pulso(cache),
        "removidos": off,
        "etapas": [
            {"id": "videos", "nome": "Vídeos em MP4 no acervo", "feito": mp4, "total": no_ar,
             "detalhe": f"{gb} GB salvos · o restante não está mais disponível no YouTube"},
            {"id": "seminario", "nome": "Textos integrais do Seminário", "feito": contar(AC / "SEMINARIO" / "textos", ".json"),
             "total": len(textos), "detalhe": "artigos abertos em JSON e Markdown"},
            {"id": "legendas", "nome": "Legendas com marcação de tempo", "feito": extr.get("ok", 0),
             "total": no_ar, "detalhe": f"sem acesso: {extr.get('sem_acesso', 0)} · erros a repetir: {extr.get('erro', 0)}"},
            {"id": "estudo", "nome": "Edição para estudo", "feito": contar(TX / "ESTUDO", ".md"),
             "total": max(contar(TX / "BRUTO", ".json"), contar(TX / "ESTUDO", ".md"), 1),
             "detalhe": "parágrafos com tempo, a partir das legendas e retranscrições já extraídas"},
            {"id": "whisper", "nome": "Retranscrição fina das aulas completas", "feito": whis.get("ok", 0),
             "total": WHISPER_TOTAL + extr.get("sem_legenda", 0) + extr.get("erro", 0),
             "detalhe": f"33 aulas completas + {extr.get('sem_legenda', 0) + extr.get('erro', 0)} vídeos sem legenda "
                        f"ou recusados pelo YouTube, a partir dos MP4 locais · "
                        f"falhas: {whis.get('erro', 0)}"},
            {"id": "cursos", "nome": "Cursos, capas e guias", "feito": contar(AC / "SEMINARIO" / "cursos", ".json") + contar(AC / "SEMINARIO" / "guias", ".json"),
             "total": CURSOS_TOTAL + GUIAS_TOTAL, "detalhe": "30 fichas de curso e 8 guias (parte pública)"},
        ],
    }
    CACHE.write_text(json.dumps({"medido_em": time.time(), "cpu": cache.get("cpu") or {}, "dado": dado},
                               ensure_ascii=False), encoding="utf-8")
    return dado


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    dado = medir()
    destino = PUB / "andamento.json"
    destino.write_text(json.dumps(dado, ensure_ascii=False, indent=1), encoding="utf-8")
    if "--stdout" in sys.argv:
        print(json.dumps(dado, ensure_ascii=False))


if __name__ == "__main__":
    main()
