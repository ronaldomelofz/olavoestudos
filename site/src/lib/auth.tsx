import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

const CHAVE = 'olavo-estudo-sessao'
const USER = import.meta.env.VITE_ESTUDO_USER ?? ''
const PASS = import.meta.env.VITE_ESTUDO_PASS ?? ''

interface AuthCtx {
  ok: boolean
  entrar: (user: string, pass: string) => boolean
  sair: () => void
}

const Ctx = createContext<AuthCtx>({ ok: false, entrar: () => false, sair: () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ok, setOk] = useState(() => {
    try {
      return sessionStorage.getItem(CHAVE) === '1'
    } catch {
      return false
    }
  })

  const valor = useMemo<AuthCtx>(
    () => ({
      ok,
      entrar: (user, pass) => {
        if (!USER || !PASS) return false
        const certo = user.trim() === USER && pass === PASS
        if (certo) {
          sessionStorage.setItem(CHAVE, '1')
          setOk(true)
        }
        return certo
      },
      sair: () => {
        sessionStorage.removeItem(CHAVE)
        setOk(false)
      },
    }),
    [ok],
  )

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)

/** Tela de entrada do portal privado de estudo. */
export function LoginGate({ children }: { children: ReactNode }) {
  const { ok, entrar } = useAuth()
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [erro, setErro] = useState(false)

  useEffect(() => {
    document.body.classList.toggle('login-ativo', !ok)
    return () => document.body.classList.remove('login-ativo')
  }, [ok])

  if (ok) return <>{children}</>

  return (
    <div className="login-tela">
      <form
        className="login-caixa"
        onSubmit={(e) => {
          e.preventDefault()
          setErro(!entrar(user, pass))
        }}
      >
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
        <button type="submit" className="btn btn-primary">
          Entrar
        </button>
      </form>
    </div>
  )
}
