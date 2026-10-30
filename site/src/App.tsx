import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { Trilhas } from './pages/Trilhas'
import { TrilhaPage } from './pages/TrilhaPage'
import { Videoteca } from './pages/Videoteca'
import { VideoPage } from './pages/VideoPage'
import { Playlists } from './pages/Playlists'
import { PlaylistPage } from './pages/PlaylistPage'
import { Textos } from './pages/Textos'
import { TextoPage } from './pages/TextoPage'
import { SeminarioPage } from './pages/SeminarioPage'
import { Conceitos } from './pages/Conceitos'
import { Plano } from './pages/Plano'
import { CadernoPage } from './pages/CadernoPage'
import { Sobre } from './pages/Sobre'
import { Andamento } from './pages/Andamento'
import { Biblioteca } from './pages/Biblioteca'
import { CofAulaPage } from './pages/CofAulaPage'
import { LivroPage } from './pages/LivroPage'
import { PlanetaPage } from './pages/PlanetaPage'
import { Busca } from './pages/Busca'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="trilhas" element={<Trilhas />} />
        <Route path="trilhas/:id" element={<TrilhaPage />} />
        <Route path="videos" element={<Videoteca />} />
        <Route path="videos/:id" element={<VideoPage />} />
        <Route path="playlists" element={<Playlists />} />
        <Route path="playlists/:id" element={<PlaylistPage />} />
        <Route path="textos" element={<Textos />} />
        <Route path="textos/:slug" element={<TextoPage pasta="textos" />} />
        <Route path="guias/:slug" element={<TextoPage pasta="guias" />} />
        <Route path="seminario" element={<SeminarioPage />} />
        <Route path="biblioteca" element={<Biblioteca />} />
        <Route path="biblioteca/cof/:id" element={<CofAulaPage />} />
        <Route path="biblioteca/livros/:slug" element={<LivroPage />} />
        <Route path="biblioteca/planeta/:slug" element={<PlanetaPage />} />
        <Route path="busca" element={<Busca />} />
        <Route path="conceitos" element={<Conceitos />} />
        <Route path="plano" element={<Plano />} />
        <Route path="caderno" element={<CadernoPage />} />
        <Route path="andamento" element={<Andamento />} />
        <Route path="sobre" element={<Sobre />} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  )
}
