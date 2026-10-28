import { Link } from 'react-router-dom'
import { Carregando } from '../components/Cards'
import { useCaderno } from '../lib/caderno'
import { useData } from '../lib/data'

export function Trilhas() {
  const curadoria = useData('curadoria')
  const videos = useData('videos')
  const caderno = useCaderno()

  if (!curadoria) return <Carregando />

  return (
    <div className="page">
      <p className="kicker">Percurso</p>
      <h1>Trilhas de estudo</h1>
      <p className="lede">
        Cada trilha junta um resumo, perguntas para meditar, os cursos e guias do Seminário que
        tratam do tema, textos selecionados e os vídeos do canal ligados a ele. A ordem sugerida vai
        da decisão pessoal de estudar até os grandes autores.
      </p>
      <ul className="trilha-lista">
        {curadoria.trilhas.map((t) => {
          const daTrilha = videos?.filter((v) => v.tr.includes(t.id)) ?? []
          const vistos = daTrilha.filter((v) => caderno.vistos[v.id]).length
          const pct = daTrilha.length ? Math.round((vistos / daTrilha.length) * 100) : 0
          return (
            <li key={t.id}>
              <Link to={`/trilhas/${t.id}`} className="trilha-card">
                <span className="num">{String(t.ordem).padStart(2, '0')}</span>
                <div>
                  <h2>{t.titulo}</h2>
                  <p className="sub">{t.subtitulo}</p>
                  <p>{t.resumo}</p>
                  <p className="trilha-meta">
                    {t.cursos.length} cursos · {t.guias.length} guias · {daTrilha.length} vídeos
                    {vistos ? ` · ${pct}% assistido` : ''}
                  </p>
                  <div className="barra" aria-hidden="true">
                    <span style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
