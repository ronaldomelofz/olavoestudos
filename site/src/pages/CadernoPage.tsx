import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { Carregando, VideoGrid } from '../components/Cards'
import { exportarMarkdown, importarJSON, useCaderno } from '../lib/caderno'
import { dataBR, useData } from '../lib/data'

function baixar(nome: string, conteudo: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}

export function CadernoPage() {
  const caderno = useCaderno()
  const videos = useData('videos')
  const arquivo = useRef<HTMLInputElement>(null)

  if (!videos) return <Carregando />
  const porId = new Map(videos.map((v) => [v.id, v]))
  const favoritos = Object.keys(caderno.favoritos).map((id) => porId.get(id)).filter((v) => v !== undefined)
  const vistos = Object.entries(caderno.vistos)
    .sort((a, b) => b[1].localeCompare(a[1]))
    .map(([id]) => porId.get(id))
    .filter((v) => v !== undefined)
  const notas = Object.entries(caderno.notas).sort((a, b) => b[1].atualizado.localeCompare(a[1].atualizado))
  const horas = Math.round(vistos.reduce((s, v) => s + v.dur, 0) / 360) / 10

  const importar = async (f: File | undefined) => {
    if (!f) return
    try {
      importarJSON(await f.text())
    } catch {
      alert('Arquivo inválido.')
    }
  }

  return (
    <div className="page page-wide">
      <p className="kicker">Seu progresso</p>
      <h1>Caderno de estudos</h1>
      <p className="lede">
        Tudo fica guardado neste navegador. Faça uma cópia de segurança em JSON para levar a outro
        aparelho, ou exporte em Markdown para colar no Obsidian.
      </p>

      <dl className="stats">
        <div>
          <dt>Assistidos</dt>
          <dd>{vistos.length}</dd>
        </div>
        <div>
          <dt>Horas</dt>
          <dd>{horas}</dd>
        </div>
        <div>
          <dt>Anotações</dt>
          <dd>{notas.length}</dd>
        </div>
        <div>
          <dt>Favoritos</dt>
          <dd>{favoritos.length}</dd>
        </div>
      </dl>

      <div className="acoes">
        <button className="btn btn-primary" onClick={() => baixar('caderno-olavo.md', exportarMarkdown(caderno), 'text/markdown')}>
          Exportar Markdown
        </button>
        <button className="btn btn-ghost" onClick={() => baixar('caderno-olavo.json', JSON.stringify(caderno, null, 1), 'application/json')}>
          Cópia de segurança (JSON)
        </button>
        <button className="btn btn-ghost" onClick={() => arquivo.current?.click()}>
          Restaurar cópia
        </button>
        <input ref={arquivo} type="file" accept="application/json" hidden onChange={(e) => importar(e.target.files?.[0])} />
      </div>

      <section className="bloco">
        <h2>Anotações</h2>
        {notas.length ? (
          <div className="cards-2">
            {notas.map(([id, n]) => (
              <article key={id} className="card nota">
                <Link to={`/videos/${id}`}>
                  <h3>{n.titulo}</h3>
                </Link>
                <p className="texto-meta">{dataBR(n.atualizado)}</p>
                <p className="descricao">{n.texto}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="vazio">Nenhuma anotação ainda. Abra um vídeo e escreva ao lado do player.</p>
        )}
      </section>

      <section className="bloco">
        <h2>Favoritos</h2>
        <VideoGrid videos={favoritos} />
      </section>

      <section className="bloco">
        <h2>Assistidos recentemente</h2>
        <VideoGrid videos={vistos.slice(0, 24)} />
      </section>
    </div>
  )
}
