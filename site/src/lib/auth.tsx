import { createContext, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'

interface AuthCtx {
  ok: boolean
  carregando: boolean
  entrar: (user: string, pass: string) => Promise<boolean>
  sair: () => Promise<void>
}

const Ctx = createContext<AuthCtx>({
  ok: false,
  carregando: true,
  entrar: async () => false,
  sair: async () => {},
})

async function api(method: string, corpo?: unknown) {
  const r = await fetch('/.netlify/functions/login', {
    method,
    credentials: 'same-origin',
    headers: corpo ? { 'Content-Type': 'application/json' } : undefined,
    body: corpo ? JSON.stringify(corpo) : undefined,
  }).catch(() => null)
  if (!r) return { ok: false as const }
  const d = await r.json().catch(() => ({ ok: false }))
  return { ok: Boolean(d.ok) }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ok, setOk] = useState(false)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let vivo = true
    api('GET').then((d) => {
      if (!vivo) return
      setOk(d.ok)
      setCarregando(false)
    })
    return () => {
      vivo = false
    }
  }, [])

  const valor = useMemo<AuthCtx>(
    () => ({
      ok,
      carregando,
      entrar: async (user, pass) => {
        const d = await api('POST', { user, pass })
        setOk(d.ok)
        return d.ok
      },
      sair: async () => {
        await api('DELETE')
        setOk(false)
      },
    }),
    [ok, carregando],
  )

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)

/** Tela de entrada do portal privado — a senha fica só no servidor (função Netlify / middleware local). */
export function LoginGate({ children }: { children: ReactNode }) {
  const { ok, carregando, entrar } = useAuth()
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [erro, setErro] = useState(false)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    document.body.classList.toggle('login-ativo', !ok && !carregando)
    return () => document.body.classList.remove('login-ativo')
  }, [ok, carregando])

  if (carregando) return <p className="carregando">Carregando…</p>
  if (ok) return <>{children}</>

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setEnviando(true)
    setErro(!(await entrar(user, pass)))
    setEnviando(false)
  }

  return (
    <div className="login-tela">
      <form className="login-caixa" onSubmit={enviar}>
        <p className="kicker">Portal privado · estudo pessoal</p>
        <h1>Olavo de Carvalho</h1>
        <p className="lede">
          Acervo local de vídeos, textos, livros e o Curso Online de Filosofia. Acesso restrito a quem estuda neste
          projeto.
        </p>
        <label>
          Usuário
          <input autoComplete="username" value={user} onChange={(e) => setUser(e.target.value)} autoFocus />
        </label>
        <label>
          Senha
          <input type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} />
        </label>
        {erro && <p className="aviso">Usuário ou senha incorretos.</p>}
        <button type="submit" className="btn btn-primary" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
