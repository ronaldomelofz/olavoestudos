"""Biblioteca de estudo: livros da pasta LIVROS, COF transcrito (osescribas, CC0) e artigos da revista Planeta.

Gera ACERVO/BIBLIOTECA/ (local, fora do git):
  _indice.json                 catálogo das três coleções
  cof/<id>.json                aula do COF em HTML, com status de revisão e vídeo ligado
  livros/<slug>.json           texto de cada página dos PDFs (para leitura e busca)
  planeta/<slug>.pdf|.txt      PDF do Internet Archive e o OCR

Uso:
  python scripts/montar_biblioteca.py              tudo (baixa só o que falta)
  python scripts/montar_biblioteca.py --sem-baixar só reconstrói os índices
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

import fitz  # PyMuPDF
import markdown

ROOT = Path(__file__).resolve().parent.parent
LIVROS = ROOT / "LIVROS"
BIB = ROOT / "ACERVO" / "BIBLIOTECA"
COF_REPO = ROOT / "ACERVO" / "COF-ESCRIBAS"
VIDEOS = ROOT / "site" / "public" / "data" / "videos.json"
PLANETA_ITEM = "olavo-de-carvalho-planeta"
UA = {"User-Agent": "Mozilla/5.0 (estudo pessoal; olavoestudos)"}


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def slug(s: str) -> str:
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:90]


def gravar(p: Path, dado) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(dado, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


# ---------------------------------------------------------------- COF


def atualizar_repo() -> None:
    if (COF_REPO / ".git").exists():
        subprocess.run(["git", "-C", str(COF_REPO), "pull", "-q", "--ff-only"], check=False)
    else:
        subprocess.run(["git", "clone", "--depth", "1", "-q", "https://github.com/osescribas/cof.git", str(COF_REPO)], check=True)


def videos_cof() -> dict[int, str]:
    """Número da aula -> id do vídeo do acervo, pelas aulas do COF que têm título numerado."""
    if not VIDEOS.exists():
        return {}
    achados: dict[int, str] = {}
    for v in json.loads(VIDEOS.read_text(encoding="utf-8")):
        t = v["t"]
        if not re.search(r"CursoOnlineDeFilosofia|\bCOF\b|Curso Online de Filosofia", t):
            continue
        m = re.search(r"\b[Aa]ula\s*(\d{1,3})\b", t)
        if m and not v.get("off"):
            achados.setdefault(int(m.group(1)), v["id"])
    return achados


def paragrafar(texto: str, frases_por_par: int = 6) -> str:
    """Divide uma transcrição corrida em parágrafos de algumas frases."""
    frases = re.split(r"(?<=[.!?…])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÀÇ\"“(])", texto.strip())
    pars = [" ".join(frases[i : i + frases_por_par]) for i in range(0, len(frases), frases_por_par)]
    return "\n\n".join(pars)


def montar_cof() -> list[dict]:
    ligados = videos_cof()
    md = markdown.Markdown(extensions=["extra", "sane_lists"])
    aulas = []
    for pasta, status in (("revisadas", "revisada"), ("revisao_pendente", "pendente")):
        for p in sorted((COF_REPO / pasta).glob("*.md")):
            bruto = p.read_text(encoding="utf-8", errors="replace").strip()
            ident = p.stem.lstrip("#")
            pre = ident.startswith("PreCOF")
            num = int(re.sub(r"\D", "", ident) or 0)
            data = None
            titulo = f"Introdução ao COF {num}" if pre else f"Aula {num}"
            if status == "revisada":
                m = re.search(r"\n\s*(\d{1,2}º? de \w+ de \d{4})\s*\n", bruto[:600])
                data = m.group(1) if m else None
                corpo = bruto[m.end():].strip() if m else bruto
            else:
                corpo = paragrafar(bruto) if "\n\n" not in bruto[:4000] else bruto
            html = md.reset().convert(corpo)
            html = re.sub(r"\*\*\\?\[(\d{1,2}:\d{2}(?::\d{2})?)\\?\]\*\*|<strong>\[(\d{1,2}:\d{2}(?::\d{2})?)\]</strong>",
                          lambda m: f'<span class="marca-tempo">{m.group(1) or m.group(2)}</span>', html)
            palavras = len(re.findall(r"\w+", corpo))
            video = None if pre else ligados.get(num)
            aula = {"id": ident, "num": num, "pre": pre, "titulo": titulo, "data": data, "status": status,
                    "palavras": palavras, "video": video}
            gravar(BIB / "cof" / f"{ident}.json", {**aula, "html": html,
                                                   "fonte": f"https://github.com/osescribas/cof/blob/main/{pasta}/{p.name}"})
            aulas.append(aula)
    aulas.sort(key=lambda a: (not a["pre"], a["num"]))
    log(f"COF: {len(aulas)} aulas ({sum(a['status'] == 'revisada' for a in aulas)} revisadas) · "
        f"{sum(bool(a['video']) for a in aulas)} ligadas a vídeos do acervo")
    return aulas


# ---------------------------------------------------------------- Planeta


def baixar(url: str, destino: Path) -> bool:
    if destino.exists() and destino.stat().st_size > 0:
        return False
    destino.parent.mkdir(parents=True, exist_ok=True)
    tmp = destino.with_suffix(destino.suffix + ".part")
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r, open(tmp, "wb") as f:
        while bloco := r.read(1 << 16):
            f.write(bloco)
    tmp.replace(destino)
    return True


def montar_planeta(baixar_arquivos: bool) -> list[dict]:
    meta_p = BIB / "planeta" / "_metadata.json"
    if baixar_arquivos or not meta_p.exists():
        with urllib.request.urlopen(urllib.request.Request(f"https://archive.org/metadata/{PLANETA_ITEM}", headers=UA), timeout=60) as r:
            gravar(meta_p, json.load(r))
    meta = json.loads(meta_p.read_text(encoding="utf-8"))
    grupos: dict[str, dict] = {}
    for f in meta["files"]:
        nome = f["name"]
        m = re.match(r"Olavo de Carvalho_Planeta_Nº (\d+)_(\d{4}-\d{2})_(.+?)( \(original\) \(b\))?(_djvu\.txt|_text\.pdf|\.pdf)$", nome)
        if not m:
            continue
        num, data, titulo, original, tipo = m.groups()
        g = grupos.setdefault(num, {"num": int(num), "data": data, "titulo": titulo.replace("_", " "), "arquivos": {}})
        chave = ("scan" if original or f.get("format") == "Image Container PDF" else "pdf") if tipo == ".pdf" else \
                ("txt_scan" if original else "txt") if tipo == "_djvu.txt" else None
        if chave:
            g["arquivos"].setdefault(chave, nome)
    artigos = []
    for g in sorted(grupos.values(), key=lambda g: g["num"]):
        s = f"planeta-{g['num']:03d}-{slug(g['titulo'])}"
        arq = g["arquivos"]
        saida = {"slug": s, "num": g["num"], "data": g["data"], "titulo": g["titulo"]}
        for chave, ext in (("pdf", ".pdf"), ("scan", "-scan.pdf"), ("txt", ".txt"), ("txt_scan", ".txt")):
            nome = arq.get(chave)
            if not nome or (chave == "txt_scan" and "txt" in arq):
                continue
            destino = BIB / "planeta" / f"{s}{ext}"
            if baixar_arquivos:
                url = f"https://archive.org/download/{PLANETA_ITEM}/{urllib.parse.quote(nome)}"
                try:
                    if baixar(url, destino):
                        log(f"Planeta nº {g['num']}: {destino.name} ({destino.stat().st_size // 1024} KB)")
                        time.sleep(2)
                except Exception as e:  # noqa: BLE001
                    log(f"Planeta nº {g['num']}: falha em {nome}: {e}")
            if destino.exists():
                saida["texto" if chave.startswith("txt") else chave] = destino.name
        if saida.get("texto"):
            saida["palavras"] = len(re.findall(r"\w+", (BIB / "planeta" / saida["texto"]).read_text(encoding="utf-8", errors="replace")))
        artigos.append(saida)
    log(f"Planeta: {len(artigos)} artigos · {sum('pdf' in a or 'scan' in a for a in artigos)} com PDF")
    return artigos


# ---------------------------------------------------------------- Livros (pasta LIVROS)


def titulo_livro(nome: str) -> tuple[str, str | None]:
    base = re.sub(r"\(\d\)$", "", Path(nome).stem).strip()
    base = re.sub(r"[-_]PDF$", "", base, flags=re.I).replace("-", " ") if base.count("-") > 3 else base
    autor = None
    m = re.match(r"(?i)^(olavo de carvalho|carvalho)\s*[-–]\s*(.+)$", base)
    if m:
        autor, base = "Olavo de Carvalho", m.group(2)
    m = re.match(r"^(.+?)\s*[-–(]\s*Olavo de Carvalho\)?$", base)
    if m:
        autor, base = "Olavo de Carvalho", m.group(1)
    base = re.sub(r"\s+", " ", base).strip(" -–")
    return base[:1].upper() + base[1:], autor


# Fichas dos PDFs já presentes em LIVROS (início do nome do arquivo -> título, autor, categoria, ano, idioma).
FICHAS = {
    "A Gnose Tradicionalista": ("A gnose tradicionalista de René Guénon e Olavo de Carvalho", "Flos Carmeli", "Sobre Olavo", None, "pt"),
    "Astrologia e Religião": ("Astrologia e religião", "Olavo de Carvalho", "Obras", None, "pt"),
    "carvalho - o jardim": ("O jardim das aflições", "Olavo de Carvalho", "Obras", 1995, "pt"),
    "Olavo-de-Carvalho-O-Jardim": ("O jardim das aflições (3ª edição, com posfácio)", "Olavo de Carvalho", "Obras", 1995, "pt"),
    "o_jardim_das_aflicoes": ("O jardim das aflições", "Olavo de Carvalho", "Obras", 1995, "pt"),
    "carvalho - o minimo": ("O mínimo que você precisa saber para não ser um idiota", "Olavo de Carvalho", "Obras", 2013, "pt"),
    "o_minimo_que_voce": ("O mínimo que você precisa saber para não ser um idiota", "Olavo de Carvalho", "Obras", 2013, "pt"),
    "Curso Online de Filosofia Aulas": ("Curso Online de Filosofia — aulas 1 a 293 (transcrições)", "Olavo de Carvalho", "COF", None, "pt"),
    "Debate Completo": ("Debate completo entre Olavo de Carvalho e Orlando Fedeli (2001)", "Editora Restauração", "Debates", 2001, "pt"),
    "Eu tenho uma coisa": ("Eu tenho uma coisa que os outros não têm", "Olavo de Carvalho", "Artigos", None, "pt"),
    "O Trauma da Emergência": ("O trauma da emergência da razão", "Olavo de Carvalho", "Artigos", None, "pt"),
    "Olavo de Carvalho - Astros": ("Astros e símbolos", "Olavo de Carvalho", "Obras", 1985, "pt"),
    "Olavo de Carvalho - O Olho do Sol": ("O olho do sol: conhecimento e realidade — a obra metafísica de Olavo de Carvalho", None, "Sobre Olavo", None, "pt"),
    "Olavo de Carvalho.pdf": ("Noua ordine mondială și perversiunile definitorii ale mentalității revoluționare", "Olavo de Carvalho", "Traduções", None, "ro"),
    "as_12_camadas": ("As 12 camadas da personalidade", "Olavo de Carvalho", "Obras", None, "pt"),
    "a_escolastica": ("A escolástica", "Olavo de Carvalho", "Obras", None, "pt"),
    "a_felicidade_geral": ("A felicidade geral da nação", "Olavo de Carvalho", "Obras", None, "pt"),
    "a_filosofia_e_seu_inverso": ("A filosofia e seu inverso", "Olavo de Carvalho", "Obras", 2012, "pt"),
    "a_inversao_revolucionaria": ("A inversão revolucionária em ação", "Olavo de Carvalho", "Obras", 2015, "pt"),
    "a_longa_marcha": ("A longa marcha da vaca para o brejo", "Olavo de Carvalho", "Obras", 1998, "pt"),
    "a_morte_do_pato": ("A morte do pato", "Olavo de Carvalho", "Obras", None, "pt"),
    "a_nova_era_e_a_revolucao": ("A nova era e a revolução cultural", "Olavo de Carvalho", "Obras", 1994, "pt"),
    "i_nova_era_e_a_revolucao": ("A nova era e a revolução cultural (ed. alternativa)", "Olavo de Carvalho", "Obras", 1994, "pt"),
    "a_realidade": ("A realidade", "Olavo de Carvalho", "Obras", None, "pt"),
    "aristoteles_em_nova": ("Aristóteles em nova perspectiva", "Olavo de Carvalho", "Obras", 1996, "pt"),
    "dominador_invisivel": ("O dominador invisível", "Olavo de Carvalho", "Obras", None, "pt"),
    "eua-e-nova-ordem": ("Os EUA e a nova ordem mundial", "Olavo de Carvalho / Aleksandr Dugin", "Obras", 2012, "pt"),
    "filosofia_crista": ("Filosofia cristã", "Olavo de Carvalho", "Obras", None, "pt"),
    "o_imbecil_coletivo.pdf": ("O imbecil coletivo", "Olavo de Carvalho", "Obras", 1996, "pt"),
    "o_imbecil_coletivo_ii": ("O imbecil coletivo II", "Olavo de Carvalho", "Obras", 1998, "pt"),
    "o_imbecil_coletivo_atualidades": ("O imbecil coletivo: atualidades inculturais brasileiras", "Olavo de Carvalho", "Obras", 1996, "pt"),
    "o_imbecil_juvenil": ("O imbecil juvenil", "Olavo de Carvalho", "Obras", None, "pt"),
    "inteligencia_verdade": ("Inteligência, verdade e certeza", "Olavo de Carvalho", "Obras", None, "pt"),
    "maquiavel_ou_a_confusao": ("Maquiavel ou a confusão demoníaca", "Olavo de Carvalho", "Obras", 2011, "pt"),
    "marxismo": ("Marxismo", "Olavo de Carvalho", "Obras", None, "pt"),
    "o_abandono_dos_ideais": ("O abandono dos ideais", "Olavo de Carvalho", "Obras", None, "pt"),
    "o_camarada_enrolevich": ("O camarada Enrolevich", "Olavo de Carvalho", "Obras", None, "pt"),
    "o_futuro_do_pensamento": ("O futuro do pensamento brasileiro", "Olavo de Carvalho", "Obras", 1998, "pt"),
    "o_irracional_superior": ("O irracional superior", "Olavo de Carvalho", "Obras", None, "pt"),
    "o_leao_e_os_ossos": ("O leão e os ossos", "Olavo de Carvalho", "Obras", None, "pt"),
    "rene_guenon": ("René Guénon", "Olavo de Carvalho", "Obras", 1981, "pt"),
    "santo_agostinho": ("Santo Agostinho", "Olavo de Carvalho", "Obras", None, "pt"),
    "sobre_a_arte_de_estudar": ("Sobre a arte de estudar", "Olavo de Carvalho", "Obras", None, "pt"),
}
DUPLICADOS = ("Olavo de Carvalho_Planeta_",)


def ficha(nome: str):
    for prefixo, f in FICHAS.items():
        if nome.startswith(prefixo):
            return f
    titulo, autor = titulo_livro(nome)
    return titulo, autor, "Outros", None, "pt"


def montar_livros() -> list[dict]:
    livros = []
    for p in sorted(LIVROS.glob("*.pdf")):
        if p.name.startswith(DUPLICADOS):
            continue
        s = slug(p.stem)
        destino = BIB / "livros" / f"{s}.json"
        titulo, autor, categoria, ano, lingua = ficha(p.name)
        if destino.exists() and destino.stat().st_mtime >= p.stat().st_mtime:
            dado = json.loads(destino.read_text(encoding="utf-8"))
        else:
            with fitz.open(p) as doc:
                paginas = [pg.get_text("text").strip() for pg in doc]
                info = doc.metadata or {}
            dado = {"slug": s, "arquivo": p.name, "titulo": titulo, "autor": autor or (info.get("author") or None),
                    "paginas": paginas}
            gravar(destino, dado)
            log(f"Livro: {p.name} · {len(paginas)} páginas")
        palavras = sum(len(re.findall(r"\w+", t)) for t in dado["paginas"])
        livros.append({"slug": s, "arquivo": p.name, "titulo": titulo, "autor": autor, "categoria": categoria,
                       "ano": ano, "lingua": lingua,
                       "paginas": len(dado["paginas"]), "mb": round(p.stat().st_size / 1e6, 1), "palavras": palavras,
                       "so_imagem": palavras < 50 * max(1, len(dado["paginas"])) * 0.2})
    log(f"Livros: {len(livros)} PDFs da pasta LIVROS")
    return livros


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--sem-baixar", action="store_true")
    a = ap.parse_args()
    if not a.sem_baixar:
        atualizar_repo()
    indice = {"gerado": time.strftime("%Y-%m-%dT%H:%M:%S"), "cof": montar_cof(),
              "planeta": montar_planeta(not a.sem_baixar), "livros": montar_livros()}
    gravar(BIB / "_indice.json", indice)
    log(f"Índice gravado em {BIB / '_indice.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
