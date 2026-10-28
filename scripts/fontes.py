"""Fontes complementares (outros canais) incorporadas ao acervo.

Cada fonte vira uma coleção no site. Os vídeos destas fontes entram mesmo que não sejam do canal
oficial; o resto do canal oficial continua filtrado por CANAL em montar_dados.py.
Arquivos brutos em data/raw/extra/ (listagem --flat-playlist -J ou metadados -j para avulsos).
"""

import json
from pathlib import Path


def entradas(raw_extra: Path, fonte: dict) -> list[dict]:
    """Entradas (id, title, duration, ...) de uma fonte, na ordem original."""
    arquivos = fonte["arquivo"] if isinstance(fonte["arquivo"], list) else [fonte["arquivo"]]
    saida = []
    for nome in arquivos:
        d = json.loads((raw_extra / nome).read_text(encoding="utf-8"))
        saida.extend([e for e in d["entries"] if e] if d.get("entries") is not None else [d])
    return saida


FONTES_EXTRA = [
    {
        "id": "PL52ZkoPcWL64AIbTB1UCCdwlW1oMeDJvN",
        "arquivo": "pl-PL52ZkoPcWL64AIbTB1UCCdwlW1oMeDJvN.json",
        "titulo": "História Essencial da Filosofia (2002–2003)",
        "origem": "Smile Clever",
        "url": "https://www.youtube.com/playlist?list=PL52ZkoPcWL64AIbTB1UCCdwlW1oMeDJvN",
        "trilha": "mestres",
    },
    {
        "id": "PLmZYHLd2ows_CL5LYDqMyFxgXbEEkHcR5",
        "arquivo": "pl-PLmZYHLd2ows_CL5LYDqMyFxgXbEEkHcR5.json",
        "titulo": "Seminário de Filosofia",
        "origem": "Preston",
        "url": "https://www.youtube.com/playlist?list=PLmZYHLd2ows_CL5LYDqMyFxgXbEEkHcR5",
        "trilha": None,
    },
    {
        "id": "PLZ7ZiwzkjKE4SiZ-BB1SdpjfdICYbVldT",
        "arquivo": "pl-PLZ7ZiwzkjKE4SiZ-BB1SdpjfdICYbVldT.json",
        "titulo": "COF — aulas públicas em ordem cronológica",
        "origem": "Josué Cavalcante",
        "url": "https://www.youtube.com/playlist?list=PLZ7ZiwzkjKE4SiZ-BB1SdpjfdICYbVldT",
        "trilha": "vida-intelectual",
    },
    {
        "id": "PLZ7ZiwzkjKE54HFqg6NitkQ-w6sDpOmTF",
        "arquivo": "pl-PLZ7ZiwzkjKE54HFqg6NitkQ-w6sDpOmTF.json",
        "titulo": "Entrevistas de Olavo de Carvalho",
        "origem": "Josué Cavalcante",
        "url": "https://www.youtube.com/playlist?list=PLZ7ZiwzkjKE54HFqg6NitkQ-w6sDpOmTF",
        "trilha": None,
    },
    {
        "id": "PLZ7ZiwzkjKE5MUpIjnryYBFYq7-tPjSbj",
        "arquivo": "pl-PLZ7ZiwzkjKE5MUpIjnryYBFYq7-tPjSbj.json",
        "titulo": "True Outspeak",
        "origem": "Josué Cavalcante",
        "url": "https://www.youtube.com/playlist?list=PLZ7ZiwzkjKE5MUpIjnryYBFYq7-tPjSbj",
        "trilha": "politica",
    },
    {
        "id": "canal-cursoonlinedefilosofia",
        "arquivo": "cof-videos.json",
        "titulo": "Canal Curso Online de Filosofia",
        "origem": "@cursoonlinedefilosofia",
        "url": "https://www.youtube.com/@cursoonlinedefilosofia",
        "trilha": "vida-intelectual",
    },
    {
        "id": "PL04bwAw9nF3ZfJydE6yhZtDMyQOsnCF7e",
        "arquivo": "pl-PL04bwAw9nF3ZfJydE6yhZtDMyQOsnCF7e.json",
        "titulo": "Olavo [REMASTER] — Aulas completas",
        "origem": "@OlavoREMASTER",
        "url": "https://www.youtube.com/playlist?list=PL04bwAw9nF3ZfJydE6yhZtDMyQOsnCF7e",
        "trilha": None,
    },
    {
        "id": "PL04bwAw9nF3ZM3AzbOcwFe5g2XJj9NMDb",
        "arquivo": "pl-PL04bwAw9nF3ZM3AzbOcwFe5g2XJj9NMDb.json",
        "titulo": "Olavo [REMASTER] — Remasterizados",
        "origem": "@OlavoREMASTER",
        "url": "https://www.youtube.com/playlist?list=PL04bwAw9nF3ZM3AzbOcwFe5g2XJj9NMDb",
        "trilha": None,
    },
    {
        "id": "canal-olavoremaster",
        "arquivo": "remaster-videos.json",
        "titulo": "Canal Olavo [REMASTER]",
        "origem": "@OlavoREMASTER",
        "url": "https://www.youtube.com/@OlavoREMASTER",
        "trilha": None,
    },
    {
        "id": "avulsos",
        "arquivo": ["avulso-G694yNnpeVg.json", "avulso-Tog9FgT_85E.json"],
        "titulo": "Aulas avulsas",
        "origem": "Adriel Chaves",
        "url": None,
        "trilha": "vida-intelectual",
    },
]
