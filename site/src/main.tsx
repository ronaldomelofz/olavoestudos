import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider, LoginGate } from './lib/auth'
import { carregarAcervo } from './lib/data'
import './index.css'

carregarAcervo().finally(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <LoginGate>
            <App />
          </LoginGate>
        </AuthProvider>
      </BrowserRouter>
    </StrictMode>,
  ),
)
