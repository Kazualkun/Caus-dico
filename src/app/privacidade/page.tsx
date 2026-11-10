import type { Metadata } from "next";
import Link from "next/link";
import { DocumentoLegal, TabelaDoc } from "@/components/documento-legal";
import { ContatoAtendimento, ContatoPrivacidade } from "@/components/site-chrome";
import { DATA_DOCUMENTOS, EMPRESA, EXIBIR, VERSAO_PRIVACIDADE } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Como o Causídico trata os dados pessoais de quem usa a plataforma, conforme a LGPD.",
};

const INDICE = [
  { id: "resumo", titulo: "Resumo" },
  { id: "controlador", titulo: "Quem é o responsável" },
  { id: "dados", titulo: "Dados, finalidades e bases legais" },
  { id: "terceiros", titulo: "Dados de terceiros que você insere" },
  { id: "ia", titulo: "Inteligência artificial" },
  { id: "compartilhamento", titulo: "Com quem compartilhamos" },
  { id: "transferencia", titulo: "Transferência internacional" },
  { id: "cookies", titulo: "Cookies" },
  { id: "retencao", titulo: "Por quanto tempo guardamos" },
  { id: "direitos", titulo: "Seus direitos" },
  { id: "seguranca", titulo: "Segurança" },
  { id: "menores", titulo: "Menores de idade" },
  { id: "alteracoes", titulo: "Alterações" },
  { id: "contato", titulo: "Como falar conosco" },
];

export default function PrivacidadePage() {
  return (
    <DocumentoLegal titulo="Política de Privacidade" atualizadoEm={DATA_DOCUMENTOS} versao={VERSAO_PRIVACIDADE} indice={INDICE}>
      <p>
        Esta Política explica como <strong>{EXIBIR.razaoSocial}</strong> (&ldquo;{EMPRESA.nomeFantasia}&rdquo;,
        &ldquo;nós&rdquo;), CNPJ {EXIBIR.cnpj}, {EXIBIR.endereco}, trata os dados
        pessoais de quem usa a plataforma {EMPRESA.nomeFantasia}, conforme a Lei Geral de Proteção de Dados Pessoais (Lei nº
        13.709/2018, LGPD) e o Marco Civil da Internet (Lei nº 12.965/2014).
      </p>

      <h2 id="resumo">Resumo</h2>
      <ul>
        <li>
          Tratamos os dados da sua conta, da sua assinatura e o conteúdo que você envia (contratos, pesquisas e propostas)
          para prestar o serviço que você contratou.
        </li>
        <li>
          As tarefas de inteligência artificial rodam num modelo executado na nossa própria infraestrutura: o conteúdo não é
          enviado a provedores externos de IA. Não usamos seu conteúdo para treinar modelos.
        </li>
        <li>Não vendemos seus dados. Não usamos cookies de publicidade nem de estatística.</li>
        <li>
          Em <Link href="/painel/conta">Minha conta</Link> você corrige seus dados, baixa uma cópia completa e exclui a conta. Os
          demais pedidos vão pelo formulário <Link href="/privacidade/solicitacao">Seus dados (LGPD)</Link>.
        </li>
      </ul>

      <h2 id="controlador">1. Quem é o responsável pelos seus dados</h2>
      <p>
        O controlador dos dados da sua conta é <strong>{EXIBIR.razaoSocial}</strong>, CNPJ {EXIBIR.cnpj}.
      </p>
      {EMPRESA.encarregado ? (
        <p>
          Nosso encarregado pelo tratamento de dados pessoais é <strong>{EMPRESA.encarregado.nome}</strong>, que atende
          pelo e-mail <a href={`mailto:${EMPRESA.encarregado.email}`}>{EMPRESA.encarregado.email}</a>.
        </p>
      ) : (
        <p>
          Ainda não designamos um encarregado pelo tratamento de dados pessoais. Até a designação, o canal de comunicação
          com os titulares é o formulário <Link href="/privacidade/solicitacao">Seus dados (LGPD)</Link>, e os pedidos são
          respondidos pela nossa equipe em até 15 dias.
        </p>
      )}

      <h2 id="dados">2. Quais dados tratamos, para quê e com qual base legal</h2>
      <TabelaDoc
        cabecalho={["Quando", "Dados", "Para quê", "Base legal (LGPD)"]}
        linhas={[
          [
            "Você cria a conta",
            "Nome completo, e-mail, senha (guardada só como hash, sem possibilidade de leitura) e, se quiser, número e UF da OAB",
            "Criar e manter a conta e identificar você nas propostas de honorários",
            "Execução de contrato (art. 7º, V)",
          ],
          [
            "Você completa o perfil",
            "Nome do escritório (opcional)",
            "Exibir nas propostas que você gera",
            "Execução de contrato (art. 7º, V)",
          ],
          [
            "Você assina um plano",
            "Nome, CPF ou CNPJ, celular (opcional), forma de pagamento escolhida e histórico de cobranças (valores, datas, situação e link da fatura)",
            "Gerar a cobrança e a nota fiscal, liberar o plano e atender cancelamentos e reembolsos",
            "Execução de contrato (art. 7º, V) e obrigação legal (art. 7º, II)",
          ],
          [
            "Você usa os módulos",
            "Contratos enviados (texto, PDF ou DOCX), perguntas e fatos das pesquisas e das recomendações de peça, dados das propostas (cliente, caso, valores), processos e prazos, e o resumo ou arquivo do caso enviado para análise na calculadora (este último não é guardado)",
            "Prestar o serviço: auditar, pesquisar, recomendar, calcular e organizar",
            "Execução de contrato (art. 7º, V)",
          ],
          [
            "Você usa o CRM e o link de triagem",
            "Dados dos seus clientes e futuros clientes: nome, telefone, e-mail, cidade, relato do caso e as respostas da triagem",
            "Guardar e organizar esses dados para você, como operador",
            "Definida por você, controlador (em regra, art. 7º, V, a pedido do titular)",
          ],
          [
            "Você usa recursos de IA",
            "Recurso usado, volume processado, duração e se houve falha (sem o conteúdo)",
            "Controlar os limites do plano, custos e falhas",
            "Execução de contrato (art. 7º, V) e legítimo interesse (art. 7º, IX)",
          ],
          [
            "Você entra na conta",
            "Endereço IP, data e hora do acesso, navegador e dispositivo; cookie de sessão",
            "Manter você conectado, segurança, prevenção a fraudes e guarda de registros de acesso",
            "Obrigação legal (art. 7º, II, e Marco Civil, art. 15) e legítimo interesse (art. 7º, IX)",
          ],
          [
            "Você usa o Causídico",
            "Datas de acesso e quantidade de uso de cada módulo (sem o conteúdo)",
            "Estatísticas internas de uso e de faturamento, para gerir e melhorar o serviço",
            "Legítimo interesse (art. 7º, IX)",
          ],
          [
            "Você escreve pelo formulário de contato",
            "Nome, e-mail, assunto e mensagem",
            "Responder e comprovar o atendimento",
            "Legítimo interesse (art. 7º, IX) e, para assinantes, execução de contrato (art. 7º, V)",
          ],
          [
            "Você aceita os Termos e esta Política",
            "Versão aceita, data, hora e IP",
            "Comprovar o aceite",
            "Exercício regular de direitos (art. 7º, VI)",
          ],
          [
            "Você faz um pedido sobre seus dados",
            "Nome, e-mail, tipo de pedido e detalhes",
            "Responder e comprovar o atendimento",
            "Obrigação legal (art. 7º, II, e art. 18)",
          ],
        ]}
      />
      <p>
        Coletamos só o necessário para essas finalidades. Campos opcionais estão identificados nos formulários. Não tratamos
        dados sensíveis sobre você.
      </p>

      <h2 id="terceiros">3. Dados de terceiros que você insere</h2>
      <p>
        Contratos, pesquisas, propostas e casos enviados para análise podem conter dados pessoais de outras pessoas, como seus clientes e as
        partes contrárias. Em relação a esses dados, <strong>você (ou o seu escritório) é o controlador</strong> e o{" "}
        {EMPRESA.nomeFantasia} atua como <strong>operador</strong> (LGPD, art. 5º, VI e VII): tratamos esses dados só para
        executar as tarefas que você aciona, e não os usamos para nenhuma outra finalidade.
      </p>
      <p>
        O mesmo vale para o CRM e para o link de triagem: quem responde à triagem envia os dados a você, advogado, que é o
        controlador; a página de triagem informa isso ao titular, com a finalidade, a sua identificação e a forma de pedir
        acesso ou exclusão. O {EMPRESA.nomeFantasia} avisa você por e-mail que chegou um caso novo, sem o conteúdo das respostas,
        e a IA local sugere a complexidade do caso com identificadores ocultos.
      </p>
      <p>
        Cabe a você ter base legal para inserir esses dados e observar o sigilo profissional. Recomendamos enviar apenas o
        necessário para a análise e omitir dados sensíveis (saúde, origem racial, convicção religiosa, entre outros) que não
        sejam indispensáveis.
      </p>

      <h2 id="ia">4. Inteligência artificial</h2>
      <p>
        A auditoria de contratos, a pesquisa jurídica, a análise do caso na calculadora, a carta-proposta de honorários e a
        explicação de normas usam um modelo de inteligência artificial de código aberto executado na infraestrutura do{" "}
        {EMPRESA.nomeFantasia}. O texto necessário para cada tarefa não é enviado a provedores externos de IA nem sai do
        Brasil por causa dela. A resposta da auditoria, da pesquisa e da carta fica salva na sua conta.
      </p>
      <p>
        <strong>Análise do caso na calculadora de honorários:</strong> o resumo e o arquivo enviados são lidos em memória
        só para gerar a sugestão de complexidade e risco e descartados em seguida. Não ficam no banco de dados, no histórico
        nem nos registros do sistema. Antes da leitura pela IA, CPF, CNPJ, e-mails, telefones, CEPs, números de processo,
        RG e inscrições na OAB são substituídos por marcadores. Guardamos apenas o registro de uso (conta, data, tamanho
        da tarefa e duração), sem o conteúdo, para controle de limites e da capacidade do serviço.
      </p>
      <ul>
        <li>Não usamos o seu conteúdo para treinar modelos de IA.</li>
        <li>
          Os resultados são apoio ao seu trabalho e podem conter erros. Nenhuma decisão sobre você (acesso, conta ou preço) é
          tomada de forma automatizada com base neles.
        </li>
      </ul>

      <h2 id="compartilhamento">5. Com quem compartilhamos</h2>
      <p>Não vendemos dados pessoais. Compartilhamos só o necessário com:</p>
      <ul>
        <li>
          <strong>Asaas</strong> (Brasil): cobrança das assinaturas e emissão de nota fiscal. Recebe nome, CPF ou CNPJ,
          e-mail e celular. Os dados do cartão são digitados na página do Asaas e não passam pelo {EMPRESA.nomeFantasia}.
        </li>
        <li>
          <strong>Resend</strong> (Estados Unidos): envio dos e-mails da conta (confirmação de cadastro, redefinição de senha
          e avisos). Recebe seu e-mail e o conteúdo da mensagem.
        </li>
        <li>
          <strong>Hospedagem e banco de dados</strong>: {EMPRESA.hospedagem}.
        </li>
        <li>
          <strong>Autoridades públicas</strong>, quando exigido por lei ou ordem judicial.
        </li>
        <li>
          <strong>Em caso de reorganização societária</strong> (fusão, aquisição), mantidas as garantias desta Política.
        </li>
      </ul>
      <p>
        Na nossa equipe, o acesso é limitado por função. O suporte vê os dados da conta, da assinatura e a lista de tarefas
        (título e situação), mas não o conteúdo de contratos e pesquisas. Ações administrativas ficam registradas
        numa trilha de auditoria.
      </p>

      <h2 id="transferencia">6. Transferência internacional</h2>
      <p>
        A Resend, que envia os e-mails da conta, processa dados nos Estados Unidos. Essa transferência se apoia no art. 33 da
        LGPD, com cláusulas contratuais de proteção de dados com o fornecedor, nos termos da Resolução CD/ANPD nº 19/2024.
        As tarefas de inteligência artificial não envolvem transferência internacional.
      </p>

      <h2 id="cookies">7. Cookies</h2>
      <p>
        Usamos apenas cookies estritamente necessários: o cookie de sessão <code>causidico.session_token</code>, que mantém
        você conectado por até 30 dias, e cookies técnicos com o mesmo prefixo usados durante o login. Eles não servem para
        publicidade nem para estatística.
      </p>
      <p>
        Não usamos ferramentas de estatística, pixels de publicidade nem conteúdos incorporados de terceiros, e as fontes do
        site são servidas pelo próprio {EMPRESA.nomeFantasia}. Por isso não exibimos aviso de cookies. Se isso mudar, vamos
        pedir sua autorização antes de ativar qualquer cookie não essencial.
      </p>

      <h2 id="retencao">8. Por quanto tempo guardamos</h2>
      <TabelaDoc
        cabecalho={["Dado", "Prazo"]}
        linhas={[
          [
            "Conta e conteúdos (contratos, pesquisas, propostas, clientes, triagens, processos e prazos)",
            "Enquanto a conta existir. Você pode apagar cada item quando quiser; ao excluir a conta, tudo é apagado na hora.",
          ],
          ["Sessão de login", "Até você sair ou até 30 dias sem uso"],
          ["Registros de acesso (IP, data e hora)", "6 meses (Marco Civil da Internet, art. 15)"],
          [
            "Contadores de tentativas de login, cadastro e formulários (só o hash do IP ou do e-mail)",
            "1 dia, para conter ataques de força bruta e abuso",
          ],
          [
            "Cobranças e dados fiscais",
            "5 anos (legislação tributária). Após a exclusão da conta, ficam sem vínculo com o perfil.",
          ],
          ["Comprovante de aceite dos documentos", "Enquanto a conta existir"],
          ["Pedidos sobre dados pessoais", "5 anos após a resposta, para comprovar o atendimento"],
          ["Mensagens do formulário de contato", "2 anos após a resposta"],
          [
            "Métricas de uso da IA e registro das tarefas de IA (tipo, data e situação, sem o conteúdo). O registro continua depois que você apaga o item, para contar o limite mensal do plano.",
            "2 anos",
          ],
          ["Trilha de auditoria de ações administrativas", "5 anos"],
          ["Registro de envio de e-mails", "7 dias"],
        ]}
      />
      <p>Após esses prazos, os dados são eliminados por uma rotina automática diária.</p>

      <h2 id="direitos">9. Seus direitos</h2>
      <p>Pela LGPD (art. 18), você pode, a qualquer momento e sem custo:</p>
      <ul>
        <li>confirmar se tratamos seus dados e acessá-los;</li>
        <li>corrigir dados incompletos, inexatos ou desatualizados;</li>
        <li>pedir a anonimização, o bloqueio ou a eliminação de dados desnecessários ou tratados em desconformidade;</li>
        <li>pedir a portabilidade dos dados a outro fornecedor;</li>
        <li>pedir a eliminação dos dados tratados com base no seu consentimento;</li>
        <li>saber com quem compartilhamos seus dados;</li>
        <li>revogar consentimentos e se opor a tratamentos;</li>
        <li>pedir a revisão de decisões tomadas unicamente com base em tratamento automatizado;</li>
        <li>apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD).</li>
      </ul>
      <p>
        <strong>Como exercer:</strong> em <Link href="/painel/conta">Minha conta</Link> você corrige seus dados, baixa uma
        cópia completa em formato aberto (JSON) e exclui a conta. Para os demais pedidos, use o formulário{" "}
        <Link href="/privacidade/solicitacao">Seus dados (LGPD)</Link>
        {EMPRESA.encarregado && " ou escreva para o encarregado"}. Respondemos em até 15 dias e podemos pedir informações
        para confirmar sua identidade.
      </p>

      <h2 id="seguranca">10. Segurança</h2>
      <p>
        Adotamos medidas técnicas e administrativas para proteger seus dados, entre elas: senhas guardadas apenas como hash,
        conexão criptografada (HTTPS), separação dos dados por conta, acesso da equipe limitado por função, trilha de
        auditoria das ações administrativas e guarda de registros de acesso. Nenhum sistema é totalmente imune a incidentes.
        Se ocorrer um incidente que possa trazer risco ou dano relevante, comunicaremos você e a ANPD nos termos do art. 48
        da LGPD.
      </p>

      <h2 id="menores">11. Menores de idade</h2>
      <p>
        O {EMPRESA.nomeFantasia} é destinado a profissionais e não é direcionado a menores de 18 anos. Se você acredita que
        coletamos dados de um menor, fale conosco para que sejam excluídos.
      </p>

      <h2 id="alteracoes">12. Alterações desta Política</h2>
      <p>
        Podemos atualizar esta Política para refletir mudanças no serviço ou na lei. A data e a versão ficam no topo da
        página. Mudanças relevantes serão comunicadas por e-mail e por aviso no painel antes de entrarem em vigor.
      </p>

      <h2 id="contato">13. Como falar conosco</h2>
      <ul>
        <li>
          <strong>Privacidade e direitos do titular:</strong> <ContatoPrivacidade />
        </li>
        <li>
          <strong>Atendimento geral:</strong> <ContatoAtendimento />
        </li>
        <li>
          <strong>Endereço:</strong> {EXIBIR.endereco}
        </li>
      </ul>
    </DocumentoLegal>
  );
}
