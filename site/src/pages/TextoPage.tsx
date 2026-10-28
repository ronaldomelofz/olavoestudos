import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Carregando, Externo } from '../components/Cards'
import { salvarNota, useCaderno } from '../lib/caderno'
import { imagemLocal, urlGuia, urlTexto } from '../lib/data'

interface ArtigoSalvo {
  title: string
  publication_author: string | null
  full_publication_date: string | null
  reading_time_minutes: number | null
  small_description: string | null
  summary: string | null
  principal_points: string | null
  text: string
  references: string | null
  bibliography: string | null
  is_truncated: boolean
  capa_local: string | null
  tags?: { name?: string; tag?: string }[]
}

/** Leitura de um texto ou guia salvo em ACERVO/SEMINARIO (HTML limpo no download). */
export function TextoPage({ pasta }: { pasta: 'textos' | 'guias' }) {
  const { slug = '' } = useParams()
  const caderno = useCaderno()
  const [d, setD] = useState<ArtigoSalvo | null | undefined>(undefined)
  const [nota, setNota] = useState('')
  const chave = `texto:${slug}`

  useEffect(() => {
    let vivo = true
    setD(undefined)
    fetch(`/acervo/SEMINARIO/${pasta}/${slug}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((x) => vivo && setD(x))
    setNota(caderno.notas[chave]?.texto ?? '')
    window.scrollTo(0, 0)
    return () => {
      vivo = false
    }
  }, [pasta, slug])

  if (d === undefined) return <Carregando />
  const oficial = pasta === 'guias' ? urlGuia(slug) : urlTexto(slug)
  if (!d)
    return (
      <div className="page">
        <p>
          Texto ainda não salvo no acervo local. <Externo href={oficial}>Ler no site oficial</Externo>
        </p>
      </div>
    )

  const bloco = (titulo: string, html: string | null) =>
    html ? (
      <section className="bloco">
        <h2>{titulo}</h2>
        <div className="leitura" dangerouslySetInnerHTML={{ __html: html }} />
      </section>
    ) : null

  return (
    <div className="page page-wide">
      <div className="video-layout">
        <article>
          <p className="kicker">
            <Link to={pasta === 'guias' ? '/seminario' : '/textos'}>{pasta === 'guias' ? 'Guias de estudo' : 'Textos'}</Link>
          </p>
          <h1>{d.title}</h1>
          <p className="texto-meta">
            {d.publication_author ?? 'Olavo de Carvalho'}
            {d.full_publication_date ? ` · ${d.full_publication_date}` : ''}
            {d.reading_time_minutes ? ` · ${d.reading_time_minutes} min de leitura` : ''} ·{' '}
            <Externo href={oficial}>site oficial</Externo>
          </p>
          {d.capa_local && <img className="capa-texto" src={imagemLocal(d.capa_local)} alt="" />}
          {bloco('Resumo', d.summary)}
          {bloco('Pontos principais', d.principal_points)}
          {d.text ? (
            <div className="leitura" dangerouslySetInnerHTML={{ __html: d.text }} />
          ) : (
            <p className="leitura">{d.small_description}</p>
          )}
          {d.is_truncated && (
            <p className="aviso">
              Conteúdo para assinantes: apenas a parte pública foi salva. <Externo href={oficial}>Continuar no site oficial</Externo>
            </p>
          )}
          {bloco('Referências', d.references)}
          {bloco('Bibliografia', d.bibliography)}
        </article>

        <aside className="notas">
          <h2>Minhas anotações</h2>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            onBlur={() => salvarNota(chave, d.title, nota)}
            placeholder={'Tese central:\n\nDistinções:\n\nO que isso muda em mim:'}
            rows={14}
          />
          <button className="btn btn-primary" onClick={() => salvarNota(chave, d.title, nota)}>
            Salvar anotação
          </button>
        </aside>
      </div>
    </div>
  )
}
