import { Link } from 'react-router-dom'
import { Carregando, Externo } from '../components/Cards'
import { alternarSemana, useCaderno } from '../lib/caderno'
import { urlCurso, useData } from '../lib/data'
import type { Video } from '../lib/types'

const POR_SEMANA = 3

export function Plano() {
  const curadoria = useData('curadoria')
  const videos = useData('videos')
  const seminario = useData('seminario')
  const caderno = useCaderno()

  if (!curadoria || !seminario) return <Carregando />

  const usados = new Set<string>()
  const sugestoes = (trilha: string): Video[] => {
    if (!videos) return []
    const lista = videos
      .filter((v) => v.lang === 'pt' && v.tr[0] === trilha && !usados.has(v.id) && v.dur >= 300)
      .sort((a, b) => b.v - a.v)
      .slice(0, POR_SEMANA)
    lista.forEach((v) => usados.add(v.id))
    return lista
  }
  const cursoUsado = new Set<string>()
  const feitas = curadoria.plano.filter((s) => caderno.semanas[s.semana]).length

  return (
    <div className="page">
      <p className="kicker">Doze semanas</p>
      <h1>Plano de estudo</h1>
      <p className="lede">
        Uma semana por tema, na ordem das trilhas. Cada semana tem um foco, três vídeos do canal, um
        curso de referência no Seminário e um exercício escrito. Reserve ao menos uma hora por dia e
        registre as anotações na página de cada vídeo.
      </p>
      <p className="texto-meta">
        {feitas} de {curadoria.plano.length} semanas concluídas
      </p>
      <div className="barra" aria-hidden="true">
        <span style={{ width: `${(feitas / curadoria.plano.length) * 100}%` }} />
      </div>

      <ol className="plano">
        {curadoria.plano.map((s) => {
          const trilha = curadoria.trilhas.find((t) => t.id === s.trilha)!
          const slug = trilha.cursos.find((c) => !cursoUsado.has(c)) ?? trilha.cursos[0]
          cursoUsado.add(slug)
          const curso = seminario.cursos.find((c) => c.slug === slug)
          const vids = sugestoes(s.trilha)
          const feita = Boolean(caderno.semanas[s.semana])
          return (
            <li key={s.semana} className={`semana ${feita ? 'feita' : ''}`}>
              <header>
                <span className="num">{String(s.semana).padStart(2, '0')}</span>
                <div>
                  <h2>{s.foco}</h2>
                  <Link to={`/trilhas/${trilha.id}`} className="texto-meta">
                    Trilha: {trilha.titulo}
                  </Link>
                </div>
                <button className={`btn ${feita ? 'btn-primary' : 'btn-ghost'}`} onClick={() => alternarSemana(s.semana)}>
                  {feita ? '✓ Concluída' : 'Concluir'}
                </button>
              </header>
              <div className="semana-corpo">
                <div>
                  <h3>Assistir</h3>
                  <ul className="mini-lista">
                    {vids.map((v) => (
                      <li key={v.id} className={caderno.vistos[v.id] ? 'visto' : ''}>
                        <Link to={`/videos/${v.id}`}>{v.t}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3>Curso de referência</h3>
                  {curso && <Externo href={urlCurso(curso.slug)}>{curso.titulo}</Externo>}
                  <h3>Exercício</h3>
                  <p>{s.exercicio}</p>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
