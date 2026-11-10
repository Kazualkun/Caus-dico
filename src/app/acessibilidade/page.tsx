import type { Metadata } from "next";
import { DocumentoLegal } from "@/components/documento-legal";
import { ContatoAtendimento } from "@/components/site-chrome";
import { DATA_DOCUMENTOS, EMPRESA, EXIBIR } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Acessibilidade",
  description: "Compromisso do Causídico com a acessibilidade, o que já foi feito e as limitações conhecidas.",
};

export default function AcessibilidadePage() {
  return (
    <DocumentoLegal titulo="Acessibilidade" atualizadoEm={DATA_DOCUMENTOS}>
      <p>
        {EXIBIR.razaoSocial} tem o compromisso de tornar o {EMPRESA.nomeFantasia} acessível a todas as
        pessoas, incluindo pessoas com deficiência, conforme a Lei Brasileira de Inclusão (Lei nº 13.146/2015, art. 63).
      </p>

      <h2 id="padrao">Padrão adotado</h2>
      <p>
        Buscamos atender às Diretrizes de Acessibilidade para Conteúdo Web (WCAG) 2.2, nível AA, e à ABNT NBR 17225.
      </p>

      <h2 id="feito">O que já fizemos</h2>
      <ul>
        <li>Idioma da página declarado em português, para a leitura correta por leitores de tela.</li>
        <li>Link &ldquo;Pular para o conteúdo&rdquo;, visível ao navegar pelo teclado.</li>
        <li>Navegação completa por teclado, com foco visível em links, botões e campos.</li>
        <li>Formulários com rótulos e mensagens de erro em texto.</li>
        <li>Cores do texto e dos gráficos com contraste revisado.</li>
        <li>Níveis de risco e situações de tarefas indicados também por texto, não só pela cor.</li>
        <li>Zoom liberado e layout que se adapta a telas pequenas.</li>
        <li>Documentos legais com corpo de texto em 16 pixels ou mais.</li>
      </ul>

      <h2 id="limitacoes">Limitações conhecidas</h2>
      <ul>
        <li>
          Os PDFs de propostas de honorários ainda não têm marcação de acessibilidade (PDF com tags). Enquanto isso, o mesmo
          conteúdo pode ser lido na página da proposta, no painel.
        </li>
        <li>
          Alguns textos integrais do acervo trazem tabelas longas, copiadas das fontes oficiais, que podem ser difíceis de
          percorrer com leitores de tela.
        </li>
        <li>Ainda não fizemos testes com pessoas usuárias de tecnologias assistivas. Estão nos nossos planos.</li>
      </ul>

      <h2 id="apoio">Recursos de apoio</h2>
      <p>
        Para aumentar o texto, use <kbd>Ctrl</kbd> + <kbd>+</kbd> (Windows e Linux) ou <kbd>Cmd</kbd> + <kbd>+</kbd> (macOS).
      </p>

      <h2 id="barreira">Encontrou uma barreira?</h2>
      <p>
        Queremos saber. Escreva para o atendimento (<ContatoAtendimento />) descrevendo a página e o
        problema e, se quiser, o navegador e a tecnologia assistiva usados. Respondemos em até 5 dias úteis e oferecemos o
        conteúdo em formato alternativo, se necessário.
      </p>
    </DocumentoLegal>
  );
}
