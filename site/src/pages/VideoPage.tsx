import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Carregando, Externo, VideoGrid } from '../components/Cards'
import { alternarFavorito, alternarVisto, salvarNota, useCaderno } from '../lib/caderno'
import {
  dataBR,
  duracao,
  milhar,
  normalizar,
  thumb,
  urlYoutube,
  useData,
  useIndiceTextos,
  useTranscricao,
  videoLocal,
} from '../lib/data'

function tempo(seg: number): string {
  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60)
  const s = String(seg % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

const INICIAIS = 6

function TextoAula({ id, irPara, citar }: { id: string; irPara: (t: number) => void; citar: (t: number, p: string) => void }) {
  const tx = useTranscricao(id, true)
  const [busca, setBusca] = useState('')
  const [tudo, setTudo] = useState(false)

  if (tx === undefined) return <p className="texto-meta">Carregando o texto…</p>
  if (!tx) return null

  const termo = normalizar(busca.trim())
  const achados = termo ? tx.p.filter(([, p]) => normalizar(p).includes(termo)) : tx.p
  const visiveis = termo || tudo ? achados : achados.slice(0, INICIAIS)

  return (
    <section className="bloco texto-aula" id="texto">
      <h2>Texto da aula</h2>
      <p className="texto-meta">
        Transcrição de estudo ({tx.fonte}), pontuada e dividida em parágrafos sem resumo nem acréscimos. Clique no
        tempo para ouvir a passagem; confira no áudio antes de citar.
      </p>
      <input
        type="search"
        placeholder="Procurar no texto da aula…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        aria-label="Procurar no texto da aula"
      />
      {termo && <p className="texto-meta">{achados.length} parágrafo(s) com “{busca.trim()}”</p>}
      {visiveis.map(([t, p]) => (
        <p key={t} className="paragrafo-aula">
          <button className="tempo" onClick={() => irPara(t)} title="Ouvir a partir daqui">
            {tempo(t)}
          </button>{' '}
          {p}{' '}
          <button className="citar" onClick={() => citar(t, p)} title="Copiar para minhas anotações">
            citar
          </button>
        </p>
      ))}
      {!termo && !tudo && tx.p.length > INICIAIS && (
        <button className="btn btn-ghost" onClick={() => setTudo(true)}>
          Ler o texto completo ({tx.p.length} parágrafos)
        </button>
      )}
    </section>
  )
}

export function VideoPage() {
  const { id = '' } = useParams()
  const videos = useData('videos')
  const playlists = useData('playlists')
  const curadoria = useData('curadoria')
  const caderno = useCaderno()
  const indice = useIndiceTextos()
  const [inicio, setInicio] = useState(0)
  const player = useRef<HTMLVideoElement>(null)
  const [nota, setNota] = useState('')
  const [salvo, setSalvo] = useState(true)

  const video = videos?.find((v) => v.id === id)

  useEffect(() => {
    setInicio(0)
    setNota(caderno.notas[id]?.texto ?? '')
    setSalvo(true)
  }, [id])

  const relacionados = useMemo(() => {
    if (!videos || !video) return []
    return videos
      .filter((v) => v.id !== video.id && v.lang === video.lang && v.tr.some((t) => video.tr.includes(t)))
      .sort((a, b) => b.co.filter((c) => video.co.includes(c)).length - a.co.filter((c) => video.co.includes(c)).length || b.v - a.v)
      .slice(0, 8)
  }, [videos, video])

  if (!videos || !playlists || !curadoria) return <Carregando />
  if (!video) return <div className="page"><p>Vídeo não encontrado.</p></div>

  const visto = Boolean(caderno.vistos[video.id])
  const favorito = Boolean(caderno.favoritos[video.id])
  const pls = playlists.filter((p) => video.pl.includes(p.id))
  const trilhas = curadoria.trilhas.filter((t) => video.tr.includes(t.id))
  const conceitos = curadoria.conceitos.filter((c) => video.co.includes(c.id))

  const gravar = () => {
    salvarNota(video.id, video.t, nota)
    setSalvo(true)
  }

  const local = videoLocal(video.id)

  const irPara = (t: number) => {
    if (player.current) {
      player.current.currentTime = t
      void player.current.play()
    } else setInicio(t)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const citar = (t: number, p: string) => {
    const nova = `${nota ? `${nota.trimEnd()}\n\n` : ''}[${tempo(t)}] “${p}”\n`
    setNota(nova)
    salvarNota(video.id, video.t, nova)
    setSalvo(true)
  }

  const comTexto = Boolean(indice?.[video.id])

  return (
    <div className="page page-wide">
      <div className="video-layout">
        <div>
          <div className="player">
            {video.off && !local ? (
              <div className="aviso aviso-player">
                Este vídeo foi removido do YouTube. O registro permanece aqui para estudo pessoal; não há arquivo para reproduzir.
              </div>
            ) : local ? (
              <video ref={player} src={local} poster={thumb(video.id)} controls preload="metadata" />
            ) : (
              <iframe
                key={`${video.id}-${inicio}`}
                src={`https://www.youtube-nocookie.com/embed/${video.id}?rel=0${inicio ? `&start=${inicio}&autoplay=1` : ''}`}
                title={video.t}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}
          </div>
          <h1 className="video-titulo">{video.t}</h1>
          <p className="texto-meta">
            {dataBR(video.d)} · {duracao(video.dur)} · {milhar(video.v)} visualizações
            {video.live ? ' · transmissão ao vivo' : ''}
            {local ? ' · arquivo do acervo local' : ''}
            {comTexto ? (
              <>
                {' · '}
                <a href="#texto">texto da aula ({milhar(indice![video.id].palavras)} palavras)</a>
              </>
            ) : ''}
          </p>
          <div className="acoes">
            <button className={`btn ${visto ? 'btn-primary' : 'btn-ghost'}`} onClick={() => alternarVisto(video.id)}>
              {visto ? '✓ Assistido' : 'Marcar como assistido'}
            </button>
            <button className={`btn ${favorito ? 'btn-primary' : 'btn-ghost'}`} onClick={() => alternarFavorito(video.id)}>
              {favorito ? '★ Favorito' : '☆ Favoritar'}
            </button>
            <Externo href={urlYoutube(video.id)}>Abrir no YouTube</Externo>
          </div>

          {(trilhas.length > 0 || conceitos.length > 0 || pls.length > 0) && (
            <div className="chips">
              {trilhas.map((t) => (
                <Link key={t.id} to={`/trilhas/${t.id}`} className="chip chip-trilha">
                  {t.titulo}
                </Link>
              ))}
              {conceitos.map((c) => (
                <Link key={c.id} to={`/conceitos#${c.id}`} className="chip">
                  {c.termo}
                </Link>
              ))}
              {pls.map((p) => (
                <Link key={p.id} to={`/playlists/${p.id}`} className="chip chip-pl">
                  {p.titulo}
                </Link>
              ))}
            </div>
          )}

          {video.ch.length > 0 && (
            <section className="bloco">
              <h2>Capítulos</h2>
              <ol className="capitulos">
                {video.ch.map((c) => (
                  <li key={c.t}>
                    <button onClick={() => irPara(c.t)}>
                      <span>{tempo(c.t)}</span> {c.title}
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {video.desc && (
            <section className="bloco">
              <h2>Descrição</h2>
              <p className="descricao">{video.desc}</p>
            </section>
          )}

          {comTexto && <TextoAula id={video.id} irPara={irPara} citar={citar} />}
        </div>

        <aside className="notas">
          <h2>Minhas anotações</h2>
          <p className="texto-meta">
            Ficam salvas neste navegador. Exporte pelo <Link to="/caderno">Caderno</Link>.
          </p>
          <textarea
            value={nota}
            onChange={(e) => {
              setNota(e.target.value)
              setSalvo(false)
            }}
            onBlur={gravar}
            placeholder={'Tese central:\n\nDistinções:\n\nO que isso muda em mim:'}
            rows={14}
          />
          <button className="btn btn-primary" onClick={gravar} disabled={salvo}>
            {salvo ? 'Salvo' : 'Salvar anotação'}
          </button>
          {trilhas[0] && (
            <div className="perguntas mini">
              <h3>Perguntas da trilha</h3>
              <ol>
                {trilhas[0].perguntas.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ol>
            </div>
          )}
        </aside>
      </div>

      {relacionados.length > 0 && (
        <section className="bloco">
          <h2>Para continuar</h2>
          <VideoGrid videos={relacionados} />
        </section>
      )}
    </div>
  )
}
