import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Carregando } from '../components/Cards'
import { NOMES_FONTE, type FonteBusca, type ResultadoBusca } from '../lib/biblioteca'

const FONTES: FonteBusca[] = ['cof', 'livros', 'planeta', 'seminario', 'aulas']

export function Busca() {
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [fontes, setFontes] = useState<FonteBusca[]>(FONTES)
  const [dado, setDado] = useState<ResultadoBusca | null | undefined>(undefined)

  useEffect(() => {
    const termo = params.get('q')?.trim()
    if (!termo) {
      setDado(null)
      return
    }
    let vivo = true
    setDado(undefined)
    const f = fontes.join(',')
    fetch(`/api/busca?q=${encodeURIComponent(termo)}&fontes=${f}&limite=80`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((d) => vivo && setDado(d))
    return () => {
      vivo = false
    }
  }, [params, fontes])

  return (
    <div className="page page-wide">
      <p className="kicker">
        <Link to="/biblioteca">Biblioteca</Link>
      </p>
      <h1>Busca no acervo</h1>
      <p className="lede">Procura no COF transcrito, nos livros, nos artigos da Planeta, nos textos do Seminário e nas aulas.</p>
      <form
        className="filtros"
        onSubmit={(e) => {
          e.preventDefault()
          setParams(q.trim() ? { q: q.trim() } : {})
        }}
      >
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex.: alma imortal, melodia, Gramsci…" />
        <button className="btn btn-primary" type="submit">
          Buscar
        </button>
      </form>
      <div className="filtros fontes-busca">
        {FONTES.map((f) => (
          <label key={f}>
            <input
              type="checkbox"
              checked={fontes.includes(f)}
              onChange={(e) => setFontes((xs) => (e.target.checked ? [...xs, f] : xs.filter((x) => x !== f)))}
            />{' '}
            {NOMES_FONTE[f]}
          </label>
        ))}
      </div>

      {dado === undefined && <Carregando />}
      {dado === null && <p className="vazio">Digite um termo para buscar.</p>}
      {dado && (
        <>
          <p className="texto-meta">
            {dado.total} ocorrências
            {Object.entries(dado.porFonte)
              .map(([f, n]) => ` · ${NOMES_FONTE[f as FonteBusca]}: ${n}`)
              .join('')}
          </p>
          <ol className="busca-lista">
            {dado.resultados.map((r, i) => (
              <li key={`${r.link}-${i}`}>
                <Link to={r.link}>
                  <span className="texto-meta">
                    {NOMES_FONTE[r.fonte]}
                    {r.sub ? ` · ${r.sub}` : ''} · {r.ocorrencias}×
                  </span>
                  <strong>{r.titulo}</strong>
                </Link>
                {r.trechos.map((t, j) => (
                  <p key={j} className="trecho">
                    …{t.antes}
                    <mark>{t.termo}</mark>
                    {t.depois}…
                  </p>
                ))}
              </li>
            ))}
          </ol>
          {!dado.resultados.length && <p className="vazio">Nada encontrado.</p>}
        </>
      )}
    </div>
  )
}
