import { Link, useParams } from 'react-router-dom'
import { Carregando, Externo } from '../components/Cards'
import { salvarNota, useCaderno } from '../lib/caderno'
import { useArquivo, type AulaCofTexto } from '../lib/biblioteca'
import { useEffect, useState } from 'react'
import { videoLocal, thumb } from '../lib/data'

export function CofAulaPage() {
  const { id = '' } = useParams()
  const aula = useArquivo<AulaCofTexto>(`cof/${id}.json`)
  const caderno = useCaderno()
  const chave = `cof:${id}`
  const [nota, setNota] = useState('')

  useEffect(() => {
    setNota(caderno.notas[chave]?.texto ?? '')
    window.scrollTo(0, 0)
  }, [id])

  if (aula === undefined) return <Carregando />
  if (!aula)
    return (
      <div className="page">
        <p>
          Aula não encontrada. <Link to="/biblioteca">Voltar à biblioteca</Link>
        </p>
      </div>
    )

  const mp4 = aula.video ? videoLocal(aula.video) : null

  return (
    <div className="page page-wide">
      <p className="kicker">
        <Link to="/biblioteca">Biblioteca</Link> · COF {aula.status === 'revisada' ? 'revisada' : 'em revisão'}
      </p>
      <h1>
        {aula.pre ? `Introdução ${aula.num}` : `Aula ${aula.num}`}
        {aula.data ? <span className="texto-meta"> · {aula.data}</span> : null}
      </h1>
      <p className="texto-meta">
        {aula.palavras.toLocaleString('pt-BR')} palavras
        {aula.fonte && (
          <>
            {' '}
            · <Externo href={aula.fonte}>fonte osescribas</Externo>
          </>
        )}
      </p>

      <div className="video-layout">
        <article>
          {mp4 && (
            <video className="player-cof" controls preload="metadata" poster={thumb(aula.video!)} src={mp4} />
          )}
          <div className="leitura cof-leitura" dangerouslySetInnerHTML={{ __html: aula.html }} />
        </article>
        <aside className="notas">
          <h2>Minhas anotações</h2>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            onBlur={() => salvarNota(chave, aula.pre ? `Intro ${aula.num}` : `COF ${aula.num}`, nota)}
            rows={16}
            placeholder={'Tese central:\n\nDistinções:\n\nO que isso muda em mim:'}
          />
          <button
            className="btn btn-primary"
            onClick={() => salvarNota(chave, aula.pre ? `Intro ${aula.num}` : `COF ${aula.num}`, nota)}
          >
            Salvar anotação
          </button>
          <p className="texto-meta">
            <Link to={`/biblioteca/cof/COF${String(Math.max(1, aula.num - 1)).padStart(3, '0')}`}>← anterior</Link>
            {' · '}
            <Link to={`/biblioteca/cof/COF${String(aula.num + 1).padStart(3, '0')}`}>próxima →</Link>
          </p>
        </aside>
      </div>
    </div>
  )
}
