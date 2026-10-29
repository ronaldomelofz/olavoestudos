import { Link } from 'react-router-dom'
import { Carregando, Externo, LinkSeminario, VideoGrid } from '../components/Cards'
import { useCaderno } from '../lib/caderno'
import { milhar, urlCurso, useData } from '../lib/data'

export function Home() {
  const videos = useData('videos')
  const textos = useData('textos')
  const curadoria = useData('curadoria')
  const seminario = useData('seminario')
  const caderno = useCaderno()

  const horas = videos ? Math.round(videos.reduce((s, v) => s + v.dur, 0) / 3600) : 0
  const vistos = Object.keys(caderno.vistos).length

  return (
    <>
      <section className="hero" aria-label="Abertura">
        <div className="hero-inner">
          <p className="kicker">Estudo · Filosofia · Vida intelectual</p>
          <h1>Olavo de Carvalho</h1>
          <p className="lede">
            Um percurso ordenado pelo acervo do Professor: as aulas e trechos do <em>Curso Online de
            Filosofia</em>, as lives e entrevistas do canal, os textos e os cursos do Seminário de
            Filosofia — organizados em trilhas, conceitos e um plano de doze semanas.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary" to="/trilhas/vida-intelectual">
              Começar pela vida intelectual
            </Link>
            <Link className="btn btn-ghost" to="/plano">
              Ver o plano de 12 semanas
            </Link>
          </div>
        </div>
      </section>

      <div className="page">
        <dl className="stats">
          <div>
            <dt>Vídeos</dt>
            <dd>{videos ? milhar(videos.length) : '…'}</dd>
          </div>
          <div>
            <dt>Horas de aula</dt>
            <dd>{videos ? milhar(horas) : '…'}</dd>
          </div>
          <div>
            <dt>Textos</dt>
            <dd>{textos ? milhar(textos.length) : '…'}</dd>
          </div>
          <div>
            <dt>Cursos</dt>
            <dd>{seminario ? seminario.cursos.length : '…'}</dd>
          </div>
          <div>
            <dt>Assistidos por você</dt>
            <dd>{vistos}</dd>
          </div>
        </dl>

        <p className="kicker">Por onde começar</p>
        <h2>Sete trilhas, uma ordem</h2>
        {!curadoria ? (
          <Carregando />
        ) : (
          <ul className="entry-list">
            {curadoria.trilhas.map((t) => (
              <li key={t.id}>
                <Link to={`/trilhas/${t.id}`}>
                  <span className="num">{String(t.ordem).padStart(2, '0')}</span>
                  <div>
                    <h3>{t.titulo}</h3>
                    <p>{t.subtitulo}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <section className="bloco">
          <p className="kicker">Antes do primeiro vídeo</p>
          <h2>Três portas de entrada</h2>
          <div className="cards-3">
            <article className="card">
              <h3>Quem foi Olavo</h3>
              <p>O retrato escrito pela família, no site oficial — o ponto de partida biográfico.</p>
              <LinkSeminario pasta="textos" slug="quem-e-olavo-de-carvalho">
                Ler no Seminário
              </LinkSeminario>
            </article>
            <article className="card">
              <h3>Aula 425 do COF</h3>
              <p>
                A disciplina da vida intelectual e o mapa da ignorância: aula aberta, ótima síntese do
                método.
              </p>
              <Externo href={urlCurso('curso-online-de-filosofia-cof/1656')}>Assistir aula gratuita</Externo>
            </article>
            <article className="card">
              <h3>Seu caderno</h3>
              <p>Marque vídeos como assistidos, escreva anotações e exporte tudo em Markdown.</p>
              <Link to="/caderno" className="externo">
                Abrir caderno
              </Link>
            </article>
          </div>
        </section>

        <section className="bloco">
          <p className="kicker">Recentes no canal</p>
          <h2>Últimos vídeos</h2>
          {videos ? <VideoGrid videos={videos.slice(0, 8)} /> : <Carregando />}
          <p>
            <Link to="/videos" className="btn btn-ghost">
              Abrir a videoteca completa
            </Link>
          </p>
        </section>
      </div>
    </>
  )
}
