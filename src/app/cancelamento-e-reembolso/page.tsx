import type { Metadata } from "next";
import Link from "next/link";
import { DocumentoLegal } from "@/components/documento-legal";
import { ContatoAtendimento } from "@/components/site-chrome";
import { PRAZO_ARREPENDIMENTO_DIAS } from "@/lib/billing/arrependimento";
import { DATA_DOCUMENTOS, EMPRESA, VERSAO_TERMOS } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Cancelamento e reembolso",
  description: "Como cancelar a assinatura do Causídico, o direito de arrependimento de 7 dias e como funciona o reembolso.",
};

const INDICE = [
  { id: "arrependimento", titulo: "Arrependimento em 7 dias" },
  { id: "cancelamento", titulo: "Cancelamento após o prazo" },
  { id: "como", titulo: "Como cancelar" },
  { id: "estorno", titulo: "Como o valor volta" },
  { id: "falhas", titulo: "Falhas do serviço" },
  { id: "duvidas", titulo: "Dúvidas" },
];

export default function CancelamentoPage() {
  return (
    <DocumentoLegal titulo="Cancelamento e reembolso" atualizadoEm={DATA_DOCUMENTOS} versao={VERSAO_TERMOS} indice={INDICE}>
      <p>
        Esta política complementa os <Link href="/termos">Termos de Uso</Link> e vale para todas as assinaturas do{" "}
        {EMPRESA.nomeFantasia}, mensais ou anuais.
      </p>

      <h2 id="arrependimento">1. Arrependimento em {PRAZO_ARREPENDIMENTO_DIAS} dias</h2>
      <p>
        Você pode desistir, sem precisar dar motivo, em até <strong>{PRAZO_ARREPENDIMENTO_DIAS} dias corridos</strong>{" "}
        contados do pagamento:
      </p>
      <ul>
        <li>da contratação da assinatura; ou</li>
        <li>da renovação de um plano anual.</li>
      </ul>
      <p>
        Nesses casos, devolvemos <strong>o valor integral pago</strong>, sem multa ou taxa (Código de Defesa do Consumidor,
        art. 49). O acesso aos módulos termina no momento do cancelamento. As renovações de planos mensais seguem a regra da
        seção seguinte.
      </p>

      <h2 id="cancelamento">2. Cancelamento após o prazo</h2>
      <p>
        Depois do prazo de arrependimento, você pode cancelar a qualquer momento, <strong>sem multa</strong>. A renovação é
        interrompida e o acesso continua até o fim do período já pago. Não há reembolso proporcional do período em curso.
      </p>

      <h2 id="como">3. Como cancelar</h2>
      <p>
        Pelo mesmo meio usado para contratar: em <Link href="/painel/conta">Minha conta</Link>, use{" "}
        <strong>Cancelar assinatura</strong>. Dentro do prazo de arrependimento, o botão aparece como{" "}
        <strong>Cancelar e receber o reembolso</strong>, e o estorno é solicitado automaticamente no mesmo momento. A
        confirmação aparece na hora, e a situação da assinatura fica visível em Minha conta.
      </p>
      <p>
        Se preferir, peça o cancelamento pelo atendimento: <ContatoAtendimento />. Excluir a conta também
        cancela a assinatura.
      </p>

      <h2 id="estorno">4. Como o valor volta</h2>
      <p>
        O estorno é feito pelo Asaas, que processa os pagamentos, no mesmo meio usado para pagar. No cartão de crédito, o
        prazo para o crédito aparecer na fatura depende da operadora do cartão. Se o valor não aparecer, fale com o
        atendimento.
      </p>

      <h2 id="falhas">5. Falhas do serviço</h2>
      <p>
        Se o serviço apresentar falha que não seja corrigida, você pode pedir, à sua escolha, a reexecução do serviço, o
        abatimento proporcional do preço ou a devolução do valor pago (Código de Defesa do Consumidor, art. 20). Tarefas de
        IA que terminam com erro não contam no limite do plano e podem ser reprocessadas.
      </p>

      <h2 id="duvidas">6. Dúvidas</h2>
      <p>
        Atendimento: <ContatoAtendimento />. Respondemos em até 5 dias.
      </p>
    </DocumentoLegal>
  );
}
