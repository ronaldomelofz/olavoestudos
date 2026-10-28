import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'

const LINKS = [
  { to: '/', label: 'Início', end: true },
  { to: '/trilhas', label: 'Trilhas' },
  { to: '/videos', label: 'Videoteca' },
  { to: '/playlists', label: 'Playlists' },
  { to: '/textos', label: 'Textos' },
  { to: '/seminario', label: 'Seminário' },
  { to: '/conceitos', label: 'Conceitos' },
  { to: '/plano', label: 'Plano' },
  { to: '/caderno', label: 'Caderno' },
  { to: '/andamento', label: 'Andamento' },
  { to: '/sobre', label: 'Sobre' },
]

export function Layout() {
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.body.classList.toggle('nav-open', menuOpen)
    return () => document.body.classList.remove('nav-open')
  }, [menuOpen])

  return (
    <div className="shell">
      <header className="topbar">
        <NavLink to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            OC
          </span>
          <span className="brand-text">
            <strong>Olavo de Carvalho</strong>
            <em>Estudos · COF · Seminário</em>
          </span>
        </NavLink>

        <button
          type="button"
          className={`nav-toggle ${menuOpen ? 'open' : ''}`}
          aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav className={`nav ${menuOpen ? 'open' : ''}`} aria-label="Principal">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} onClick={() => setMenuOpen(false)}>
              {l.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="footer">
        <p>
          Projeto pessoal de estudo. Vídeos do canal{' '}
          <a href="https://www.youtube.com/@opropriolavodecarvalho" target="_blank" rel="noreferrer">
            @opropriolavodecarvalho
          </a>{' '}
          e catálogo do{' '}
          <a href="https://olavodecarvalho.com.br" target="_blank" rel="noreferrer">
            Seminário de Filosofia
          </a>
          ; os textos e cursos completos estão no site oficial.
        </p>
      </footer>
    </div>
  )
}
