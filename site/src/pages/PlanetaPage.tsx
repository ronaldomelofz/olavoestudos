import { Link, useParams } from 'react-router-dom'
import { Carregando, Externo } from '../components/Cards'
import { pdfPlaneta, useBiblioteca, useTexto } from '../lib/biblioteca'

export function PlanetaPage() {
  const { slug = '' } = useParams()
  const bib = useBiblioteca()
  const art = bib?.planeta.find((a) => a.slug === slug)
  const txt = useTexto(art?.texto ? `planeta/${art.texto}` : undefined)

  if (!bib || (art?.texto && txt === undefined)) return <Carregando />
  if (!art)
    return (
      <div className="page">
        <p>
          Artigo não encontrado. <Link to="/biblioteca?aba=planeta">Voltar</Link>
        </p>
      </div>
    )

  const pdf = art.pdf || art.scan

  return (
    <div className="page page-wide">
      <p className="kicker">
        <Link to="/biblioteca?aba=planeta">Biblioteca · Revista Planeta</Link>
      </p>
      <h1>{art.titulo}</h1>
      <p className="texto-meta">
        Planeta nº {art.num} · {art.data.split('-').reverse().join('/')}
        {art.palavras ? ` · ${art.palavras.toLocaleString('pt-BR')} palavras` : ''} ·{' '}
        <Externo href="https://archive.org/details/olavo-de-carvalho-planeta">Internet Archive</Externo>
      </p>
      <div className="filtros">
        {pdf && <Externo href={pdfPlaneta(pdf)}>Abrir PDF</Externo>}
        {art.scan && art.pdf && <Externo href={pdfPlaneta(art.scan)}>Digitalização original</Externo>}
      </div>
      {pdf && <iframe className="pdf-frame" title={art.titulo} src={pdfPlaneta(pdf)} />}
      {typeof txt === 'string' && (
        <section className="bloco">
          <h2>Texto (OCR)</h2>
          <pre className="leitura pagina-livro">{txt}</pre>
        </section>
      )}
    </div>
  )
}
