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
    bruto = contar(TX / "BRUTO", ".json")
    estudo = contar(TX / "ESTUDO", ".md")
    # Meta dos vídeos: tudo o que já está em MP4 (inclui avulsos baixados depois do catálogo).
    meta_videos = max(mp4, no_ar, 1)
    # Whisper: só conta alvos que têm (ou tiveram) arquivo local; falhas sem MP4 saem da meta.
    whis_ok = whis.get("ok", 0)
    whis_erro = whis.get("erro", 0)
    whis_sem_arquivo = 0
    if (TX / "_estado_whisper.json").exists():
        for vid, item in json.loads((TX / "_estado_whisper.json").read_text(encoding="utf-8")).items():
            if item.get("status") == "erro" and not (AC / "VIDEOS" / f"{vid}.mp4").exists():
                whis_sem_arquivo += 1
    mp4_ids = {p.stem for p in (AC / "VIDEOS").glob("*.mp4")} if (AC / "VIDEOS").exists() else set()
    bruto_ids = {p.stem for p in (TX / "BRUTO").glob("*.json")} if (TX / "BRUTO").exists() else set()
    whis_pendentes = len(mp4_ids - bruto_ids)
    whis_total = max(whis_ok + whis_pendentes + max(0, whis_erro - whis_sem_arquivo), WHISPER_TOTAL, 1)
    bib = AC / "BIBLIOTECA"
    cof_n = contar(bib / "cof", ".json")
    livros_n = contar(bib / "livros", ".json")
    planeta_n = len({p.stem.split(".")[0] for p in (bib / "planeta").glob("planeta-*.pdf")}) if (bib / "planeta").exists() else 0
    if not planeta_n and (bib / "_indice.json").exists():
        try:
            planeta_n = len(json.loads((bib / "_indice.json").read_text(encoding="utf-8")).get("planeta") or [])
        except (OSError, json.JSONDecodeError):
            planeta_n = 0
    dado = {
        "agora": round(agora, 1),
        "em": datetime.now().strftime("%H:%M:%S"),
        "gb": gb,
        "vivos": pulso(cache),
        "removidos": off,
        "etapas": [
            {"id": "videos", "nome": "Vídeos em MP4 no acervo", "feito": mp4, "total": meta_videos,
             "detalhe": f"{gb} GB salvos · {off} só para estudo pessoal (sem arquivo no YouTube)"},
            {"id": "seminario", "nome": "Textos integrais do Seminário", "feito": contar(AC / "SEMINARIO" / "textos", ".json"),
             "total": len(textos), "detalhe": "artigos abertos em JSON e Markdown"},
            {"id": "legendas", "nome": "Legendas com marcação de tempo", "feito": extr.get("ok", 0),
             "total": meta_videos,
             "detalhe": f"sem acesso: {extr.get('sem_acesso', 0)} · erros a repetir: {extr.get('erro', 0)} · "
                        f"o restante sai do Whisper a partir do MP4"},
            {"id": "estudo", "nome": "Edição para estudo", "feito": estudo,
             "total": max(bruto, estudo, 1),
             "detalhe": "parágrafos com tempo, a partir das legendas e retranscrições já extraídas"},
            {"id": "whisper", "nome": "Retranscrição a partir dos MP4", "feito": whis_ok,
             "total": whis_total,
             "detalhe": f"pendentes com MP4: {whis_pendentes} · "
                        f"falhas sem arquivo: {whis_sem_arquivo} · outras falhas: {max(0, whis_erro - whis_sem_arquivo)}"},
            {"id": "cof", "nome": "COF transcrito (osescribas)", "feito": cof_n, "total": max(cof_n, 589),
             "detalhe": "aulas em Markdown/HTML na biblioteca local"},
            {"id": "livros", "nome": "Livros e escritos (PDFs)", "feito": livros_n,
             "total": max(livros_n, contar(ROOT / "LIVROS", ".pdf")),
             "detalhe": "pasta LIVROS + texto por página para leitura e busca"},
            {"id": "planeta", "nome": "Artigos da revista Planeta", "feito": planeta_n, "total": max(planeta_n, 18),
             "detalhe": "PDFs e OCR do Internet Archive"},
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
