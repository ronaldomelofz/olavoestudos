import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Carregando, TextoItem } from '../components/Cards'
import { useData } from '../lib/data'

export function Conceitos() {
  const curadoria = useData('curadoria')
  const videos = useData('videos')
  const textos = useData('textos')
  const { hash } = useLocation()

  useEffect(() => {
    if (hash && curadoria) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' })
  }, [hash, curadoria])

  if (!curadoria) return <Carregando />

  return (
    <div className="page">
      <p className="kicker">Vocabulário</p>
      <h1>Conceitos-chave</h1>
      <p className="lede">
        Um glossário de trabalho com as noções que mais aparecem nas aulas. As definições são
        resumos de estudo, não citações: servem para orientar a escuta e devem ser conferidas nas
        fontes indicadas.
      </p>

      <nav className="chips indice">
        {curadoria.conceitos.map((c) => (
          <a key={c.id} href={`#${c.id}`} className="chip">
            {c.termo}
          </a>
        ))}
      </nav>

      {curadoria.trilhas.map((t) => {
        const doGrupo = curadoria.conceitos.filter((c) => c.trilha === t.id)
        if (!doGrupo.length) return null
        return (
          <section key={t.id} className="bloco">
            <p className="kicker">
              <Link to={`/trilhas/${t.id}`}>{t.titulo}</Link>
            </p>
            {doGrupo.map((c) => {
              const vids = (videos ?? []).filter((v) => v.co.includes(c.id) && v.lang === 'pt').sort((a, b) => b.v - a.v)
              const txts = (textos ?? []).filter((x) => x.co.includes(c.id)).sort((a, b) => b.views - a.views)
              return (
                <article key={c.id} id={c.id} className="conceito">
                  <h2>{c.termo}</h2>
                  <p>{c.definicao}</p>
                  {vids.length > 0 && (
                    <>
                      <h3>Vídeos ({vids.length})</h3>
                      <ul className="mini-lista">
                        {vids.slice(0, 5).map((v) => (
                          <li key={v.id}>
                            <Link to={`/videos/${v.id}`}>{v.t}</Link>
                          </li>
                        ))}
                      </ul>
                      {vids.length > 5 && (
                        <Link className="externo" to={`/videos?q=${encodeURIComponent(c.chaves[0])}`}>
                          Ver todos na videoteca
                        </Link>
                      )}
                    </>
                  )}
                  {txts.length > 0 && (
                    <>
                      <h3>Textos ({txts.length})</h3>
                      <ul className="texto-lista compacta">
                        {txts.slice(0, 3).map((x) => (
                          <TextoItem key={x.id} x={x} />
                        ))}
                      </ul>
                    </>
                  )}
                </article>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}
