"""Monta os JSON do site a partir do catálogo bruto (YouTube + Seminário) e da curadoria.

Entrada: data/raw/{videos,streams,playlists}.json, data/raw/pl/*.json, data/raw/meta/*.json,
         data/raw/site/seminario.json
Saída:   site/public/data/{videos,playlists,textos,seminario,curadoria}.json e data/catalogo.json
"""
import json
import re
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "site" / "public" / "data"
sys.path.insert(0, str(ROOT / "scripts"))
from curadoria import CONCEITOS, LIVROS, PLANO, TRILHAS  # noqa: E402
from fontes import FONTES_EXTRA, entradas  # noqa: E402

TRANSCRICOES = OUT / "transcricoes"

CANAL = "UC6RQhzm93SterWntL7GzqYQ"
ORDEM_PLAYLISTS = [
    "Curso Online de Filosofia (COF)", "Trechos do COF", "Hangouts", "Entrevistas",
    "Meus vídeos", "English", "Aniversário de 15 Anos do COF", "Especial Prometam Ser", "Promoções",
]
RUIDO_DESC = re.compile(
    r"https?://|www\.|inscreva|seja um aluno|seminariodefilosofia|instagram|facebook|telegram|"
    r"twitter|whatsapp|hotmart|cupom|link na bio|^#|^\W*$",
    re.I,
)
EN = re.compile(
    r"\b(the|you|your|what|why|how|is|are|of|and|who|this|that|don't|can't|never|would|should|"
    r"does|do|it|to|with|from|about|be|was|were|his|their|not|an|in|on|for)\b",
    re.I,
)
PT = re.compile(r"\b(os|as|que|não|nao|de|do|da|dos|das|em|um|uma|por|para|você|voce|é|no|na|com|se)\b", re.I)
ASSINATURA = re.compile(r"\|?\s*olavo de carvalho", re.I)


def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", s or "")
    return "".join(c for c in s if unicodedata.category(c) != "Mn").lower()


def carregar(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


def limpar_desc(desc: str, limite: int = 1400) -> str:
    linhas = [l.strip() for l in (desc or "").splitlines()]
    uteis = [l for l in linhas if l and not RUIDO_DESC.search(l)]
    return "\n".join(uteis)[:limite].strip()


def idioma(titulo: str, desc: str, pls: list[str], declarado: str | None) -> str:
    if "English" in pls:
        return "en"
    if declarado:
        return "en" if declarado.startswith("en") else "pt"
    amostra = ASSINATURA.sub(" ", f"{titulo} {desc[:300]}")
    en, pt = len(EN.findall(amostra)), len(PT.findall(amostra))
    if re.search(r"[ãõçéêáíóú]", amostra, re.I):
        pt += 2
    return "en" if en > pt + 1 else "pt"


def pontuar(texto_titulo: str, texto_tags: str, texto_desc: str, chaves: list[str]) -> int:
    pontos = 0
    for k in chaves:
        if k in texto_titulo:
            pontos += 3
        if k in texto_tags:
            pontos += 2
        if k in texto_desc:
            pontos += 1
    return pontos


def classificar(titulo: str, tags: str, desc: str) -> tuple[list[str], list[str]]:
    t, g, d = norm(f" {titulo} "), norm(f" {tags} "), norm(f" {desc[:600]} ")
    notas = sorted(
        ((pontuar(t, g, d, tr["chaves"]), tr["id"]) for tr in TRILHAS), reverse=True
    )
    trilhas = [i for p, i in notas[:2] if p >= 3] or [i for p, i in notas[:1] if p >= 1]
    conceitos = [c["id"] for c in CONCEITOS if any(k in t or k in d for k in c["chaves"])]
    return trilhas, conceitos


def data_iso(upload_date: str | None, timestamp: int | None) -> str | None:
    if upload_date:
        return f"{upload_date[:4]}-{upload_date[4:6]}-{upload_date[6:]}"
    if timestamp:
        return datetime.fromtimestamp(timestamp, timezone.utc).strftime("%Y-%m-%d")
    return None


def montar_videos():
    flat, abas = {}, {}
    for aba in ("videos", "streams"):
        for e in carregar(RAW / f"{aba}.json")["entries"]:
            flat[e["id"]] = e
            abas[e["id"]] = aba
    playlists, membros = [], {}
    for f in (RAW / "pl").glob("*.json"):
        d = carregar(f)
        ids = [e["id"] for e in d["entries"]]
        for e in d["entries"]:
            flat.setdefault(e["id"], e)
            membros.setdefault(e["id"], []).append(d["id"])
        playlists.append({
            "id": d["id"], "titulo": d["title"], "descricao": limpar_desc(d.get("description") or "", 400),
            "videos": ids,
        })
    playlists.sort(key=lambda p: ORDEM_PLAYLISTS.index(p["titulo"]) if p["titulo"] in ORDEM_PLAYLISTS else 99)

    externos, trilha_fonte = set(), {}
    for f in FONTES_EXTRA:
        ids = []
        for e in entradas(RAW / "extra", f):
            if e.get("id") in ids:
                continue
            ids.append(e["id"])
            flat.setdefault(e["id"], e)
            membros.setdefault(e["id"], []).append(f["id"])
            externos.add(e["id"])
            if f["trilha"]:
                trilha_fonte.setdefault(e["id"], f["trilha"])
        playlists.append({"id": f["id"], "titulo": f["titulo"], "descricao": "", "videos": ids,
                          "origem": f["origem"], "url": f["url"]})
    nome_pl = {p["id"]: p["titulo"] for p in playlists}
    est = ROOT / "TRANSCRICOES" / "_estado_extracao.json"
    removidos = {i for i, s in carregar(est).items() if s.get("status") in ("sem_acesso", "indisponivel")} if est.exists() else set()
    baixados = ROOT / "ACERVO" / "VIDEOS"
    if (baixados / "_estado.json").exists():
        removidos |= {i for i, s in carregar(baixados / "_estado.json").items()
                      if s.get("status") == "indisponivel" and not (baixados / f"{i}.mp4").exists()}

    videos = []
    for vid, e in flat.items():
        mp = RAW / "meta" / f"{vid}.json"
        m = carregar(mp) if mp.exists() else {}
        titulo = m.get("title") or e.get("title") or ""
        if not titulo.strip() or titulo in ("[Private video]", "[Deleted video]"):
            continue
        canal = m.get("channel_id") or e.get("channel_id")
        if canal and canal != CANAL and vid not in externos:
            continue
        externo = vid in externos and canal != CANAL
        desc = limpar_desc(m.get("description") or "")
        tags = " ".join(m.get("tags") or [])
        pls = [p for p in membros.get(vid, []) if canal in (CANAL, None) or p in {f["id"] for f in FONTES_EXTRA}]
        trilhas, conceitos = classificar(titulo, tags, "" if externo else desc)
        if not trilhas and vid in trilha_fonte:
            trilhas = [trilha_fonte[vid]]
        dur = m.get("duration") or e.get("duration") or 0
        videos.append({
            "id": vid,
            "t": titulo,
            "d": data_iso(m.get("upload_date"), e.get("timestamp")),
            "dur": int(dur),
            "v": m.get("view_count") or e.get("view_count") or 0,
            "aba": abas.get(vid, "playlist"),
            "live": (m.get("live_status") == "was_live") or abas.get(vid) == "streams",
            "pl": pls,
            "lang": idioma(titulo, desc, [nome_pl[p] for p in pls], m.get("language")),
            "desc": "" if externo else desc,
            "ch": m.get("chapters") or [],
            "tr": trilhas,
            "co": conceitos,
            **({"ext": True} if externo else {}),
            **({"off": True} if vid in removidos else {}),
        })
    videos.sort(key=lambda v: v["d"] or "0000", reverse=True)
    em = {v["id"]: set(v["pl"]) for v in videos}
    for p in playlists:
        p["videos"] = [i for i in p["videos"] if p["id"] in em.get(i, ())]
    return videos, playlists


def montar_seminario():
    s = carregar(RAW / "site" / "seminario.json")
    temas = {str(t["id"]): t["tag"] for t in s["topics"]}
    textos = []
    for a in s["articles"]:
        trilhas, conceitos = classificar(a["title"], "", a["desc"])
        textos.append({
            "id": a["id"], "t": a["title"].strip(), "s": a["slug"], "d": (a["date"] or "")[:10],
            "tipo": "artigo" if a["type"] == 1 else "texto",
            "temas": [temas[x] for x in (a["tags"] or []) if x in temas],
            "au": None if a["author"] == "Olavo de Carvalho" else a["author"],
            "desc": a["desc"][:220], "views": a["views"], "tr": trilhas, "co": conceitos,
        })
    seminario = {
        "cursos": [{"slug": c["slug"], "titulo": c["title"], "desc": c["desc"]} for c in s["courses"]],
        "guias": [
            {"slug": g["slug"], "titulo": g["title"], "autor": g["author"], "desc": g["desc"], "data": g["date"][:10]}
            for g in s["guides"]
        ],
        "aulas": s["lessons"],
        "temas": s["topics"],
    }
    return textos, seminario


def montar_acervo() -> dict:
    """Índice do material salvo em ACERVO/ — lido só pela versão local do site (/acervo/_indice.json)."""
    acervo = ROOT / "ACERVO"
    vids = acervo / "VIDEOS"
    sem = acervo / "SEMINARIO"
    indice = {
        "videos": sorted(p.stem for p in vids.glob("*.mp4")) if vids.exists() else [],
        "miniaturas": sorted(p.stem for p in vids.glob("*.jpg")) if vids.exists() else [],
        "textos": sorted(p.stem for p in (sem / "textos").glob("*.json")) if sem.exists() else [],
        "guias": sorted(p.stem for p in (sem / "guias").glob("*.json")) if sem.exists() else [],
        "cursos": {},
        "gerado": datetime.now().isoformat(timespec="seconds"),
    }
    for p in (sem / "cursos").glob("*.json") if sem.exists() else []:
        c = carregar(p)
        indice["cursos"][c["slug"]] = {
            "id": c["courses_id"], "capa": c.get("capa_local"),
            "modulos": [{"nome": m["module_name"],
                         "aulas": [[a.get("title") or "", a.get("small_description") or ""] for a in m.get("lessons") or []]}
                        for m in c.get("modules") or []],
        }
    if acervo.exists():
        (acervo / "_indice.json").write_text(json.dumps(indice, ensure_ascii=False, separators=(",", ":")),
                                             encoding="utf-8")
    return {"videos_locais": len(indice["videos"]), "textos_locais": len(indice["textos"]),
            "cursos_locais": len(indice["cursos"])}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    videos, playlists = montar_videos()
    textos, seminario = montar_seminario()
    curadoria = {"trilhas": TRILHAS, "conceitos": CONCEITOS, "plano": PLANO, "livros": LIVROS,
                 "gerado": datetime.now().strftime("%Y-%m-%d")}
    for nome, dado in (("videos", videos), ("playlists", playlists), ("textos", textos),
                       ("seminario", seminario), ("curadoria", curadoria)):
        (OUT / f"{nome}.json").write_text(json.dumps(dado, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    com_meta = sum(1 for v in videos if v["desc"] or v["ch"])
    resumo = {
        "videos": len(videos), "com_descricao": com_meta, "lives": sum(v["live"] for v in videos),
        "ingles": sum(v["lang"] == "en" for v in videos), "playlists": len(playlists),
        "textos": len(textos), "cursos": len(seminario["cursos"]), "guias": len(seminario["guias"]),
        "por_trilha": {t["id"]: {"videos": sum(t["id"] in v["tr"] for v in videos),
                                 "textos": sum(t["id"] in x["tr"] for x in textos)} for t in TRILHAS},
        "sem_trilha": sum(not v["tr"] for v in videos),
        "externos": sum(bool(v.get("ext")) for v in videos),
        **montar_acervo(),
        "com_transcricao": sum(p.name != "_indice.json" for p in TRANSCRICOES.glob("*.json")) if TRANSCRICOES.exists() else 0,
    }
    (ROOT / "data" / "catalogo.json").write_text(json.dumps(resumo, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(resumo, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
