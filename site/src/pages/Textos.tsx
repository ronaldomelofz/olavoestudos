import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Carregando, Externo, TextoItem } from '../components/Cards'
import { SITE, milhar, normalizar, useData } from '../lib/data'

const PASSO = 60

export function Textos() {
  const textos = useData('textos')
  const curadoria = useData('curadoria')
  const seminario = useData('seminario')
  const [params, setParams] = useSearchParams()
  const [limite, setLimite] = useState(PASSO)

  const f = {
    q: params.get('q') ?? '',
    tipo: params.get('tipo') ?? '',
    tema: params.get('tema') ?? '',
    trilha: params.get('trilha') ?? '',
    decada: params.get('decada') ?? '',
    ordem: params.get('ordem') ?? 'recentes',
  }

  const definir = (chave: keyof typeof f, valor: string) => {
    const novo = new URLSearchParams(params)
    if (valor) novo.set(chave, valor)
    else novo.delete(chave)
    setParams(novo, { replace: true })
    setLimite(PASSO)
  }

  const decadas = useMemo(
    () => [...new Set((textos ?? []).map((x) => x.d.slice(0, 3)).filter(Boolean))].sort(),
    [textos],
  )

  const filtrados = useMemo(() => {
    if (!textos) return []
    const termos = normalizar(f.q).split(/\s+/).filter(Boolean)
    const lista = textos.filter((x) => {
      if (f.tipo && x.tipo !== f.tipo) return false
      if (f.tema && !x.temas.includes(f.tema)) return false
      if (f.trilha && !x.tr.includes(f.trilha)) return false
      if (f.decada && !x.d.startsWith(f.decada)) return false
      if (termos.length) {
        const alvo = normalizar(`${x.t} ${x.desc}`)
        if (!termos.every((t) => alvo.includes(t))) return false
      }
      return true
    })
    if (f.ordem === 'lidos') return lista.sort((a, b) => b.views - a.views)
    if (f.ordem === 'antigos') return lista.sort((a, b) => a.d.localeCompare(b.d))
    return lista.sort((a, b) => b.d.localeCompare(a.d))
  }, [textos, params])

  if (!textos || !curadoria || !seminario) return <Carregando />

  return (
    <div className="page">
      <p className="kicker">Acervo escrito</p>
      <h1>Textos e artigos</h1>
      <p className="lede">
        Índice dos {milhar(textos.length)} textos publicados no{' '}
        <Externo href={`${SITE}/textos`}>Seminário de Filosofia</Externo>: artigos de imprensa,
        apostilas e ensaios, de 1998 a 2022. Aqui ficam o título, a data e um trecho de abertura;
        a leitura integral é feita no site oficial.
      </p>

      <div className="filtros">
        <input
          type="search"
          placeholder="Buscar no título e na abertura…"
          value={f.q}
          onChange={(e) => definir('q', e.target.value)}
          aria-label="Buscar textos"
        />
        <select value={f.tipo} onChange={(e) => definir('tipo', e.target.value)} aria-label="Tipo">
          <option value="">Todos os tipos</option>
          <option value="artigo">Artigos de imprensa</option>
          <option value="texto">Textos e apostilas</option>
        </select>
        <select value={f.tema} onChange={(e) => definir('tema', e.target.value)} aria-label="Tema">
          <option value="">Todos os temas</option>
          {seminario.temas.map((t) => (
            <option key={t.id} value={t.tag}>
              {t.tag} ({t.arts})
            </option>
          ))}
        </select>
        <select value={f.trilha} onChange={(e) => definir('trilha', e.target.value)} aria-label="Trilha">
          <option value="">Todas as trilhas</option>
          {curadoria.trilhas.map((t) => (
            <option key={t.id} value={t.id}>
              {t.titulo}
            </option>
          ))}
        </select>
        <select value={f.decada} onChange={(e) => definir('decada', e.target.value)} aria-label="Década">
          <option value="">Todas as décadas</option>
          {decadas.map((d) => (
            <option key={d} value={d}>
              Anos {d}0
            </option>
          ))}
        </select>
        <select value={f.ordem} onChange={(e) => definir('ordem', e.target.value)} aria-label="Ordem">
          <option value="recentes">Mais recentes</option>
          <option value="antigos">Mais antigos</option>
          <option value="lidos">Mais lidos</option>
        </select>
      </div>

      <p className="contagem">{milhar(filtrados.length)} textos</p>
      <ul className="texto-lista">
        {filtrados.slice(0, limite).map((x) => (
          <TextoItem key={x.id} x={x} />
        ))}
      </ul>
      {filtrados.length > limite && (
        <button className="btn btn-ghost" onClick={() => setLimite((l) => l + PASSO)}>
          Mostrar mais ({milhar(filtrados.length - limite)} restantes)
        </button>
      )}
    </div>
  )
}
