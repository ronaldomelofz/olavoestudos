import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Carregando, Externo } from '../components/Cards'
import { useCaderno } from '../lib/caderno'
import { milhar } from '../lib/data'
import { useBiblioteca, type AulaCof } from '../lib/biblioteca'

type Aba = 'cof' | 'livros' | 'planeta'

export function Biblioteca() {
  const bib = useBiblioteca()
  const [params, setParams] = useSearchParams()
  const aba = (params.get('aba') as Aba) || 'cof'
  const [termo, setTermo] = useState('')

  if (!bib) return <Carregando />
  const vazia = !bib.cof.length && !bib.livros.length && !bib.planeta.length
  const palavras = bib.cof.reduce((s, a) => s + a.palavras, 0) + bib.livros.reduce((s, l) => s + l.palavras, 0)

  const ir = (a: Aba) => setParams(a === 'cof' ? {} : { aba: a }, { replace: true })

  return (
    <div className="page page-wide">
      <p className="kicker">Acervo pessoal de estudo</p>
      <h1>Biblioteca</h1>
      <p className="lede">
        O Curso Online de Filosofia transcrito aula por aula, os livros e escritos guardados na pasta{' '}
        <code>LIVROS</code> e os artigos de Olavo de Carvalho na revista <em>Planeta</em> (1977–1981). Tudo é lido a
        partir dos arquivos salvos no projeto.
      </p>

      {vazia ? (
        <p className="aviso">
          A biblioteca ainda não foi montada nesta máquina. Rode <code>python scripts\montar_biblioteca.py</code>.
        </p>
      ) : (
        <>
          <dl className="stats">
            <div>
              <dt>Aulas do COF</dt>
              <dd>{milhar(bib.cof.length)}</dd>
            </div>
            <div>
              <dt>Livros e escritos</dt>
              <dd>{bib.livros.length}</dd>
            </div>
            <div>
              <dt>Artigos da Planeta</dt>
              <dd>{bib.planeta.length}</dd>
            </div>
            <div>
              <dt>Palavras</dt>
              <dd>{(palavras / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi</dd>
            </div>
          </dl>

          <div className="abas" role="tablist">
            {(
              [
                ['cof', `COF transcrito (${bib.cof.length})`],
                ['livros', `Livros (${bib.livros.length})`],
                ['planeta', `Revista Planeta (${bib.planeta.length})`],
              ] as [Aba, string][]
            ).map(([id, nome]) => (
              <button key={id} role="tab" aria-selected={aba === id} className={aba === id ? 'ativa' : ''} onClick={() => ir(id)}>
                {nome}
              </button>
            ))}
            <Link to="/busca" className="btn btn-ghost abas-busca">
              Buscar no texto integral
            </Link>
          </div>

          {aba === 'cof' && <ListaCof aulas={bib.cof} termo={termo} setTermo={setTermo} />}
          {aba === 'livros' && <ListaLivros />}
          {aba === 'planeta' && <ListaPlaneta />}
        </>
      )}
    </div>
  )
}

function ListaCof({ aulas, termo, setTermo }: { aulas: AulaCof[]; termo: string; setTermo: (s: string) => void }) {
  const caderno = useCaderno()
  const [status, setStatus] = useState('')
  const filtradas = useMemo(() => {
    const n = Number(termo.trim())
    return aulas.filter(
      (a) =>
        (!status || (status === 'video' ? a.video : a.status === status)) &&
        (!termo.trim() || (Number.isFinite(n) && n > 0 ? String(a.num).startsWith(termo.trim()) : (a.data ?? '').includes(termo))),
    )
  }, [aulas, termo, status])
  const faixas = useMemo(() => {
    const g = new Map<string, AulaCof[]>()
    for (const a of filtradas) {
      const k = a.pre ? 'Introdução' : `Aulas ${Math.floor((a.num - 1) / 50) * 50 + 1}–${Math.floor((a.num - 1) / 50) * 50 + 50}`
      g.set(k, [...(g.get(k) ?? []), a])
    }
    return [...g]
  }, [filtradas])

  return (
    <section className="bloco">
      <p>
        Transcrições do projeto{' '}
        <Externo href="https://github.com/osescribas/cof">osescribas/cof</Externo> (licença CC0): as aulas 1 a 293 foram
        revisadas por voluntários; as demais estão em revisão e vêm sem pontuação fina. As aulas com vídeo no acervo abrem
        o player ao lado do texto.
      </p>
      <div className="filtros">
        <input type="search" placeholder="Número da aula (ex.: 59) ou ano (ex.: 2010)" value={termo} onChange={(e) => setTermo(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todas</option>
          <option value="revisada">Revisadas</option>
          <option value="pendente">Em revisão</option>
          <option value="video">Com vídeo no acervo</option>
        </select>
      </div>
      {faixas.map(([nome, lista]) => (
        <details key={nome} className="faixa-cof" open={faixas.length <= 2 || nome === faixas[0][0]}>
          <summary>
            {nome} <span>{lista.length} aulas</span>
          </summary>
          <ol className="grade-cof">
            {lista.map((a) => (
              <li key={a.id}>
                <Link to={`/biblioteca/cof/${a.id}`} className={`aula-cof ${a.status}`}>
                  <strong>{a.pre ? `Intro ${a.num}` : a.num}</strong>
                  <span>{a.data ?? (a.status === 'pendente' ? 'em revisão' : '')}</span>
                  <small>
                    {milhar(a.palavras)} palavras
                    {a.video ? ' · ▶' : ''}
                    {caderno.notas[`cof:${a.id}`] ? ' · ✎' : ''}
                  </small>
                </Link>
              </li>
            ))}
          </ol>
        </details>
      ))}
      {!filtradas.length && <p className="vazio">Nenhuma aula com esse filtro.</p>}
    </section>
  )
}

function ListaLivros() {
  const bib = useBiblioteca()!
  const grupos = useMemo(() => {
    const g = new Map<string, typeof bib.livros>()
    for (const l of bib.livros) g.set(l.categoria, [...(g.get(l.categoria) ?? []), l])
    const ordem = ['Obras', 'COF', 'Artigos', 'Debates', 'Sobre Olavo', 'Traduções', 'Outros']
    return [...g].sort((a, b) => ordem.indexOf(a[0]) - ordem.indexOf(b[0]))
  }, [bib.livros])
  return (
    <section className="bloco">
      <p>
        PDFs da pasta <code>LIVROS</code>, com o texto de cada página extraído para leitura e busca. Para acrescentar um
        livro, coloque o PDF na pasta e rode <code>python scripts\montar_biblioteca.py --sem-baixar</code>.
      </p>
      {grupos.map(([cat, livros]) => (
        <div key={cat}>
          <h2>{cat}</h2>
          <div className="cards-3">
            {livros.map((l) => (
              <Link key={l.slug} to={`/biblioteca/livros/${l.slug}`} className="card livro-card">
                <span className="livro-lombada" aria-hidden="true">
                  {l.titulo.slice(0, 1)}
                </span>
                <h3>{l.titulo}</h3>
                <p className="texto-meta">
                  {l.autor ?? 'autor não indicado'}
                  {l.ano ? ` · ${l.ano}` : ''}
                  {l.lingua !== 'pt' ? ` · ${l.lingua.toUpperCase()}` : ''}
                </p>
                <p className="texto-meta">
                  {milhar(l.paginas)} páginas · {milhar(l.palavras)} palavras · {l.mb} MB
                </p>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}

function ListaPlaneta() {
  const bib = useBiblioteca()!
  return (
    <section className="bloco">
      <p>
        Artigos publicados por Olavo de Carvalho na revista <em>Planeta</em>, digitalizados no{' '}
        <Externo href="https://archive.org/details/olavo-de-carvalho-planeta">Internet Archive</Externo>. Cada artigo tem
        o PDF, a digitalização original quando existe, e o texto por OCR.
      </p>
      <ol className="texto-lista">
        {bib.planeta.map((a) => (
          <li key={a.slug} className="texto-item">
            <Link to={`/biblioteca/planeta/${a.slug}`}>
              <span className="texto-meta">
                Planeta nº {a.num} · {a.data.split('-').reverse().join('/')}
                {a.palavras ? ` · ${milhar(a.palavras)} palavras` : ''}
                {a.scan ? ' · digitalização original' : ''}
              </span>
              <strong>{a.titulo}</strong>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}
