# Olavo de Carvalho — Estudos

Portal de estudo do acervo do Professor Olavo de Carvalho.

- Site: https://olvaoestudos.netlify.app
- Código: https://github.com/ronaldomelofz/olavoestudos (o Netlify publica a partir da branch `main`; o filtro do build deixa de fora os vídeos removidos e o texto integral)
- Andamento ao vivo: `ESTUDAR-LOCAL.bat` e a página Andamento
- Painel Netlify: https://app.netlify.com/projects/olvaoestudos
- Memória: `../MEMORIA-ESTUDOS/Projetos/Professor-Olavo.md`

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `data/raw/` | Catálogo bruto: abas do canal (`videos`, `streams`, `playlists`), `pl/` (itens de cada playlist), `meta/` (metadados por vídeo), `site/seminario.json` (cursos, guias, temas, textos) |
| `data/catalogo.json` | Resumo numérico da última montagem |
| `scripts/curadoria.py` | Trilhas, conceitos, plano de 12 semanas e livros (conteúdo autoral) |
| `scripts/baixar_metadados.py` | Metadados completos de cada vídeo via yt-dlp (retomável) |
| `scripts/montar_dados.py` | Gera `site/public/data/*.json` |
| `scripts/fontes.py` | Coleções complementares de outros canais (brutos em `data/raw/extra/`) |
| `scripts/extrair_textos.py` | Fase A: legendas do YouTube com tempo → `TRANSCRICOES/BRUTO/` |
| `scripts/retranscrever.py` | Fase B: Whisper small nas aulas completas e nos vídeos sem legenda |
| `scripts/editar_estudo.py` | Edição para estudo → `TRANSCRICOES/ESTUDO/<id>.md` e `site/public/data/transcricoes/` |
| `scripts/publicar.ps1` | Build + deploy sem os textos integrais (`-ComTextos` para incluí-los) |
| `site/` | Vite + React |

## Acervo local (`ACERVO/`)

Todo o material fica salvo na pasta do projeto, e a versão local do site (`ESTUDAR-LOCAL.bat`) o lê
diretamente pelo endereço `/acervo` (servido pelo próprio Vite, com avanço no vídeo):

| Pasta | Conteúdo | Script |
|---|---|---|
| `ACERVO/VIDEOS/` | `<id>.mp4` (H.264 até 480p, áudio original pt), `<id>.jpg`, `<id>.info.json` | `scripts/baixar_videos.py` |
| `ACERVO/SEMINARIO/textos/` | 2.460 textos integrais (`.json` com HTML limpo e `.md`) | `scripts/baixar_textos.py` |
| `ACERVO/SEMINARIO/guias/` | 8 guias (só a parte pública: são pagos) | idem |
| `ACERVO/SEMINARIO/cursos/` | 30 fichas de curso com módulos e sumário das aulas (811) | idem |
| `ACERVO/SEMINARIO/imagens/` | capas | idem |
| `ACERVO/_indice.json` | índice gerado por `montar_dados.py` | |

`BAIXAR-ACERVO.bat` retoma os dois downloads (vídeos: pausa de 20 s, cerca de 65–75 GB no total).
Enquanto um vídeo não estiver salvo, o site usa o player do YouTube. Aulas pagas do Seminário
(vídeos, áudios no SoundCloud, apostilas) não entram no acervo.

O site publicado na Netlify continua sem o acervo: ele não comporta dezenas de GB e o material é
protegido por direitos autorais.

## Texto das aulas

Método herdado do projeto Pedro Augusto (`../PEDRO-AUGUSTO/scripts`), lento e retomável:

1. `EXTRAIR-TEXTOS.bat` — legendas (manual pt > automática `pt-orig`) pelo cliente `web_embedded`;
   pausa de 8 s por vídeo e 60 s a cada 10; para sozinho se o YouTube bloquear. Depois edita e
   remonta os dados.
2. `RETRANSCREVER-FINO.bat` — Whisper small (≈ 30 min por hora de aula, prioridade baixa) nas 33
   aulas completas e depois nos vídeos sem legenda. A legenda anterior fica em `BRUTO/_legenda/`.
3. `ESTUDAR-LOCAL.bat` — abre a versão local (http://localhost:4173) com a seção "Texto da aula":
   tempo clicável, busca no texto e botão "citar" para as anotações.

O site público (`scripts\publicar.ps1`) não inclui o texto integral: as aulas são obra protegida e
o espólio pede a remoção de cópias no YouTube.

## Atualizar o catálogo

```powershell
cd PROFESSOR-OLAVO
yt-dlp --flat-playlist -J https://www.youtube.com/@opropriolavodecarvalho/videos > data\raw\videos.json
yt-dlp --flat-playlist -J https://www.youtube.com/@opropriolavodecarvalho/streams > data\raw\streams.json
yt-dlp --flat-playlist -J https://www.youtube.com/@opropriolavodecarvalho/playlists > data\raw\playlists.json
# (playlists individuais em data\raw\pl\<id>.json e a lista de IDs em data\raw\all_ids.txt)
python scripts\baixar_metadados.py 3 1.5
python scripts\montar_dados.py
powershell -File scripts\publicar.ps1
```

O índice do Seminário (`data/raw/site/seminario.json`) vem da API pública do site, que fica atrás do
Cloudflare e só responde pelo navegador. O `robots.txt` do site declara `use=reference`: por isso o
portal guarda apenas título, data, descrição curta e link, e a leitura integral é feita no site oficial.

## Observações

- A playlist "Meus vídeos" do canal contém vídeos de terceiros; `montar_dados.py` descarta tudo que
  não é do canal `UC6RQhzm93SterWntL7GzqYQ`.
- O YouTube bloqueia (anti-bot) com muitas requisições; o cliente `web_safari` evita o bloqueio.
- O caderno (assistidos, favoritos, anotações) fica no `localStorage` do navegador; exporte pelo menu Caderno.
