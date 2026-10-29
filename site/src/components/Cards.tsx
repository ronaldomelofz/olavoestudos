import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useCaderno } from '../lib/caderno'
import { ACERVO, dataBR, duracao, milhar, thumb, urlGuia, urlTexto } from '../lib/data'
import type { Texto, Video } from '../lib/types'

export function Carregando() {
  return <p className="carregando">Carregando…</p>
}

export function VideoCard({ v }: { v: Video }) {
  const caderno = useCaderno()
  const visto = Boolean(caderno.vistos[v.id])
  return (
    <Link to={`/videos/${v.id}`} className={`video-card ${visto ? 'visto' : ''}`}>
      <div className="video-thumb">
        <img src={thumb(v.id)} alt="" loading="lazy" />
        <span className="video-dur">{duracao(v.dur)}</span>
        {v.off && <span className="video-badge">removido</span>}
        {v.live && <span className="video-badge">live</span>}
        {v.lang === 'en' && <span className="video-badge en">EN</span>}
        {visto && <span className="video-visto" aria-label="Assistido">✓</span>}
      </div>
      <div className="video-info">
        <h3>{v.t}</h3>
        <p>
          {dataBR(v.d)} · {milhar(v.v)} visualizações
          {caderno.favoritos[v.id] ? ' · ★' : ''}
          {caderno.notas[v.id] ? ' · ✎' : ''}
        </p>
      </div>
    </Link>
  )
}

export function VideoGrid({ videos }: { videos: Video[] }) {
  if (!videos.length) return <p className="vazio">Nenhum vídeo encontrado.</p>
  return (
    <div className="video-grid">
      {videos.map((v) => (
        <VideoCard key={v.id} v={v} />
      ))}
    </div>
  )
}

export function TextoItem({ x }: { x: Texto }) {
  const conteudo = (
    <>
      <span className="texto-meta">
        {x.tipo === 'artigo' ? 'Artigo' : 'Texto'} · {dataBR(x.d)}
        {x.au ? ` · ${x.au}` : ''}
        {x.temas.length ? ` · ${x.temas.join(', ')}` : ''}
      </span>
      <strong>{x.t}</strong>
      {x.desc && <span className="texto-desc">{x.desc}…</span>}
    </>
  )
  return (
    <li className="texto-item">
      {ACERVO.textos.has(x.s) ? (
        <Link to={`/textos/${x.s}`}>{conteudo}</Link>
      ) : (
        <a href={urlTexto(x.s)} target="_blank" rel="noreferrer">
          {conteudo}
        </a>
      )}
    </li>
  )
}

/** Abre a cópia salva em ACERVO/SEMINARIO quando existe; senão, o site oficial. */
export function LinkSeminario({ pasta, slug, children }: { pasta: 'textos' | 'guias'; slug: string; children: ReactNode }) {
  const local = pasta === 'textos' ? ACERVO.textos.has(slug) : ACERVO.guias.has(slug)
  if (local) return <Link to={`/${pasta}/${slug}`}>{children}</Link>
  return <Externo href={pasta === 'textos' ? urlTexto(slug) : urlGuia(slug)}>{children}</Externo>
}

export function Externo({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="externo">
      {children}
    </a>
  )
}
