import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Carregando, Externo, LinkSeminario, TextoItem, VideoGrid } from '../components/Cards'
import { SITE, urlCurso, useData } from '../lib/data'

const PASSO = 24

export function TrilhaPage() {
  const { id } = useParams()
  const curadoria = useData('curadoria')
  const seminario = useData('seminario')
  const videos = useData('videos')
  const textos = useData('textos')
  const [limite, setLimite] = useState(PASSO)
  const [lang, setLang] = useState<'pt' | 'en' | 'todos'>('pt')

  const trilha = curadoria?.trilhas.find((t) => t.id === id)

  const daTrilha = useMemo(() => {
    if (!videos || !id) return []
    return videos
      .filter((v) => v.tr.includes(id) && (lang === 'todos' || v.lang === lang))
      .sort((a, b) => Number(b.tr[0] === id) - Number(a.tr[0] === id) || b.v - a.v)
  }, [videos, id, lang])

  const textosRel = useMemo(() => {
    if (!textos || !trilha) return []
    const curados = new Set(trilha.textos)
    return textos
      .filter((x) => x.tr[0] === trilha.id && !curados.has(x.s))
      .sort((a, b) => b.views - a.views)
      .slice(0, 12)
  }, [textos, trilha])

  if (!curadoria || !seminario) return <Carregando />
  if (!trilha) return <div className="page"><p>Trilha não encontrada.</p></div>

  const idx = curadoria.trilhas.findIndex((t) => t.id === trilha.id)
  const anterior = curadoria.trilhas[idx - 1]
  const proxima = curadoria.trilhas[idx + 1]
  const cursos = trilha.cursos.map((s) => seminario.cursos.find((c) => c.slug === s)).filter(Boolean)
  const guias = trilha.guias.map((s) => seminario.guias.find((g) => g.slug === s)).filter(Boolean)
  const textosCurados = textos ? trilha.textos.map((s) => textos.find((x) => x.s === s)).filter(Boolean) : []
  const conceitos = curadoria.conceitos.filter((c) => c.trilha === trilha.id)

  return (
    <div className="page">
      <p className="kicker">
        <Link to="/trilhas">Trilhas</Link> · {String(trilha.ordem).padStart(2, '0')}
      </p>
      <h1>{trilha.titulo}</h1>
      <p className="sub">{trilha.subtitulo}</p>
      <p className="lede">{trilha.resumo}</p>

      <section className="bloco perguntas">
        <h2>Perguntas para meditar</h2>
        <ol>
          {trilha.perguntas.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>
      </section>

      {conceitos.length > 0 && (
        <section className="bloco">
          <h2>Conceitos desta trilha</h2>
          <div className="chips">
            {conceitos.map((c) => (
              <Link key={c.id} to={`/conceitos#${c.id}`} className="chip">
                {c.termo}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="bloco">
        <h2>Cursos do Seminário</h2>
        <div className="cards-2">
          {cursos.map((c) => (
            <article key={c!.slug} className="card">
              <h3>{c!.titulo}</h3>
              <p>{c!.desc}</p>
              <Externo href={urlCurso(c!.slug)}>Ver curso no site oficial</Externo>
            </article>
          ))}
        </div>
      </section>

      {guias.length > 0 && (
        <section className="bloco">
          <h2>Guias de estudo</h2>
          <div className="cards-2">
            {guias.map((g) => (
              <article key={g!.slug} className="card">
                <h3>{g!.titulo}</h3>
                <p className="texto-meta">{g!.autor}</p>
                <p>{g!.desc}…</p>
                <LinkSeminario pasta="guias" slug={g!.slug}>
                  Abrir guia
                </LinkSeminario>
              </article>
            ))}
          </div>
        </section>
      )}

      {(textosCurados.length > 0 || textosRel.length > 0) && (
        <section className="bloco">
          <h2>Textos</h2>
          <ul className="texto-lista">
            {textosCurados.map((x) => (
              <TextoItem key={x!.id} x={x!} />
            ))}
            {textosRel.map((x) => (
              <TextoItem key={x.id} x={x} />
            ))}
          </ul>
          <p>
            <Link to={`/textos?trilha=${trilha.id}`} className="externo">
              Todos os textos desta trilha
            </Link>{' '}
            · <Externo href={`${SITE}/textos`}>Acervo completo no Seminário</Externo>
          </p>
        </section>
      )}

      <section className="bloco">
        <div className="bloco-cab">
          <h2>Vídeos ({daTrilha.length})</h2>
          <div className="seg" role="group" aria-label="Idioma">
            {(['pt', 'en', 'todos'] as const).map((l) => (
              <button key={l} className={lang === l ? 'ativo' : ''} onClick={() => setLang(l)}>
                {l === 'pt' ? 'Português' : l === 'en' ? 'English' : 'Todos'}
              </button>
            ))}
          </div>
        </div>
        {videos ? <VideoGrid videos={daTrilha.slice(0, limite)} /> : <Carregando />}
        {daTrilha.length > limite && (
          <button className="btn btn-ghost" onClick={() => setLimite((l) => l + PASSO)}>
            Mostrar mais
          </button>
        )}
      </section>

      <nav className="paginacao">
        {anterior ? <Link to={`/trilhas/${anterior.id}`}>← {anterior.titulo}</Link> : <span />}
        {proxima && <Link to={`/trilhas/${proxima.id}`}>{proxima.titulo} →</Link>}
      </nav>
    </div>
  )
}
