import { Link, useParams } from 'react-router-dom'
import { Carregando, Externo } from '../components/Cards'
import { alternarVisto, useCaderno } from '../lib/caderno'
import { dataBR, duracao, thumb, useData, useIndiceTextos } from '../lib/data'

export function PlaylistPage() {
  const { id } = useParams()
  const playlists = useData('playlists')
  const videos = useData('videos')
  const caderno = useCaderno()
  const indice = useIndiceTextos()

  if (!playlists || !videos) return <Carregando />
  const p = playlists.find((x) => x.id === id)
  if (!p) return <div className="page"><p>Playlist não encontrada.</p></div>

  const porId = new Map(videos.map((v) => [v.id, v]))
  const itens = p.videos.map((vid) => porId.get(vid)).filter((v) => v !== undefined)
  const vistos = itens.filter((v) => caderno.vistos[v.id]).length
  const proximo = itens.find((v) => !caderno.vistos[v.id])

  return (
    <div className="page">
      <p className="kicker">
        <Link to="/playlists">Playlists</Link>
      </p>
      <h1>{p.titulo}</h1>
      {p.descricao && <p className="lede">{p.descricao}</p>}
      {p.origem && <p className="lede">Coleção complementar publicada por {p.origem}.</p>}
      <p className="texto-meta">
        {itens.length} vídeos · {vistos} assistidos ·{' '}
        {p.origem ? (
          p.url && <Externo href={p.url}>Abrir no YouTube</Externo>
        ) : (
          <Externo href={`https://www.youtube.com/playlist?list=${p.id}`}>Abrir no YouTube</Externo>
        )}
      </p>
      <div className="barra" aria-hidden="true">
        <span style={{ width: `${itens.length ? (vistos / itens.length) * 100 : 0}%` }} />
      </div>
      {proximo && (
        <p>
          <Link to={`/videos/${proximo.id}`} className="btn btn-primary">
            Continuar: {proximo.t}
          </Link>
        </p>
      )}

      <ol className="pl-lista">
        {itens.map((v, i) => (
          <li key={v.id} className={caderno.vistos[v.id] ? 'visto' : ''}>
            <span className="num">{i + 1}</span>
            <Link to={`/videos/${v.id}`} className="pl-item">
              <img src={thumb(v.id)} alt="" loading="lazy" />
              <span>
                <strong>{v.t}</strong>
                <em>
                  {dataBR(v.d)} · {duracao(v.dur)}
                  {indice?.[v.id] ? ' · texto da aula' : ''}
                </em>
              </span>
            </Link>
            <button
              className="check"
              aria-label={caderno.vistos[v.id] ? 'Desmarcar' : 'Marcar como assistido'}
              onClick={() => alternarVisto(v.id)}
            >
              {caderno.vistos[v.id] ? '✓' : ''}
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}
