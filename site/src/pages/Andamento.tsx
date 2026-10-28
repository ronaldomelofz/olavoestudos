import { useEffect, useState } from 'react'
import { Carregando } from '../components/Cards'

interface Etapa {
  id: string
  nome: string
  feito: number
  total: number
  detalhe: string
}

interface Painel {
  em: string
  gb: number
  removidos: number
  etapas: Etapa[]
}

function pct(e: Etapa): number {
  if (!e.total) return 0
  return Math.min(100, Math.round((e.feito / e.total) * 100))
}

/** Painel ao vivo na versão local (o Vite regenera /andamento.json). No site público, mostra o último envio. */
export function Andamento() {
  const [painel, setPainel] = useState<Painel | null>(null)
  const [falha, setFalha] = useState(false)

  useEffect(() => {
    let vivo = true
    const ler = () => {
      fetch(`/andamento.json?t=${Date.now()}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('sem painel'))))
        .then((d) => vivo && setPainel(d))
        .catch(() => vivo && setFalha(true))
    }
    ler()
    const relogio = setInterval(ler, 15000)
    return () => {
      vivo = false
      clearInterval(relogio)
    }
  }, [])

  if (!painel && !falha) return <Carregando />

  return (
    <div className="page">
      <p className="kicker">Acervo local</p>
      <h1>Andamento</h1>
      <p className="lede">
        Esta tela acompanha o que já está salvo na pasta do projeto. Atualiza sozinha a cada 15 segundos na versão
        local. Os vídeos removidos do YouTube continuam listados para estudo pessoal e não entram no site público.
      </p>
      {falha && <p>Não foi possível ler o painel.</p>}
      {painel && (
        <>
          <p className="texto-meta">
            Medido em {painel.em} · {painel.gb} GB de vídeo · {painel.removidos} registros só para estudo pessoal
          </p>
          <ol className="andamento">
            {painel.etapas.map((e) => (
              <li key={e.id}>
                <div className="andamento-topo">
                  <strong>{e.nome}</strong>
                  <span>
                    {e.feito.toLocaleString('pt-BR')} / {e.total.toLocaleString('pt-BR')} · {pct(e)}%
                  </span>
                </div>
                <div className="barra" aria-hidden="true">
                  <span style={{ width: `${pct(e)}%` }} />
                </div>
                <p className="texto-meta">{e.detalhe}</p>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  )
}
