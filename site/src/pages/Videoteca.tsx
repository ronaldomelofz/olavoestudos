import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Carregando, VideoGrid } from '../components/Cards'
import { useCaderno } from '../lib/caderno'
import { milhar, normalizar, useData, useIndiceTextos } from '../lib/data'

const PASSO = 48

const DURACOES: Record<string, [number, number]> = {
  curto: [0, 15 * 60],
  medio: [15 * 60, 60 * 60],
  longo: [60 * 60, Infinity],
}

export function Videoteca() {
  const videos = useData('videos')
  const playlists = useData('playlists')
  const curadoria = useData('curadoria')
  const caderno = useCaderno()
  const indice = useIndiceTextos()
  const [params, setParams] = useSearchParams()
  const [limite, setLimite] = useState(PASSO)

  const f = {
    q: params.get('q') ?? '',
    fonte: params.get('fonte') ?? '',
    trilha: params.get('trilha') ?? '',
    lang: params.get('lang') ?? '',
    dur: params.get('dur') ?? '',
    status: params.get('status') ?? '',
    ordem: params.get('ordem') ?? 'recentes',
  }

  const definir = (chave: keyof typeof f, valor: string) => {
    const novo = new URLSearchParams(params)
    if (valor) novo.set(chave, valor)
    else novo.delete(chave)
    setParams(novo, { replace: true })
    setLimite(PASSO)
  }

  const filtrados = useMemo(() => {
    if (!videos) return []
    const termos = normalizar(f.q).split(/\s+/).filter(Boolean)
    const lista = videos.filter((v) => {
      if (f.fonte === 'videos' || f.fonte === 'streams') {
        if (v.aba !== f.fonte) return false
      } else if (f.fonte === 'oficial') {
        if (v.ext) return false
      } else if (f.fonte === 'complementares') {
        if (!v.ext) return false
      } else if (f.fonte && !v.pl.includes(f.fonte)) return false
      if (f.status === 'texto' && !indice?.[v.id]) return false
      if (f.trilha && !v.tr.includes(f.trilha)) return false
      if (f.lang && v.lang !== f.lang) return false
      if (f.dur) {
        const [min, max] = DURACOES[f.dur]
        if (v.dur < min || v.dur >= max) return false
      }
      if (f.status === 'vistos' && !caderno.vistos[v.id]) return false
      if (f.status === 'nao-vistos' && caderno.vistos[v.id]) return false
      if (f.status === 'favoritos' && !caderno.favoritos[v.id]) return false
      if (f.status === 'notas' && !caderno.notas[v.id]) return false
      if (termos.length) {
        const alvo = normalizar(`${v.t} ${v.desc} ${v.ch.map((c) => c.title).join(' ')}`)
        if (!termos.every((t) => alvo.includes(t))) return false
      }
      return true
    })
    const ordenar: Record<string, (a: typeof lista[0], b: typeof lista[0]) => number> = {
      recentes: (a, b) => (b.d ?? '').localeCompare(a.d ?? ''),
      antigos: (a, b) => (a.d ?? '9').localeCompare(b.d ?? '9'),
      vistos: (a, b) => b.v - a.v,
      longos: (a, b) => b.dur - a.dur,
    }
    return lista.sort(ordenar[f.ordem] ?? ordenar.recentes)
  }, [videos, caderno, params, indice])

  if (!videos || !playlists || !curadoria) return <Carregando />

  return (
    <div className="page page-wide">
      <p className="kicker">Acervo do canal</p>
      <h1>Videoteca</h1>
      <p className="lede">
        Todos os vídeos públicos do canal (aba de vídeos, lives e playlists, incluindo aulas e trechos
        do COF que não aparecem na aba principal) e as coleções complementares de outros canais, como a
        História Essencial da Filosofia e o True Outspeak. A busca percorre título, descrição e capítulos.
      </p>

      <div className="filtros">
        <input
          type="search"
          placeholder="Buscar: paralaxe, Aristóteles, consciência…"
          value={f.q}
          onChange={(e) => definir('q', e.target.value)}
          aria-label="Buscar vídeos"
        />
        <select value={f.fonte} onChange={(e) => definir('fonte', e.target.value)} aria-label="Fonte">
          <option value="">Todas as fontes</option>
          <option value="videos">Aba Vídeos</option>
          <option value="streams">Lives</option>
          <option value="oficial">Só o canal oficial</option>
          <option value="complementares">Só coleções complementares</option>
          {playlists.map((p) => (
            <option key={p.id} value={p.id}>
              {p.origem ? 'Coleção' : 'Playlist'}: {p.titulo}
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
        <select value={f.lang} onChange={(e) => definir('lang', e.target.value)} aria-label="Idioma">
          <option value="">Todos os idiomas</option>
          <option value="pt">Português</option>
          <option value="en">English</option>
        </select>
        <select value={f.dur} onChange={(e) => definir('dur', e.target.value)} aria-label="Duração">
          <option value="">Qualquer duração</option>
          <option value="curto">Até 15 min</option>
          <option value="medio">15 a 60 min</option>
          <option value="longo">Mais de 1 hora</option>
        </select>
        <select value={f.status} onChange={(e) => definir('status', e.target.value)} aria-label="Meu progresso">
          <option value="">Todos</option>
          <option value="nao-vistos">Não assistidos</option>
          <option value="vistos">Assistidos</option>
          <option value="favoritos">Favoritos</option>
          <option value="notas">Com anotação</option>
          {indice && Object.keys(indice).length > 0 && <option value="texto">Com texto da aula</option>}
        </select>
        <select value={f.ordem} onChange={(e) => definir('ordem', e.target.value)} aria-label="Ordem">
          <option value="recentes">Mais recentes</option>
          <option value="antigos">Mais antigos</option>
          <option value="vistos">Mais vistos</option>
          <option value="longos">Mais longos</option>
        </select>
      </div>

      <p className="contagem">{milhar(filtrados.length)} vídeos</p>
      <VideoGrid videos={filtrados.slice(0, limite)} />
      {filtrados.length > limite && (
        <button className="btn btn-ghost" onClick={() => setLimite((l) => l + PASSO)}>
          Mostrar mais ({milhar(filtrados.length - limite)} restantes)
        </button>
      )}
    </div>
  )
}
