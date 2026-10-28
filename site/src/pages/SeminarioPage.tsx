import { Link } from 'react-router-dom'
import { Carregando, Externo } from '../components/Cards'
import { ACERVO, SITE, imagemLocal, urlCurso, urlGuia, useData } from '../lib/data'

const AULAS_LIVRES: Record<number, string> = {
  1656: 'curso-online-de-filosofia-cof/1656',
  729: 'ciencia-politica-saber-prever-e-poder/729',
  718: 'curso-teoria-do-estado/718',
}

export function SeminarioPage() {
  const seminario = useData('seminario')
  const curadoria = useData('curadoria')
  if (!seminario || !curadoria) return <Carregando />

  const trilhaDoCurso = new Map<string, { id: string; titulo: string }>()
  curadoria.trilhas.forEach((t) => t.cursos.forEach((c) => trilhaDoCurso.set(c, t)))

  return (
    <div className="page">
      <p className="kicker">olavodecarvalho.com.br</p>
      <h1>Seminário de Filosofia</h1>
      <p className="lede">
        O site oficial reúne o COF remasterizado, os cursos avulsos, os guias de estudo de Ronald
        Robson, apostilas, áudios e o programa True Outspeak. Este mapa mostra onde cada curso se
        encaixa nas trilhas; o acesso ao conteúdo é feito no próprio site.
      </p>

      <section className="bloco">
        <h2>Aulas abertas</h2>
        <div className="cards-3">
          {seminario.aulas.map((a) => (
            <article key={a.id} className="card">
              <h3>{a.title}</h3>
              <p>{a.desc}</p>
              {AULAS_LIVRES[a.id] && <Externo href={urlCurso(AULAS_LIVRES[a.id])}>Assistir gratuitamente</Externo>}
            </article>
          ))}
        </div>
      </section>

      <section className="bloco">
        <h2>Guias de estudo</h2>
        <ol className="texto-lista">
          {seminario.guias.map((g) => {
            const corpo = (
              <>
                <span className="texto-meta">{g.autor}</span>
                <strong>{g.titulo}</strong>
                <span className="texto-desc">{g.desc}…</span>
              </>
            )
            return (
              <li key={g.slug} className="texto-item">
                {ACERVO.guias.has(g.slug) ? (
                  <Link to={`/guias/${g.slug}`}>{corpo}</Link>
                ) : (
                  <a href={urlGuia(g.slug)} target="_blank" rel="noreferrer">
                    {corpo}
                  </a>
                )}
              </li>
            )
          })}
        </ol>
      </section>

      <section className="bloco">
        <h2>Cursos ({seminario.cursos.length})</h2>
        <div className="cards-2">
          {seminario.cursos.map((c) => {
            const t = trilhaDoCurso.get(c.slug)
            const local = ACERVO.cursos[c.slug]
            const aulas = local?.modulos.reduce((s, m) => s + m.aulas.length, 0) ?? 0
            return (
              <article key={c.slug} className="card">
                {local?.capa && <img className="capa-curso" src={imagemLocal(local.capa)} alt="" loading="lazy" />}
                {t && (
                  <Link to={`/trilhas/${t.id}`} className="chip chip-trilha">
                    {t.titulo}
                  </Link>
                )}
                <h3>{c.titulo}</h3>
                <p>{c.desc}</p>
                {aulas > 0 && (
                  <details className="sumario-curso">
                    <summary>Sumário: {aulas} aulas</summary>
                    {local!.modulos.map((m) => (
                      <div key={m.nome}>
                        <h4>{m.nome}</h4>
                        <ol>
                          {m.aulas.map(([titulo, topicos], i) => (
                            <li key={i}>
                              <strong>{titulo}</strong>
                              {topicos && <span>{topicos}</span>}
                            </li>
                          ))}
                        </ol>
                      </div>
                    ))}
                  </details>
                )}
                <Externo href={urlCurso(c.slug)}>Ver no site oficial</Externo>
              </article>
            )
          })}
        </div>
      </section>

      <section className="bloco">
        <h2>Outras seções do site</h2>
        <div className="chips">
          {[
            ['Apostilas', 'apostilas'],
            ['Áudios', 'audios'],
            ['Temas', 'temas'],
            ['Academia COF', 'academia-cof'],
            ['True Outspeak', 'true-outspeak'],
            ['Vídeos', 'videos'],
          ].map(([nome, slug]) => (
            <a key={slug} className="chip" href={`${SITE}/${slug}`} target="_blank" rel="noreferrer">
              {nome}
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}
