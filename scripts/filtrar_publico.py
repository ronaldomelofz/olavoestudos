# -*- coding: utf-8 -*-
"""Roda no build do Netlify, depois do vite build. O dist público fica sem:
  * vídeos removidos do YouTube (flag off — estudo pessoal, só na versão local);
  * texto integral das aulas (site/public/data/transcricoes).
"""
import json
from pathlib import Path

DIST = Path(__file__).resolve().parent.parent / "site" / "dist" / "data"
videos = json.loads((DIST / "videos.json").read_text(encoding="utf-8"))
ativos = {v["id"] for v in videos if not v.get("off")}
(DIST / "videos.json").write_text(
    json.dumps([v for v in videos if v["id"] in ativos], ensure_ascii=False, separators=(",", ":")),
    encoding="utf-8",
)
playlists = json.loads((DIST / "playlists.json").read_text(encoding="utf-8"))
for p in playlists:
    p["videos"] = [i for i in p["videos"] if i in ativos]
(DIST / "playlists.json").write_text(json.dumps(playlists, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
tx = DIST / "transcricoes"
if tx.exists():
    for arq in tx.glob("*"):
        arq.unlink()
    tx.rmdir()
print(f"público: {len(ativos)} vídeos; {sum(1 for v in videos if v.get('off'))} removidos ficaram de fora")
