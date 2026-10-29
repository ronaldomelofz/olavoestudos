import { useEffect, useState } from 'react'
import { Carregando } from '../components/Cards'

interface Etapa {
  id: string
  nome: string
  feito: number
  total: number
  detalhe: string
}

interface Vivo {
  id: string
  nome: string
  estado: 'ativo' | 'pausa' | 'parado' | 'ocioso'
  visto_em: number
  linha: string
  arquivo?: string
  mb?: number
  cpu?: boolean
}

interface Painel {
  agora: number
  em: string
  gb: number
  removidos: number
  vivos: Vivo[]
  etapas: Etapa[]
}

const ROTULO = {
  ativo: 'em execução',
  pausa: 'pausa programada',
  ocioso: 'aberto, sem CPU',
  parado: 'parado',
}

function pct(e: Etapa): number {
  if (!e.total) return 0
  return Math.min(100, Math.round((e.feito / e.total) * 100))
}

/** Relógio local que avança todo segundo, mais a leitura do servidor a cada 2 s. */
export function Andamento() {
  const [painel, setPainel] = useState<Painel | null>(null)
  const [falha, setFalha] = useState(false)
  const [agora, setAgora] = useState(() => Date.now())
  const [recebido, setRecebido] = useState(0)

  useEffect(() => {
    const relogio = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(relogio)
  }, [])

  useEffect(() => {
    let vivo = true
    const ler = () => {
      fetch(`/andamento.json?t=${Date.now()}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('sem painel'))))
        .then((d: Painel) => {
          if (!vivo) return
          setPainel(d)
          setRecebido(Date.now())
          setFalha(false)
        })
        .catch(() => vivo && setFalha(true))
    }
    ler()
    const relogio = setInterval(ler, 3000)
    return () => {
      vivo = false
      clearInterval(relogio)
    }
  }, [])

  if (!painel && !falha) return <Carregando />

  const atraso = recebido ? Math.round((agora - recebido) / 1000) : 0

  return (
    <div className="page">
      <p className="kicker">Acervo local</p>
      <h1>Andamento</h1>
      <p className="lede">
        O relógio de cada processo sobe a cada segundo. Se ele congela, a página perdeu o contato com a pasta.
      </p>
      {falha && <p className="aviso">Sem resposta do medidor há {atraso} s.</p>}
      {painel && (
        <>
          <p className="texto-meta">
            Servidor às {painel.em} · leitura há {atraso} s · {painel.gb} GB de vídeo · {painel.removidos} registros só
            para estudo pessoal
          </p>
          <div className="vivos">
            {painel.vivos.map((v) => {
              const ha = v.visto_em ? Math.max(0, Math.round(agora / 1000 - v.visto_em)) : null
              return (
                <article key={v.id} className={`vivo vivo-${v.estado}`}>
                  <header>
                    <span className="pulso-dot" aria-hidden="true" />
                    <strong>{v.nome}</strong>
                    <em>{ROTULO[v.estado]}</em>
                  </header>
                  <p className="vivo-ha">{ha === null ? 'sem registro' : `há ${ha.toLocaleString('pt-BR')} s`}</p>
                  {v.mb !== undefined && (
                    <p className="vivo-mb">
                      {v.mb.toLocaleString('pt-BR')} MB em gravação
                      {v.arquivo ? ` · ${v.arquivo}` : ''}
                    </p>
                  )}
                  {v.cpu && <p className="texto-meta">CPU em uso desde a leitura anterior</p>}
                  <p className="vivo-linha">{v.linha || 'ainda sem linha no registro'}</p>
                </article>
              )
            })}
          </div>
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
