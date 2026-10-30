import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Carregando, Externo } from '../components/Cards'
import { pdfLivro, useArquivo, useBiblioteca } from '../lib/biblioteca'

interface LivroTexto {
  slug: string
  arquivo: string
  titulo: string
  autor: string | null
  paginas: string[]
}

export function LivroPage() {
  const { slug = '' } = useParams()
  const bib = useBiblioteca()
  const meta = bib?.livros.find((l) => l.slug === slug)
  const texto = useArquivo<LivroTexto>(`livros/${slug}.json`)
  const [pagina, setPagina] = useState(0)
  const [modo, setModo] = useState<'ler' | 'pdf'>('ler')

  const corpo = useMemo(() => {
    if (!texto?.paginas?.length) return null
    return texto.paginas[pagina] || '(página sem texto OCR)'
  }, [texto, pagina])

  if (texto === undefined || !bib) return <Carregando />
  if (!meta || !texto)
    return (
      <div className="page">
        <p>
          Livro não encontrado. <Link to="/biblioteca?aba=livros">Voltar</Link>
        </p>
      </div>
    )

  return (
    <div className="page page-wide">
      <p className="kicker">
        <Link to="/biblioteca?aba=livros">Biblioteca · Livros</Link>
      </p>
      <h1>{meta.titulo}</h1>
      <p className="texto-meta">
        {meta.autor ?? 'autor não indicado'}
        {meta.ano ? ` · ${meta.ano}` : ''} · {meta.paginas} páginas · {meta.mb} MB · pasta <code>LIVROS</code>
      </p>
      <div className="filtros">
        <button className={`btn ${modo === 'ler' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setModo('ler')}>
          Ler texto
        </button>
        <button className={`btn ${modo === 'pdf' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setModo('pdf')}>
          Abrir PDF
        </button>
        <Externo href={pdfLivro(meta)}>Baixar PDF</Externo>
      </div>

      {modo === 'pdf' ? (
        <iframe className="pdf-frame" title={meta.titulo} src={pdfLivro(meta)} />
      ) : (
        <div className="leitura-livro">
          <div className="paginacao">
            <button className="btn btn-ghost" disabled={pagina <= 0} onClick={() => setPagina((p) => p - 1)}>
              ←
            </button>
            <label>
              Página{' '}
              <input
                type="number"
                min={1}
                max={texto.paginas.length}
                value={pagina + 1}
                onChange={(e) => setPagina(Math.max(0, Math.min(texto.paginas.length - 1, Number(e.target.value) - 1)))}
              />{' '}
              de {texto.paginas.length}
            </label>
            <button
              className="btn btn-ghost"
              disabled={pagina >= texto.paginas.length - 1}
              onClick={() => setPagina((p) => p + 1)}
            >
              →
            </button>
          </div>
          <pre className="leitura pagina-livro">{corpo}</pre>
        </div>
      )}
    </div>
  )
}
