import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatLongDate } from "@/lib/format";
import { CONDICOES_GERAIS, cartaPadrao, descreverHonorarios } from "@/lib/pricing/proposal";
import { FORMATOS } from "@/lib/pricing/engine";
import type { ProposalRow } from "@/lib/types";

// Fontes padrão do PDF (Times e Helvetica) já cobrem a acentuação do português.
const TINTA = "#1B2B5E";
const GRAFITE = "#20232B";
const CINZA = "#5D6270";

const s = StyleSheet.create({
  page: { paddingTop: 56, paddingBottom: 64, paddingHorizontal: 64, fontFamily: "Times-Roman", fontSize: 11, color: GRAFITE, lineHeight: 1.5 },
  cabecalho: { borderBottomWidth: 1, borderBottomColor: TINTA, paddingBottom: 10, marginBottom: 24 },
  nome: { fontFamily: "Helvetica-Bold", fontSize: 13, color: TINTA },
  meta: { fontFamily: "Helvetica", fontSize: 9, color: CINZA, marginTop: 2 },
  titulo: { fontFamily: "Times-Bold", fontSize: 16, marginBottom: 4 },
  linha: { flexDirection: "row", marginBottom: 2 },
  rotulo: { fontFamily: "Helvetica", fontSize: 9, color: CINZA, width: 70, paddingTop: 2 },
  secao: { fontFamily: "Helvetica-Bold", fontSize: 10, color: TINTA, marginTop: 18, marginBottom: 6 },
  paragrafo: { marginBottom: 6, textAlign: "justify" },
  item: { flexDirection: "row", marginBottom: 3 },
  marcador: { width: 12 },
  destaque: { borderLeftWidth: 3, borderLeftColor: TINTA, paddingLeft: 10, paddingVertical: 6, backgroundColor: "#F2F4F9" },
  assinatura: { marginTop: 48, width: 240, borderTopWidth: 0.75, borderTopColor: GRAFITE, paddingTop: 4 },
  rodape: { position: "absolute", bottom: 32, left: 64, right: 64, fontFamily: "Helvetica", fontSize: 8, color: CINZA, textAlign: "center" },
});

function Lista({ itens }: { itens: string[] }) {
  return (
    <View>
      {itens.map((item) => (
        <View key={item} style={s.item}>
          <Text style={s.marcador}>•</Text>
          <Text style={{ flex: 1 }}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export function PropostaPdf({
  proposta,
  advogado,
}: {
  proposta: ProposalRow;
  advogado: { nome: string; oab: string | null; escritorio: string | null; email: string };
}) {
  const carta = proposta.proposalLetter ?? cartaPadrao(proposta);

  return (
    <Document title={`Proposta de honorários — ${proposta.clientName}`} author={advogado.nome} language="pt-BR">
      <Page size="A4" style={s.page}>
        <View style={s.cabecalho}>
          <Text style={s.nome}>{advogado.escritorio ?? advogado.nome}</Text>
          <Text style={s.meta}>
            {[advogado.escritorio ? advogado.nome : null, advogado.oab ? `OAB ${advogado.oab}` : null, advogado.email]
              .filter(Boolean)
              .join("   |   ")}
          </Text>
        </View>

        <Text style={s.titulo}>Proposta de honorários advocatícios</Text>
        <View style={s.linha}>
          <Text style={s.rotulo}>Cliente</Text>
          <Text>{proposta.clientName}</Text>
        </View>
        <View style={s.linha}>
          <Text style={s.rotulo}>Assunto</Text>
          <Text style={{ flex: 1 }}>{proposta.caseTitle}</Text>
        </View>
        <View style={s.linha}>
          <Text style={s.rotulo}>Data</Text>
          <Text>{formatLongDate(proposta.createdAt)}</Text>
        </View>

        <Text style={[s.paragrafo, { marginTop: 18 }]}>{carta.apresentacao}</Text>

        <Text style={s.secao}>Escopo dos serviços</Text>
        <Lista itens={carta.escopo} />

        {carta.fora_do_escopo.length > 0 && (
          <>
            <Text style={s.secao}>Não incluído nesta proposta</Text>
            <Lista itens={carta.fora_do_escopo} />
          </>
        )}

        <Text style={s.secao}>Honorários ({FORMATOS[proposta.billingFormat].toLowerCase()})</Text>
        <View style={s.destaque}>
          <Text>{descreverHonorarios(proposta)}</Text>
        </View>
        {carta.justificativa_valor ? <Text style={[s.paragrafo, { marginTop: 8 }]}>{carta.justificativa_valor}</Text> : null}

        <Text style={s.secao}>Condições gerais</Text>
        <Lista itens={CONDICOES_GERAIS} />

        <View style={s.assinatura}>
          <Text>{advogado.nome}</Text>
          {advogado.oab ? <Text style={s.meta}>OAB {advogado.oab}</Text> : null}
        </View>

        <Text
          style={s.rodape}
          render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
