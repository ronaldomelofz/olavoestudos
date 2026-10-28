# -*- coding: utf-8 -*-
"""Edição para estudo — texto bruto com tempos -> parágrafos legíveis com marcação [mm:ss].

Adaptação de editar_cientifico.py (Pedro Augusto) para legendas do YouTube:
  * remove ruído de legenda ([Música], hesitações, palavras repetidas por gagueira);
  * corrige nomes próprios recorrentes do vocabulário do Olavo (LEXICO);
  * insere pontuação antes de marcadores discursivos e divide períodos longos;
  * agrupa em parágrafos guiados pelo tempo, preservando o instante de início de cada um;
  * mede a integridade alfabética (texto final / bruto) e recusa edições abaixo de 0,9.
Nada é resumido nem inventado: a edição só pontua, limpa e corrige grafia.

Entrada: TRANSCRICOES/BRUTO/<id>.json
Saída:   TRANSCRICOES/ESTUDO/<id>.md
         site/public/data/transcricoes/<id>.json  e  _indice.json (apenas na versão local do site)
Uso:     python scripts/editar_estudo.py [--refazer] [--ids ID ...]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BRUTO = ROOT / "TRANSCRICOES" / "BRUTO"
ESTUDO = ROOT / "TRANSCRICOES" / "ESTUDO"
SITE = ROOT / "site" / "public" / "data" / "transcricoes"
VERSAO = "estudo-v1"

RUIDO = [
    (r"\[(Música|Aplausos|Risos|Risadas|Applause|Music|Laughter)\]", " "),
    (r"\[\s*_+\s*\]", "[…]"),
    (r"(?i)\b(hã|hum|ahn|ãh|éh|eh|ah)\b[,]?", " "),
]

# Correções de grafia frequentes nas legendas automáticas (nomes e termos do curso).
LEXICO = [
    (r"(?i)\b(georg\s+)?lukash\b", "Lukács"),
    (r"(?i)\bmichel\s+fou(ca|cau|a|lt)?\b", "Michel Foucault"),
    (r"(?i)\bpie(r|rre)\s+bour(dieu|dier|d)?\b", "Pierre Bourdieu"),
    (r"(?i)\bjohn\s+rolls\b", "John Rawls"),
    (r"(?i)\beric\s+(wer|voeg[a-z]*|vog[a-z]*|fogel[a-z]*)\b", "Eric Voegelin"),
    (r"(?i)\b(v|f)o?e?gel(in|im|lin)\b", "Voegelin"),
    (r"(?i)\bharry\s+de\s+monte?ran\b", "Henry de Montherlant"),
    (r"(?i)\blenen\b", "Lênin"),
    (r"(?i)\bla\s?vele?\b", "Lavelle"),
    (r"(?i)\blouis\s+lavel+e?\b", "Louis Lavelle"),
    (r"(?i)\bhus(s)?er(l|ou)\b", "Husserl"),
    (r"(?i)\bgu?[eé]non\b", "Guénon"),
    (r"(?i)\bh?es[ií]odo\b", "Hesíodo"),
    (r"(?i)\bgiovan(ni)?\s+re(ale?)?\b", "Giovanni Reale"),
    (r"(?i)\bcornford\b", "Cornford"),
    (r"\bISO\b", "isso"),
    (r"(?i)\bchu(on|om)\b", "Schuon"),
    (r"(?i)\bmário\s+ferreira\b", "Mário Ferreira"),
    (r"(?i)\barist[oó]teles\b", "Aristóteles"),
    (r"(?i)\bplat[aã]o\b", "Platão"),
    (r"(?i)\bs[oó]crates\b", "Sócrates"),
    (r"(?i)\bmaquiavel\b", "Maquiavel"),
    (r"(?i)\bescola de frankfurt\b", "Escola de Frankfurt"),
    (r"(?i)\bparalax[ea]\s+cognitiva\b", "paralaxe cognitiva"),
    (r"(?i)\bc\s?o\s?f\b", "COF"),
]

MARCADORES = (
    "Então", "Portanto", "Quer dizer", "Ou seja", "Por exemplo", "Pois bem", "No entanto",
    "Por outro lado", "Em primeiro lugar", "Em segundo lugar", "Por fim", "Isto é", "Vejam bem",
)
FORTES = ("Então", "Bom", "Agora", "Pois bem", "Por outro lado", "Em primeiro lugar", "Em segundo lugar", "Por fim")
RE_MARC = re.compile(r"(?<![.!?…:;,])(\s+)(\w+)\s+(" + "|".join(re.escape(m) for m in MARCADORES) + r")\b", re.I)
# Depois destas palavras o marcador continua a frase ("e então", "que por exemplo").
LIGA = {"e", "mas", "que", "é", "como", "ou", "isso", "assim", "nem", "se", "porque", "de", "do", "da", "aí"}


def alfa(s: str) -> int:
    return sum(c.isalpha() for c in s)


def limpar(txt: str) -> str:
    for pat, rep in RUIDO + LEXICO:
        txt = re.sub(pat, rep, txt)
    txt = re.sub(r"(?i)\b(\w{1,12})(\s+\1\b)+", r"\1", txt)
    return re.sub(r"\s{2,}", " ", txt).strip()


def pontuar(txt: str) -> str:
    def quebra(m: re.Match) -> str:
        antes, marc = m.group(2), m.group(3)
        if antes.lower() in LIGA:
            return m.group(0)
        return f"{m.group(1)}{antes}. {marc[0].upper()}{marc[1:]}"

    txt = RE_MARC.sub(quebra, txt)
    txt = re.sub(r"([.!?…]\s+)([a-zà-ÿ])", lambda m: m.group(1) + m.group(2).upper(), txt)
    txt = re.sub(r"\.\s*\.", ".", txt).strip(" .")
    partes = []
    for frase in re.split(r"(?<=[.!?…])\s+", txt):
        partes.extend(dividir(frase))
    out = " ".join(p for p in partes if p)
    if out and out[0].islower():
        out = out[0].upper() + out[1:]
    if out and out[-1] not in ".!?…":
        out += "."
    return out


def dividir(s: str, alvo: int = 320) -> list[str]:
    """Quebra períodos longos (legenda sem pontuação) em conjunções, como split_long_clause do Pedro."""
    s = s.strip()
    out = []
    while len(s) > alvo:
        janela = s[: alvo + 100]
        corte, sep = -1, "."
        for marca, pont in ((" porque ", ","), (" mas ", ","), (" eu ", "."), (" nós ", "."), (" você ", "."),
                            (" isso ", "."), (" a gente ", "."), (" quando ", ","), (" e ", ".")):
            i = janela.rfind(marca, int(alvo * 0.5))
            if i > 0:
                corte, sep = i, pont
                break
        if corte < 0:
            break
        pedaco, s = s[:corte].strip(), s[corte:].strip()
        out.append(pedaco.rstrip(",.") + sep)
        if sep == "." and s:
            s = s[0].upper() + s[1:]
    if s:
        out.append(s if s[-1] in ".!?…" else s + ".")
    return out


def caixa(segs: list[list]) -> dict[str, str]:
    """Maiúsculas espúrias da legenda automática: 'Clara' vira 'clara' se o documento usa mais a minúscula."""
    cont: dict[str, int] = {}
    for _, txt in segs:
        for w in re.findall(r"\b\w+\b", txt):
            cont[w] = cont.get(w, 0) + 1
    return {w: w.lower() for w, c in cont.items()
            if w[0].isupper() and len(w) > 1 and not w.isupper() and cont.get(w.lower(), 0) >= c}


def paragrafos(segs: list[list], minimo: int = 600, maximo: int = 1300) -> list[list]:
    """Agrupa segmentos; fecha o parágrafo num marcador forte depois de `minimo` caracteres,
    ou, passado `maximo`, no primeiro segmento que começa por palavra de início de período."""
    baixa = caixa(segs)
    inicio = ("e", "mas", "porque", "isso", "essa", "esse", "eu", "nós", "o que", "quer dizer", "ou seja",
              "por exemplo", "aqui", "agora", "então", "bom")
    blocos, buf, t0, n = [], [], None, 0
    for t, txt in segs:
        txt = limpar(re.sub(r"\b\w+\b", lambda m: baixa.get(m.group(0), m.group(0)), txt))
        if not txt:
            continue
        low = txt.lower()
        forte = any(low.startswith(m.lower() + " ") for m in FORTES)
        brando = any(low.startswith(m + " ") for m in inicio)
        if buf and ((n >= minimo and forte) or (n >= maximo and brando) or n >= maximo * 1.6):
            blocos.append([t0, " ".join(buf)])
            buf, n = [], 0
        if not buf:
            t0 = t
        buf.append(txt)
        n += len(txt) + 1
    if buf:
        blocos.append([t0, " ".join(buf)])
    return [[round(t), pontuar(limpar(x))] for t, x in blocos]


def mmss(t: float) -> str:
    t = int(t)
    return f"{t // 3600}:{t % 3600 // 60:02d}:{t % 60:02d}" if t >= 3600 else f"{t // 60:02d}:{t % 60:02d}"


def markdown(d: dict, pars: list[list], integ: float) -> str:
    url = f"https://www.youtube.com/watch?v={d['id']}"
    corpo = "\n\n".join(f"**[{mmss(t)}]({url}&t={t}s)** {p}" for t, p in pars)
    titulo = (d.get("titulo") or d["id"]).replace('"', "'")
    return f"""---
title: "{titulo}"
video_id: {d['id']}
url: {url}
canal: {d.get('canal') or ''}
duration_s: {d.get('duracao') or ''}
fonte_texto: {d.get('fonte_texto')}
editor: {VERSAO}
integridade: {integ}
paragrafos: {len(pars)}
editado_em: {datetime.now().isoformat(timespec='seconds')}
---

# {d.get('titulo') or d['id']}

**Edição para estudo** · Olavo de Carvalho (fala transcrita)
Fonte: [{d['id']}]({url}) · canal {d.get('canal') or '—'} · {mmss(d.get('duracao') or 0)}
Texto de origem: {d.get('fonte_texto')} · integridade alfabética **{integ}** · {len(pars)} parágrafos

> Transcrição automática de fala oral, pontuada e paragrafada para leitura, sem resumo nem acréscimos.
> Pode conter erros de reconhecimento; confira a passagem no vídeo pelo marcador de tempo.
> Não constitui publicação autorizada do autor; uso pessoal de estudo.

---

{corpo}

---

*{VERSAO} · origem TRANSCRICOES/BRUTO/{d['id']}.json*
"""


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--refazer", action="store_true")
    ap.add_argument("--ids", nargs="*")
    a = ap.parse_args()
    ESTUDO.mkdir(parents=True, exist_ok=True)
    SITE.mkdir(parents=True, exist_ok=True)

    ok = pulados = recusados = 0
    for f in sorted(BRUTO.glob("*.json")):
        d = json.loads(f.read_text(encoding="utf-8"))
        if a.ids and d["id"] not in a.ids:
            continue
        destino = SITE / f"{d['id']}.json"
        if destino.exists() and not a.refazer and destino.stat().st_mtime >= f.stat().st_mtime:
            pulados += 1
            continue
        bruto = " ".join(s[1] for s in d["segs"])
        pars = paragrafos(d["segs"])
        limpo_ref = limpar(bruto)
        integ = round(alfa(" ".join(p for _, p in pars)) / max(1, alfa(limpo_ref)), 4)
        if not pars or integ < 0.9:
            recusados += 1
            print(f"RECUSADO {d['id']} integridade={integ}")
            continue
        (ESTUDO / f"{d['id']}.md").write_text(markdown(d, pars, integ), encoding="utf-8")
        destino.write_text(json.dumps({"id": d["id"], "fonte": d.get("fonte_texto"), "ed": VERSAO,
                                       "integ": integ, "p": pars}, ensure_ascii=False, separators=(",", ":")),
                           encoding="utf-8")
        ok += 1
        print(f"OK {d['id']} {len(pars)} parágrafos · integridade {integ} · {(d.get('titulo') or '')[:60]}")

    indice = {}
    for f in sorted(BRUTO.glob("*.json")):
        if (SITE / f.name).exists():
            d = json.loads(f.read_text(encoding="utf-8"))
            indice[d["id"]] = {"palavras": d.get("palavras"), "fonte": d.get("fonte_texto")}
    (SITE / "_indice.json").write_text(json.dumps(indice, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Fim: editados={ok} pulados={pulados} recusados={recusados} · índice com {len(indice)} textos")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
