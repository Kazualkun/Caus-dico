# Auditoria Jurídica — Causídico

**Data:** 28/10/2026 (revisada em 29/10/2026) · **Gerado com:** skill blindagem-juridica · **Modo:** corrigir

> ⚖️ Este relatório é uma auditoria técnica automatizada e **não constitui parecer jurídico**.
> Ele reduz riscos, mas não garante ausência de questionamentos. Os Termos de Uso, a Política de
> Cancelamento e Reembolso e a Política de Privacidade devem ser revisados por advogado(a) antes do lançamento.

## Placar

| # | Item | Antes | Depois | Observação |
|---|------|-------|--------|-----------|
| 1 | Política de privacidade | ❌ | ⚠️ | Página criada a partir do mapa de dados real; identificação da empresa ainda provisória |
| 2 | Termos de uso | ❌ | ⚠️ | Página criada, aceite registrado com versão, data e IP; identificação e foro provisórios |
| 3 | Aviso de cookies | ✅ | ✅ | Só cookies estritamente necessários (sessão); banner dispensado e explicado na política |
| 4 | Política de reembolso | ❌ | ✅ | Página criada; cancelamento com estorno automático em 7 dias já existia em Minha conta |
| 5 | Formulários (LGPD) | ⚠️ | ✅ | Aceite desmarcado e separado; aviso de finalidade no formulário LGPD e no checkout |
| 6 | Só dados necessários | ✅ | ✅ | OAB, escritório e celular opcionais; CPF/CNPJ só no checkout (cobrança e nota fiscal) |
| 7 | Scripts de rastreamento | ✅ | ✅ | Nenhum rastreador, pixel ou embed; fontes servidas pelo próprio site |
| 8 | Acessibilidade geral | ⚠️ | ✅ | Link "Pular para o conteúdo", âncora em todas as páginas, declaração de acessibilidade |
| 9 | Alt nas imagens | ✅ | ✅ | Nenhuma `<img>` sem `alt`; ícones decorativos com `aria-hidden` |
| 10 | Contraste | ✅ | ✅ | Tokens de texto e gráficos com contraste AA (validados na construção do painel) |
| 11 | Navegação por teclado | ⚠️ | ✅ | Elementos nativos e foco visível; faltava o link de pular navegação |
| 12 | Avaliações e depoimentos | ➖ | ➖ | Não há depoimentos nem avaliações no site |
| 13 | Promessas e publicidade | ⚠️ | ✅ | Alegações absolutas sobre a IA e sobre a legislação reescritas para o que o sistema comprova (ver "Decisões tomadas") |
| 14 | Direitos autorais | ✅ | ✅ | Sem imagens de terceiros; fontes Google (licença OFL) hospedadas localmente; acervo atribuído a ctresb/leis |
| 15 | Dados da empresa | ❌ | ⚠️ | Rodapé com identificação em todas as áreas; a empresa ainda não foi aberta e o site diz isso |
| 16 | Conformidade LGPD | ⚠️ | ✅ | Canal do titular funcionando sem encarregado, exportação e exclusão, retenção automática, trilha de auditoria |
| 17 | Outros riscos jurídicos | ⚠️ | ⚠️ | Aviso de que a ferramenta não presta serviço advocatício; contratos com operadores pendentes |
| 18 | Atendimento ao consumidor (Decreto 7.962/2013, art. 4º) | ⚠️ | ✅ | Formulário `/contato` em todas as páginas, protocolo por e-mail, fila com prazo de 5 dias na administração |

Legenda: ✅ Conforme · ⚠️ Parcial · ❌ Não conforme · ➖ Não se aplica

**Riscos restantes mais importantes:**
1. **A empresa não foi aberta** (informado pelo usuário em 28/10/2026). O site se identifica como "Causídico (empresa em constituição)", sem CNPJ, endereço nem canal de atendimento. Isso basta para testes e demonstrações, mas **não atende ao Decreto 7.962/2013, art. 2º, para vender**: não abra o checkout ao público antes de preencher `src/lib/legal.ts`.
2. Contratos de tratamento de dados (DPA) com Anthropic, Resend e a hospedagem ainda não foram firmados; a política declara cláusulas contratuais para a transferência internacional (LGPD, art. 33; Resolução CD/ANPD nº 19/2024).

## O que foi corrigido

### 1, 2 e 4. Documentos legais inexistentes
- **Problema:** o cadastro, o checkout e Minha conta linkavam `/termos`, `/privacidade` e `/cancelamento-e-reembolso`, que não existiam (404). O aceite era registrado sobre documentos que o usuário não conseguia ler (CDC, art. 46; LGPD, art. 9º).
- **Correção:** páginas criadas com o layout do site, índice, data e versão visíveis, corpo com 16 px (CDC, art. 54, § 3º) e cláusulas limitativas em destaque (art. 54, § 4º). Preços e limites dos termos vêm de `PLANS`, e o prazo de arrependimento vem de `PRAZO_ARREPENDIMENTO_DIAS`, para não divergirem do código. Arquivos: `src/app/privacidade/page.tsx`, `src/app/termos/page.tsx`, `src/app/cancelamento-e-reembolso/page.tsx`, `src/components/documento-legal.tsx`, `src/app/globals.css`.

### 15. Identificação do fornecedor
- **Problema:** o rodapé não identificava a empresa nem trazia links legais; cadastro, checkout e painel não tinham rodapé (Decreto 7.962/2013, art. 2º).
- **Correção:** `IdentificacaoEmpresa`, `ContatoAtendimento`, `LinksLegais` e `RodapeCompacto` em `src/components/site-chrome.tsx`, usados no rodapé do site e nos layouts de cadastro, checkout e painel. Enquanto a empresa não existe, os dados são `null` em `src/lib/legal.ts` e aparecem como "em constituição" ou "a definir"; nenhum dado foi inventado. O painel Administração → Sistema lista o que falta.

### 16. Direitos do titular e retenção
- **Problema:** o formulário de solicitação do titular existia sem página (`/privacidade/solicitacao` dava 404), e a retenção só apagava registros de acesso e e-mails (LGPD, arts. 15, 16 e 18).
- **Correção:** página `src/app/privacidade/solicitacao/page.tsx`. Sem encarregado designado, o formulário é o canal oficial (Res. CD/ANPD nº 2/2022) e cada pedido avisa por e-mail os administradores, para o prazo de 15 dias não passar despercebido. Retenção ampliada em `src/lib/registros.ts` e executada todo dia por `src/app/api/cron/diario/route.ts`, agendada em `vercel.json`.

### 8 e 11. Acessibilidade
- **Problema:** não havia link para pular a navegação (WCAG 2.4.1) e as páginas públicas não tinham âncora de conteúdo.
- **Correção:** link "Pular para o conteúdo" em `src/app/layout.tsx` e `id="conteudo"` no `<main>` de todas as áreas. Declaração em `src/app/acessibilidade/page.tsx` com as limitações conhecidas (Lei 13.146/2015, art. 63).

## Decisões tomadas (delegadas pelo usuário em 28/10/2026)

| Arquivo | Antes | Depois | Motivo |
|---------|-------|--------|--------|
| `src/app/page.tsx:139` | "…e nenhum número de processo é inventado." | "…e a IA é instruída a não citar números de processo fora do acervo." | A garantia absoluta dependia só de instruções ao modelo (`src/lib/ai/prompts.ts`); a nova frase descreve o que o código faz (CDC, art. 37). |
| `src/lib/legal.ts` | Marcadores `[[PREENCHER]]` grifados | Campos `null` exibidos como "em constituição"/"a definir" | Não há dados oficiais da empresa; publicar CNPJ ou endereço fictícios seria informação falsa ao consumidor. |
| `src/components/acervo/compromisso.tsx` (página inicial, acervo e pesquisa) | Pedido (29/10/2026): "todos os artigos seguem corretamente a legislação brasileira" | "Legislação com procedência": fonte oficial em cada norma, conferência artigo por artigo, dupla revisão, integridade verificada todo dia; e "em caso de divergência, vale o Diário Oficial" | A garantia absoluta não é comprovável: o acervo tem 1,2 milhão de normas compiladas por terceiro (ctresb/leis) e só as conferidas foram batidas com a fonte. Publicidade vincula o fornecedor (CDC, art. 30) e a enganosa é proibida (art. 37, § 1º). Cada frase publicada corresponde a um mecanismo do código, e a página do acervo mostra quantas normas já foram conferidas. |

## Documentos criados

| Documento | Arquivo | Rota | Linkado em |
|-----------|---------|------|-----------|
| Política de Privacidade | `src/app/privacidade/page.tsx` | `/privacidade` | rodapé, cadastro, checkout, formulário LGPD, termos |
| Termos de Uso | `src/app/termos/page.tsx` | `/termos` | rodapé, cadastro, checkout |
| Cancelamento e reembolso | `src/app/cancelamento-e-reembolso/page.tsx` | `/cancelamento-e-reembolso` | rodapé, checkout, Minha conta, termos |
| Seus dados (LGPD) | `src/app/privacidade/solicitacao/page.tsx` | `/privacidade/solicitacao` | rodapé, política de privacidade |
| Declaração de acessibilidade | `src/app/acessibilidade/page.tsx` | `/acessibilidade` | rodapé |

## O que depende de você

- [ ] 🔴 Ao abrir a empresa, preencher em `src/lib/legal.ts`: razão social, CNPJ, endereço, e-mail e telefone de atendimento, encarregado (ou manter o formulário como canal, se for agente de pequeno porte) e foro. Só então abrir o checkout ao público.
- [ ] 🟠 Firmar ou aceitar os termos de tratamento de dados (DPA) da Anthropic, da Resend e da hospedagem, com as cláusulas-padrão da ANPD para a transferência internacional. Confirmar no contrato da Anthropic que o conteúdo da API não é usado para treino, como dizem a política e os termos.
- [ ] 🟡 Antes de mudar Termos ou Política, avisar por e-mail com 30 dias de antecedência (compromisso dos documentos) e atualizar `VERSAO_TERMOS`/`VERSAO_PRIVACIDADE` e `DATA_DOCUMENTOS` em `src/lib/legal.ts`.
- [ ] Revisão por advogado(a) dos Termos de Uso, da Política de Cancelamento e Reembolso e da Política de Privacidade.

### Dados provisórios em `src/lib/legal.ts`
| Campo | Exibido hoje como |
|-------|-------------------|
| `razaoSocial` | Causídico (empresa em constituição) |
| `cnpj` | em constituição |
| `endereco` | endereço a definir na abertura da empresa |
| `emailAtendimento`, `telefone` | formulário de contato (`/contato`); e-mail e telefone aparecem quando preenchidos |
| `encarregado` | formulário Seus dados (LGPD), com aviso aos administradores |
| `foro` | comarca da sede da empresa |
| `hospedagem` | banco de dados PostgreSQL no Neon (região a definir) e hospedagem da aplicação a definir |

## Perfil e respostas (usado na próxima execução)

- **Tipo de negócio:** SaaS por assinatura para advogados e escritórios, com IA.
- **Stack:** Next.js 16 (App Router), PostgreSQL + Drizzle, Better Auth, Asaas, Claude API, Resend.
- **Empresa:** ainda não constituída (resposta do usuário em 28/10/2026); dados provisórios, sem invenção.
- **Encarregado/canal:** não designado; canal = formulário `/privacidade/solicitacao`.
- **Público:** profissionais (advogados), maiores de 18 anos; sem atendimento direcionado ao exterior.
- **Reembolso (decisão do usuário):** 7 dias de arrependimento na contratação e na renovação anual, com estorno integral; depois, cancela sem multa e mantém o acesso até o fim do período, sem reembolso proporcional.
- **Retenção:** conta e conteúdos enquanto a conta existir; sessão 30 dias; registros de acesso 6 meses; e-mails 7 dias; contadores de tentativas 1 dia; métricas de IA 2 anos; mensagens de contato 2 anos após a resposta; auditoria, pedidos LGPD respondidos e cobranças 5 anos (padrões sugeridos pela skill).
- **Mapa de dados:**

| Dado | Onde é coletado | Finalidade | Base legal | Onde fica | Compartilhado com |
|------|-----------------|-----------|-----------|-----------|-------------------|
| Nome, e-mail, senha (hash), OAB (opcional) | Cadastro | Conta e propostas | Execução de contrato | `users`, `accounts` | Resend (e-mails) |
| Nome do escritório | Minha conta | Propostas | Execução de contrato | `users` | — |
| Nome, CPF/CNPJ, celular (opcional) | Checkout | Cobrança e nota fiscal | Execução de contrato; obrigação legal | `users`, `subscriptions` | Asaas (Brasil) |
| Contratos, minutas, pesquisas, propostas | Módulos | Prestar o serviço | Execução de contrato (usuário é controlador dos dados de terceiros) | `contracts`, `search_history`, `pricing_proposals` | Anthropic (EUA) |
| IP, user agent, data e hora | Login | Segurança; Marco Civil art. 15 | Obrigação legal; legítimo interesse | `registros_acesso`, `sessions` | — |
| Hash de IP ou e-mail | Login, cadastro, senha, LGPD, checkout | Limite de tentativas | Legítimo interesse (segurança) | `limites_taxa` (1 dia) | — |
| Versão aceita, data, IP | Cadastro | Prova do aceite | Exercício regular de direitos | `aceites_termos` | — |
| Nome, e-mail, pedido | Formulário LGPD | Atender o titular | Obrigação legal | `lgpd_solicitacoes` | Resend (confirmação) |
| Uso de IA (sem conteúdo) | Módulos | Limites, custos, falhas | Execução de contrato; legítimo interesse | `ai_usage` | — |
| Nome, e-mail, assunto, mensagem | Formulário de contato | Responder e comprovar o atendimento | Legítimo interesse; execução de contrato | `contatos` (2 anos após a resposta) | Resend (confirmação e resposta) |
| Datas de acesso e contagem de uso por módulo | Uso do site | Estatísticas internas (painel de desempenho) | Legítimo interesse | consultas sobre `registros_acesso` e módulos | — |
| Cobranças (valor, forma, situação, datas) | Webhook do Asaas | Faturamento e conciliação | Execução de contrato; obrigação legal | `pagamentos` (5 anos) | — |

- **Rastreadores e categoria:** nenhum. Cookies: `causidico.session_token` e cookies técnicos de login (necessários).
- **Decisões do usuário:** banco único em PostgreSQL (local, depois Neon); acervo completo; empresa ainda não constituída; reembolso "7 dias + cancelar sem multa"; preenchimento das pendências delegado (28/10/2026).

## Como manter
- Rode a skill novamente ao adicionar formulários, scripts de terceiros, novos fornecedores ou páginas de venda.
- Atualize a data e a versão das políticas sempre que mudar o tratamento de dados.
- Revise este relatório a cada 12 meses.

## 2026-10-29 — IA local, IA que não redige e cobertura do acervo

- **Fim da transferência internacional para IA.** As tarefas de IA passaram da Anthropic (EUA) para um modelo aberto (Qwen) executado pelo Ollama na infraestrutura do Causídico. Termos (seção 5) e Política de Privacidade (resumo, seções 4, 5 e 6) atualizados; versões dos documentos passaram para 2026-10-29. **Pendente:** quando o servidor de IA de produção for contratado (provedor de GPU), incluí-lo como operador em "Com quem compartilhamos" e, se ficar fora do Brasil, voltar a tratar a transferência internacional (LGPD, art. 33).
- **A IA não redige peças nem minutas** (decisão do usuário): a pesquisa só recomenda a peça cabível, a auditoria indica o que corrigir sem escrever a cláusula e a geração de minutas saiu do site e dos planos (planos mantêm o preço; os destaques foram atualizados). Reduz o risco de a ferramenta ser vista como prestação de serviço advocatício e mantém a redação sob responsabilidade do advogado (EAOAB, art. 1º).
- **Análise do caso na calculadora**: resumo e arquivo lidos em memória e descartados, identificadores mascarados antes da IA (CPF, CNPJ, e-mail, telefone, CEP, processo, RG, OAB), só o registro de uso sem conteúdo é guardado. Nomes não são mascarados automaticamente; a tela pede para evitá-los. Princípios da necessidade e da finalidade (LGPD, art. 6º, I e III).
- **Repasse por indicação**: a calculadora alerta que dividir honorários com quem não é advogado por ter trazido o cliente é infração ética (EAOAB, art. 34, III e IV) e recomenda formalizar a divisão por escrito. O repasse aparece só nas premissas internas, nunca na proposta ao cliente.
- **Mínimo aceitável com impostos**: o mínimo é calculado sobre o líquido (custos e margem) e convertido para o valor cobrado, com impostos e repasse. O campo de impostos traz exemplos (4,5% na 1ª faixa do Anexo IV do Simples Nacional; até 27,5% de IR como pessoa física) e manda confirmar com o contador.
- **Cobertura do acervo** (CDC, arts. 6º, III, e 31): a página do acervo mostra a tabela do PROGRESSO.md do ctresb/leis e uma contagem por estado. Deixa claro que a legislação municipal é parcial e aponta os estados com leis estaduais ausentes ou incompletas (na data: PR sem leis estaduais e RJ parcial). A página inicial e os Termos deixaram de dizer que o acervo inclui "legislação municipal" sem ressalva.

## 2026-10-29 — Peças, prazos, CRM e triagem

- **Peças (recomendação, sem redação):** a pedido do usuário, o "gerador de peças" foi feito como recomendador: indica a peça cabível, procedimento, competência, requisitos legais (ex.: CPC, art. 319), fundamentos, pedidos cabíveis em frases curtas, provas e prazos. O prompt proíbe redigir a peça ou trechos dela, e a tela repete que a redação é do advogado (EAOAB, art. 1º).
- **Citações conferidas no acervo:** cada fundamento citado pela IA é procurado no acervo; artigo inexistente aparece como alerta. Reduz o risco de o advogado usar dispositivo inexistente (dever de informação adequada, CDC, art. 6º, III), mas não substitui a conferência: um artigo existente pode ter sido citado fora de contexto.
- **Prazos:** os Termos (seção 5) passaram a dizer que o cálculo é apoio e que o controle e o cumprimento dos prazos são do advogado; a tela mostra a contagem dia a dia, a base legal e manda conferir o calendário do tribunal. Os dias sem expediente sugeridos só incluem os de respaldo seguro (Justiça Federal: Lei 5.010/1966, art. 62), para nunca alongar um prazo por engano.
- **CRM:** o advogado é controlador dos dados dos clientes e o Causídico, operador (Política de Privacidade, seções 2 e 3; tabela de retenção). Exportação de dados (LGPD, art. 18, V) inclui clientes, triagens, processos, prazos, dias sem expediente e recomendações de peça; excluir a conta apaga tudo (cascata).
- **Link de triagem:** página pública sem indexação, com aviso ao titular (identidade e OAB do advogado, finalidade, base legal do art. 7º, V, da LGPD, papel do Causídico, uso de IA com identificadores ocultos, como pedir acesso ou exclusão) e aceite obrigatório. O e-mail de aviso ao advogado não leva o conteúdo do caso. Os Termos proíbem usar o link para captação indevida de clientela (Código de Ética e Disciplina da OAB; Provimento nº 205/2021 do CFOAB). **Pendente:** quando houver encarregado e canal de atendimento da empresa, citá-los também na página de triagem.
