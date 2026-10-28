import { Link } from 'react-router-dom'
import { Carregando } from '../components/Cards'
import { useCaderno } from '../lib/caderno'
import { duracao, thumb, useData, useIndiceTextos } from '../lib/data'
import type { Playlist } from '../lib/types'

export function Playlists() {
  const playlists = useData('playlists')
  const videos = useData('videos')
  const caderno = useCaderno()
  const indice = useIndiceTextos()

  if (!playlists || !videos) return <Carregando />
  const porId = new Map(videos.map((v) => [v.id, v]))
  const lives = videos.filter((v) => v.aba === 'streams')
  const oficiais = playlists.filter((p) => !p.origem)
  const complementares = playlists.filter((p) => p.origem)

  const grade = (lista: Playlist[]) => (
    <div className="pl-grid">
      {lista.map((p) => {
        const itens = p.videos.map((id) => porId.get(id)).filter(Boolean)
        const total = itens.reduce((s, v) => s + v!.dur, 0)
        const vistos = itens.filter((v) => caderno.vistos[v!.id]).length
        const transcritos = indice ? p.videos.filter((id) => indice[id]).length : 0
        return (
          <Link key={p.id} to={`/playlists/${p.id}`} className="pl-card">
            <div className="video-thumb">
              {p.videos[0] && <img src={thumb(p.videos[0])} alt="" loading="lazy" />}
              <span className="video-dur">{itens.length} vídeos</span>
            </div>
            <div className="video-info">
              <h3>{p.titulo}</h3>
              <p>
                {duracao(total)} de conteúdo{vistos ? ` · ${vistos} assistidos` : ''}
                {transcritos ? ` · ${transcritos} com texto` : ''}
              </p>
              {p.origem && <p className="origem">Publicado por {p.origem}</p>}
            </div>
          </Link>
        )
      })}
    </div>
  )

  return (
    <div className="page page-wide">
      <p className="kicker">Coleções</p>
      <h1>Playlists e lives</h1>
      <p className="lede">
        As playlists oficiais do canal, na ordem sugerida para estudo: primeiro as aulas e trechos do
        COF, depois hangouts, entrevistas e o restante.
      </p>
      {grade(oficiais)}

      {complementares.length > 0 && (
        <section className="bloco">
          <h2>Coleções complementares</h2>
          <p className="texto-meta">
            Aulas e entrevistas do Professor Olavo reunidas por outros canais: a História Essencial da
            Filosofia (2002–2003), aulas públicas do COF em ordem cronológica, o True Outspeak, versões
            remasterizadas e o canal do Curso Online de Filosofia.
          </p>
          {grade(complementares)}
        </section>
      )}

      {lives.length > 0 && (
        <section className="bloco">
          <h2>Transmissões ao vivo</h2>
          <ul className="texto-lista">
            {lives.map((v) => (
              <li key={v.id} className="texto-item">
                <Link to={`/videos/${v.id}`}>
                  <span className="texto-meta">
                    {v.d} · {duracao(v.dur)}
                  </span>
                  <strong>{v.t}</strong>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
