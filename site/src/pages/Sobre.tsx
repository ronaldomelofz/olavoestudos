import { Carregando, Externo, LinkSeminario } from '../components/Cards'
import { SITE, useData } from '../lib/data'

export function Sobre() {
  const curadoria = useData('curadoria')
  if (!curadoria) return <Carregando />

  return (
    <div className="page">
      <p className="kicker">Sobre o estudo</p>
      <h1>O Professor e este projeto</h1>

      <section className="bloco">
        <h2>Olavo de Carvalho (1947–2022)</h2>
        <p>
          Olavo Luiz Pimentel de Carvalho nasceu em Campinas (SP) em 29 de abril de 1947 e morreu em
          24 de janeiro de 2022, nos Estados Unidos, onde vivia desde 2005. Jornalista, ensaísta e
          professor, dedicou-se à filosofia, à crítica cultural e à análise política. A partir de
          2009 conduziu o Curso Online de Filosofia (COF), acompanhado por dezenas de milhares de
          alunos, que ele considerava a peça central de sua obra.
        </p>
        <p>
          Para a biografia escrita pela família, leia{' '}
          <LinkSeminario pasta="textos" slug="quem-e-olavo-de-carvalho">
            Quem é Olavo de Carvalho?
          </LinkSeminario>
        </p>
      </section>

      <section className="bloco">
        <h2>Livros de referência</h2>
        <ul className="livros">
          {[...curadoria.livros]
            .sort((a, b) => a.ano - b.ano)
            .map((l) => (
              <li key={l.titulo}>
                <span className="num">{l.ano}</span>
                <div>
                  <strong>{l.titulo}</strong>
                  <em>{l.tema}</em>
                </div>
              </li>
            ))}
        </ul>
        <p>
          Edições disponíveis na <Externo href="https://livraria.seminariodefilosofia.org/">livraria do Seminário</Externo>.
        </p>
      </section>

      <section className="bloco">
        <h2>Fontes e método</h2>
        <ul>
          <li>
            Canal <Externo href="https://www.youtube.com/@opropriolavodecarvalho">@opropriolavodecarvalho</Externo>: abas
            de vídeos, lives e playlists, catalogadas com yt-dlp (apenas metadados).
          </li>
          <li>
            Coleções complementares de outros canais, que reúnem aulas e entrevistas do Professor: a
            História Essencial da Filosofia (2002–2003), aulas públicas do COF em ordem cronológica, o True
            Outspeak, os canais <Externo href="https://www.youtube.com/@cursoonlinedefilosofia">@cursoonlinedefilosofia</Externo>{' '}
            e <Externo href="https://www.youtube.com/@OlavoREMASTER">@OlavoREMASTER</Externo>, entre outras.
            A descrição desses vídeos é omitida, por ser do canal que os publicou.
          </li>
          <li>
            Texto das aulas (versão local de estudo): legendas do próprio YouTube, com marcação de tempo,
            e retranscrição com Whisper nas aulas completas. A edição só pontua, divide em parágrafos e
            corrige a grafia de nomes, sem resumir nem acrescentar. Cada parágrafo leva ao instante
            correspondente do vídeo, para conferir no áudio.
          </li>
          <li>
            <Externo href={SITE}>olavodecarvalho.com.br</Externo>: índice de cursos, guias e textos
            (título, data e descrição curta). O conteúdo integral permanece no site oficial.
          </li>
          <li>
            Trilhas, conceitos, perguntas e plano: curadoria deste projeto. Os vídeos são ligados às
            trilhas por palavras-chave do título e da descrição, o que pode gerar classificações
            imperfeitas.
          </li>
          <li>Catálogo atualizado em {curadoria.gerado}.</li>
        </ul>
      </section>

      <section className="bloco">
        <h2>Aviso</h2>
        <p>
          Projeto pessoal, sem fins comerciais e sem vínculo com o Seminário de Filosofia ou com a
          família do Professor. Os vídeos são exibidos pelo player oficial do YouTube. Para estudar a
          obra com acompanhamento, procure o{' '}
          <Externo href="https://www.seminariodefilosofia.org">Seminário de Filosofia</Externo>.
        </p>
      </section>
    </div>
  )
}
