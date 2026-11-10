import type { Metadata } from "next";
import Link from "next/link";
import { DocumentoLegal, TabelaDoc } from "@/components/documento-legal";
import { ContatoAtendimento } from "@/components/site-chrome";
import { PRAZO_ARREPENDIMENTO_DIAS } from "@/lib/billing/arrependimento";
import { formatBRL } from "@/lib/format";
import { DATA_DOCUMENTOS, EMPRESA, EXIBIR, VERSAO_TERMOS } from "@/lib/legal";
import { PLAN_IDS, PLANS } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description: "Condições de uso da plataforma Causídico: planos, pagamento, cancelamento, uso da IA e responsabilidades.",
};

const INDICE = [
  { id: "servico", titulo: "O serviço" },
  { id: "conta", titulo: "Cadastro e conta" },
  { id: "planos", titulo: "Planos, preços e pagamento" },
  { id: "cancelamento", titulo: "Cancelamento e reembolso" },
  { id: "ia", titulo: "IA e responsabilidade profissional" },
  { id: "conteudo", titulo: "Seu conteúdo" },
  { id: "regras", titulo: "Regras de uso" },
  { id: "acervo", titulo: "Acervo de legislação" },
  { id: "propriedade", titulo: "Propriedade intelectual" },
  { id: "responsabilidade", titulo: "Disponibilidade e responsabilidade" },
  { id: "alteracoes", titulo: "Alterações" },
  { id: "atendimento", titulo: "Atendimento" },
  { id: "foro", titulo: "Lei aplicável e foro" },
];

export default function TermosPage() {
  return (
    <DocumentoLegal titulo="Termos de Uso" atualizadoEm={DATA_DOCUMENTOS} versao={VERSAO_TERMOS} indice={INDICE}>
      <p>
        Estes Termos regulam o uso da plataforma {EMPRESA.nomeFantasia}, oferecida por{" "}
        <strong>{EXIBIR.razaoSocial}</strong>, CNPJ {EXIBIR.cnpj}, {EXIBIR.endereco} (&ldquo;nós&rdquo;).{" "}
        <strong>Ao criar uma conta, você declara que leu e aceita estes Termos.</strong> O tratamento dos seus dados pessoais
        está descrito na <Link href="/privacidade">Política de Privacidade</Link>.
      </p>

      <h2 id="servico">1. O serviço</h2>
      <p>O {EMPRESA.nomeFantasia} é uma plataforma de apoio ao trabalho de advogados e escritórios, com:</p>
      <ul>
        <li>
          calculadora de honorários, com análise do caso por inteligência artificial, comparação às tabelas de honorários da
          OAB e proposta em PDF;
        </li>
        <li>auditoria de contratos com inteligência artificial;</li>
        <li>pesquisa jurídica com fundamentação no acervo de legislação e jurisprudência;</li>
        <li>recomendação da peça processual cabível a partir dos fatos do caso (a IA indica a peça, os requisitos e os fundamentos, sem redigi-la);</li>
        <li>cálculo e controle de prazos processuais cíveis, trabalhistas e penais;</li>
        <li>cadastro de clientes (CRM) e link de triagem para receber casos de futuros clientes;</li>
        <li>
          acervo de legislação federal e estadual, jurisprudência, atos de reguladores e parte da legislação municipal (a
          cobertura de cada esfera é informada na página do acervo).
        </li>
      </ul>
      <p className="destaque">
        <strong>
          O {EMPRESA.nomeFantasia} não presta serviços advocatícios nem consultoria jurídica. Os resultados são ferramentas
          de apoio e não substituem a análise de profissional habilitado.
        </strong>
      </p>

      <h2 id="conta">2. Cadastro e conta</h2>
      <ul>
        <li>O serviço é destinado a maiores de 18 anos.</li>
        <li>Informe dados verdadeiros e mantenha-os atualizados em Minha conta.</li>
        <li>
          A conta é pessoal. Mantenha sua senha em sigilo e avise-nos imediatamente se suspeitar de uso não autorizado.
        </li>
        <li>Você pode encerrar a conta a qualquer momento em Minha conta. A exclusão cancela a assinatura.</li>
      </ul>

      <h2 id="planos">3. Planos, preços e pagamento</h2>
      <TabelaDoc
        cabecalho={["Plano", "Mensal", "Anual", "Limites por mês"]}
        linhas={PLAN_IDS.map((id) => {
          const p = PLANS[id];
          return [
            p.nome,
            formatBRL(p.precoMensalCents),
            formatBRL(p.precoAnualCents),
            `${p.limites.analises} auditorias e ${p.limites.pesquisas.toLocaleString("pt-BR")} pesquisas`,
          ];
        })}
      />
      <ul>
        <li>
          A calculadora de honorários e o acervo de legislação não têm limite mensal em nenhum plano. A análise do caso com IA
          tem limite de 20 por hora por conta, para manter o serviço disponível a todos.
        </li>
        <li>
          Os limites são contados por mês do calendário, renovam no dia 1º e não se acumulam. Cada pedido conta quando entra na fila;
          não contam os que terminam em erro nem os que você apaga antes de começarem. Apagar um resultado já pronto não devolve o
          pedido ao limite do mês.
        </li>
        <li>
          As tarefas de IA de todos os assinantes dividem o mesmo servidor e esperam numa fila; a tela mostra a posição e a previsão.
          Para a fila andar para todos, cada conta pode ter até 3 tarefas na fila ou em andamento ao mesmo tempo.
        </li>
        <li>O pagamento é feito por Pix, boleto ou cartão de crédito, processado pelo Asaas.</li>
        <li>
          <strong>
            A assinatura é renovada automaticamente ao fim de cada período (mês ou ano), pelo mesmo valor, até que você
            cancele.
          </strong>
        </li>
        <li>
          Eventual reajuste será comunicado por e-mail com pelo menos 30 dias de antecedência. Se não concordar, você pode
          cancelar sem multa antes da renovação.
        </li>
        <li>
          Se o pagamento de uma renovação não for confirmado em até 5 dias do vencimento, o acesso aos módulos fica suspenso
          até a regularização. Sua conta e seus dados continuam disponíveis.
        </li>
      </ul>

      <h2 id="cancelamento">4. Cancelamento, arrependimento e reembolso</h2>
      <ul>
        <li>
          Você pode desistir em até <strong>{PRAZO_ARREPENDIMENTO_DIAS} dias</strong> do pagamento da contratação, ou do
          pagamento da renovação anual, com devolução integral do valor pago (Código de Defesa do Consumidor, art. 49).
        </li>
        <li>
          Depois desse prazo, você cancela a qualquer momento em Minha conta, sem multa, e mantém o acesso até o fim do
          período já pago, sem reembolso proporcional.
        </li>
      </ul>
      <p>
        As regras completas estão na <Link href="/cancelamento-e-reembolso">Política de Cancelamento e Reembolso</Link>.
      </p>

      <h2 id="ia">5. Inteligência artificial e responsabilidade profissional</h2>
      <p>
        Auditorias, pesquisas, análises de caso, cartas-proposta e explicações de normas são geradas por um modelo de
        inteligência artificial de código aberto executado na infraestrutura do próprio {EMPRESA.nomeFantasia}, sem envio do
        conteúdo a provedores externos de IA. Cada fundamento citado a partir do acervo traz link para o texto da norma e
        para a fonte oficial.
      </p>
      <p>
        A inteligência artificial do {EMPRESA.nomeFantasia} orienta e recomenda, mas não redige peças processuais, minutas
        de contrato nem cláusulas: a pesquisa indica a peça cabível, com requisitos e prazo, e a auditoria aponta o que
        corrigir em cada cláusula. A redação é sempre do advogado.
      </p>
      <p className="destaque">
        <strong>
          Respostas geradas por IA podem conter erros, omissões ou desatualizações. Antes de usar qualquer resultado com um
          cliente ou em juízo, confira-o na legislação e na jurisprudência oficiais. A decisão profissional e a
          responsabilidade técnica pelo uso dos resultados são do advogado responsável.
        </strong>
      </p>
      <p>Não usamos o seu conteúdo para treinar modelos de inteligência artificial.</p>

      <p className="destaque">
        <strong>
          O cálculo de prazos aplica as regras do CPC, da CLT e do CPP e mostra cada dia contado, mas feriados locais e
          suspensões do tribunal só entram se você os informar. Confira sempre o calendário oficial do tribunal: o controle e
          o cumprimento dos prazos são responsabilidade do advogado.
        </strong>
      </p>

      <h2 id="conteudo">6. Seu conteúdo e dados de terceiros</h2>
      <ul>
        <li>
          Você continua titular do conteúdo que envia (contratos, pesquisas e propostas) e nos concede
          licença limitada, não exclusiva e gratuita para armazená-lo e processá-lo apenas para prestar o serviço.
        </li>
        <li>
          Você declara ter o direito de enviar esse conteúdo. Quanto aos dados pessoais de terceiros nele contidos, você é o
          controlador e nós atuamos como operador, conforme a seção 3 da{" "}
          <Link href="/privacidade#terceiros">Política de Privacidade</Link>.
        </li>
        <li>Você pode apagar cada item ou baixar uma cópia de todos os seus dados em Minha conta.</li>
      </ul>

      <p>
        O link de triagem é seu canal de atendimento: divulgue-o a quem procura seus serviços, em conformidade com o Código de
        Ética e Disciplina da OAB e com as regras de publicidade da advocacia (Provimento nº 205/2021 do CFOAB). É vedado usá-lo
        para captação indevida de clientela, inclusive por meio de terceiros. Os dados recebidos pela triagem são de sua
        responsabilidade como controlador.
      </p>

      <h2 id="regras">7. Regras de uso</h2>
      <p>Ao usar o serviço, você se compromete a não:</p>
      <ul>
        <li>compartilhar a conta com outras pessoas ou revender o acesso;</li>
        <li>contornar os limites do plano, as medidas de segurança ou acessar áreas restritas;</li>
        <li>usar robôs, raspagem ou automações para extrair o acervo ou sobrecarregar o sistema;</li>
        <li>enviar conteúdo ilícito ou que viole direitos de terceiros;</li>
        <li>copiar, descompilar ou explorar comercialmente o software sem autorização.</li>
      </ul>
      <p>
        Em caso de descumprimento, podemos advertir, suspender ou encerrar a conta. Informaremos o motivo e você poderá
        contestar pelo atendimento, salvo quando a lei exigir ação imediata.
      </p>

      <h2 id="acervo">8. Acervo de legislação</h2>
      <p>
        O acervo é formado a partir do projeto aberto{" "}
        <a href="https://github.com/ctresb/leis" rel="noreferrer">
          ctresb/leis
        </a>{" "}
        e de fontes oficiais, e é atualizado periodicamente. Pode haver atraso ou diferença em relação à publicação oficial,
        que sempre prevalece. Cada norma traz o link para a sua fonte oficial.
      </p>

      <h2 id="propriedade">9. Propriedade intelectual</h2>
      <p>
        A marca, o software, o layout e os textos próprios do {EMPRESA.nomeFantasia} pertencem a{" "}
        {EXIBIR.razaoSocial} ou a seus licenciadores. Os textos de normas e decisões judiciais são públicos.
        As propostas e os relatórios gerados para você podem ser usados livremente no seu trabalho.
      </p>

      <h2 id="responsabilidade">10. Disponibilidade e responsabilidade</h2>
      <ul>
        <li>
          Trabalhamos para manter o serviço disponível e seguro, mas podem ocorrer interrupções para manutenção (avisadas
          sempre que possível) ou por fatores fora do nosso controle.
        </li>
        <li>
          <strong>
            Não respondemos por conteúdos de sites de terceiros acessados por links, nem por danos causados pelo uso do
            serviço em desacordo com estes Termos.
          </strong>
        </li>
        <li>Nada nestes Termos limita direitos garantidos pelo Código de Defesa do Consumidor.</li>
      </ul>

      <h2 id="alteracoes">11. Alterações destes Termos</h2>
      <p>
        Podemos atualizar estes Termos. Mudanças relevantes serão comunicadas por e-mail com pelo menos 30 dias de
        antecedência. Se não concordar, você pode cancelar sem ônus antes da vigência. A versão aceita fica registrada na
        sua conta.
      </p>

      <h2 id="atendimento">12. Atendimento</h2>
      <p>
        Atendimento: <ContatoAtendimento />. Respondemos em até 5 dias. Pedidos
        sobre dados pessoais seguem a <Link href="/privacidade#direitos">Política de Privacidade</Link>.
      </p>

      <h2 id="foro">13. Lei aplicável e foro</h2>
      <p>
        Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca{" "}
        {EMPRESA.foro ? `de ${EMPRESA.foro}` : "da sede da empresa"},{" "}
        <strong>ressalvado o direito do consumidor de propor ação no foro do seu domicílio</strong>.
      </p>
    </DocumentoLegal>
  );
}
