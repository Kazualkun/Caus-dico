# Causídico — MVP

Plataforma SaaS para advogados: **precificação de honorários** (com análise do caso por IA), **auditoria de contratos**, **recomendação de peças**, **pesquisa jurídica**, **prazos processuais**, **CRM com link de triagem** e um **acervo de legislação** atualizável, com checkout por Pix, cartão ou boleto e uma área administrativa com papéis. A IA roda localmente (Ollama + Qwen) e **orienta, mas não redige**: não gera peças, minutas nem cláusulas.

| Camada | Escolha |
|---|---|
| App | Next.js 16 (App Router, Cache Components, `proxy.ts`), React 19, Tailwind CSS 4, shadcn/ui (Radix) |
| Banco | PostgreSQL 17 com Drizzle ORM. Local sem instalação (`embedded-postgres`); em produção, Neon — basta trocar `DATABASE_URL` |
| Login | Better Auth (e-mail e senha, verificação de e-mail, redefinição de senha, bloqueio de conta) |
| IA | Local, sem API externa: [Ollama](https://ollama.com) com o modelo aberto `qwen3.5:9b`, saídas estruturadas (JSON Schema gerado do Zod e validado de novo) |
| Pagamentos | Asaas: assinatura recorrente com Pix, cartão e boleto, e webhook |
| Acervo | Espelho Git de [ctresb/leis](https://github.com/ctresb/leis) (federal, 27 UFs, municípios, jurisprudência, reguladores e tratados), Diário Oficial da União e normas.leg.br |

## Rodar localmente

```bash
npm install
cp .env.example .env.local        # para testar o checkout, preencha ASAAS_API_KEY
npm run db:iniciar                # sobe o PostgreSQL local na porta 5433 (dados em %LOCALAPPDATA%/causidico)
npm run ia:iniciar                # baixa o Ollama e o qwen3.5:9b (~7,5 GB, só na 1ª vez) e sobe a IA local
npm run db:migrar                 # cria as tabelas
npm run db:semear                 # referências ilustrativas da OAB/SP para a calculadora
npm run acervo:sincronizar        # carga do acervo (retomável; a completa leva horas e ocupa ~10 GB)
npm run dev                       # http://localhost:3000
```

Depois de criar sua conta em `/cadastro`, torne-se desenvolvedor para ver a administração:

```bash
npm run usuario:papel -- seu@email.com desenvolvedor
```

Para testar sem cadastrar ninguém, `npm run usuario:teste` cria uma conta por papel (`dev@`, `admin@`, `suporte@`, `assinante@` com plano Profissional ativo e `novo@`, todas em `causidico.test`) e imprime senhas novas a cada execução. O script recusa rodar se `DATABASE_URL` não for local.

Sem `RESEND_API_KEY`, os e-mails (confirmação, senha, LGPD) não são enviados: ficam em **Administração → Sistema → Caixa de saída**. Para testar só parte do acervo: `npm run acervo:sincronizar -- --escopo federal,jurisprudencia` ou `-- --limite 1000`.

Verificações: `npm run typecheck`, `npm run lint`, `npm run build` e `npm run test:e2e`. Para servidor próprio (VPS), veja [DEPLOY.md](DEPLOY.md); para o dimensionamento da máquina, [CAPACIDADE.md](CAPACIDADE.md).

## Testes de ponta a ponta

`npm run test:e2e` (Playwright, `tests/e2e/`) usa o servidor local e as contas de `npm run usuario:teste`, cujas credenciais ficam em `tests/.auth/contas.json` (fora do git). Cobre:

- **Módulos novos (`tests/e2e/modulos.spec.ts`):** 13 casos de prazo, calculadora e linha do tempo de prazos com processo, cadastro de cliente, proposta que entra no CRM e vira cliente ao ser aceita, envio público pelo link de triagem e link inválido, e recomendação de peça com a IA.
- **Assinante (Profissional):** honorários com proposta e PDF, impostos e repasse por indicação no mínimo, análise do caso com IA (sem gravar o texto), auditoria de três contratos de exemplo (`tests/e2e/fixtures/contratos/`) por texto e por DOCX, ausência de minutas, limite de tamanho do contrato, pesquisa com peça recomendada, acervo (busca, artigo, procedência, cobertura), Minha conta com exportação LGPD e contato. Os itens criados ficam na conta.
- **Equipe:** desempenho, faturamento com CSV, resposta a contato, curadoria em dupla (inclusão aprovada, correção divergente rejeitada, conferência automática, integridade) e as fronteiras de cada papel.
- **Público:** página inicial, contato, documentos legais.
- **Fila de IA (`tests/e2e/fila.spec.ts`):** teto de 3 tarefas por pessoa, posição na fila na tela, painel "Suas análises de IA" e exclusão que tira a tarefa da fila.
- **Acervo (`tests/e2e/acervo-parser.spec.ts`):** rótulo e âncora dos artigos ("Art. 11. O Prêmio…", "Artigo 11 - O Plano…", "Art. 1o", "Art. 5º-A").

Os testes de IA rodam de verdade com a IA local no ar (`npm run ia:iniciar`); sem ela, verificam que a falha chega ao usuário como mensagem clara. Com a IA, a suíte leva bem mais tempo: cada auditoria leva alguns minutos numa placa de 8 GB.

## Papéis e administração

| Papel | Acesso |
|---|---|
| `usuario` | Painel e módulos (com assinatura ativa) |
| `suporte` | + `/admin`: visão geral, usuários (sem o conteúdo de contratos e pesquisas), mensagens de contato, tarefas de IA com reprocessamento |
| `administrador` | + desempenho (clientes, ativos, receita, uso, funil), faturamento (cobranças, CSV, conferência), assinaturas, acervo e curadoria, LGPD, trilha de auditoria |
| `desenvolvedor` | + sistema: saúde do banco, variáveis de ambiente, retenção, caixa de saída de e-mails |

Quem não tem o papel recebe 404 (a área não se revela). Ninguém atribui papel acima do próprio pela interface; o primeiro desenvolvedor é definido com `npm run usuario:papel`. Mudanças de papel e bloqueios ficam na trilha de auditoria.

## Acervo de legislação

- **Carga e atualização**: `npm run acervo:sincronizar` compara o ID de cada arquivo do espelho Git com o gravado no banco e só processa o que mudou; o que saiu do repositório é marcado como removido. A mesma rotina faz a carga inicial e as atualizações, e pode ser interrompida e retomada.
- **Fontes oficiais**: `npm run acervo:dou -- --dias 7` registra publicações recentes do Diário Oficial da União ainda sem texto no acervo; `npm run acervo:enriquecer` traz nomes populares e indexação temática do normas.leg.br.
- **Consulta**: `/painel/acervo` busca por nome, número ou assunto, com filtros por esfera, UF, tipo, área, ano e vigência. Cada norma tem ementa, sumário navegável, link para a fonte oficial e explicação em linguagem simples gerada sob demanda.
- **IA**: pesquisa e auditoria citam o acervo por artigo, com link para a página da norma no artigo exato.

### Curadoria (administradores e desenvolvedores)

Em **Administração → Curadoria do acervo** a equipe inclui normas (ex.: publicada hoje no DOU), corrige texto ou dados e confere normas com a fonte oficial (`src/lib/acervo/curadoria.ts`):

1. Toda alteração indica o link da fonte oficial (gov.br, leg.br, jus.br, mp.br, def.br) e é **conferida automaticamente**: a página é baixada, o texto riscado (revogado) é descartado e cada artigo é procurado nela, ignorando notas de alteração e pontuação; também lista artigos vigentes da fonte que faltam (`src/lib/acervo/conferencia.ts`).
2. Inclusões e correções só entram no acervo com a **aprovação de outra pessoa** (quem propõe não aprova). Se a conferência divergir, o revisor precisa justificar por escrito. A tela de revisão mostra os dados e os artigos alterados lado a lado.
3. A conferência de uma norma sem mudança de texto é registrada na hora quando todos os artigos batem; se não, vai para revisão.
4. O texto aprovado recebe uma **impressão digital SHA-256**; a rotina diária e o botão "Verificar agora" acusam qualquer mudança feita fora desse fluxo.
5. Cada revisão guarda a versão anterior (histórico). Normas curadas não são sobrescritas pela sincronização: se o repositório mudar, aparece um alerta.

O assinante vê na página de cada norma de onde veio o texto e se (e como) foi conferido. A conferência automática depende de a fonte oficial responder: o Planalto, por exemplo, recusa acesso automatizado de alguns servidores, e aí a conferência fica para a revisão manual.

## Rotina diária

`GET /api/cron/diario` com `Authorization: Bearer <CRON_SECRET>` aplica a política de retenção (registros de acesso após 6 meses, e-mails após 7 dias, métricas de IA após 2 anos, mensagens de contato 2 anos após a resposta, auditoria, pedidos LGPD respondidos e cobranças de contas excluídas após 5 anos), verifica o DOU (Seção 1 e edição extra), enriquece 200 normas e confere a integridade dos textos conferidos (SHA-256). Na Vercel, o agendamento já está em `vercel.json` (todo dia às 6h de Brasília); basta definir `CRON_SECRET`. A sincronização Git do acervo precisa de disco e roda num worker (máquina própria ou job agendado) com `npm run acervo:sincronizar`.

## Segurança

- **Autorização no servidor**: toda Server Action e rota de API checa sessão ou papel na primeira linha, e toda consulta de dado de usuário filtra pelo dono. A administração responde 404 a quem não tem o papel, e ninguém age sobre papel igual ou acima do próprio.
- **Limite de tentativas** (`src/lib/limite-taxa.ts`, tabela `limites_taxa`): login (8 por e-mail e 20 por IP a cada 15 min), cadastro, pedido e troca de senha, formulário LGPD e checkout. Os contadores ficam no banco, valem entre instâncias e guardam só o hash da chave.
- **Rotas HTTP do Better Auth**: as de login, cadastro, senha e perfil ficam fechadas (`disabledPaths`), porque o fluxo passa pelas Server Actions, que aplicam os limites e registram o aceite dos termos. Só ficam abertas as que os e-mails usam.
- **Confirmação de e-mail** exigida por padrão; `AUTH_EXIGIR_VERIFICACAO_EMAIL=false` só em desenvolvimento.
- **Cabeçalhos** (`next.config.ts`): proteção contra enquadramento, `nosniff`, política de referência, permissões e HSTS em produção.
- **Links de acesso**: o link de redefinição de senha usa o endereço configurado, nunca o cabeçalho da requisição; em produção, e-mails não enviados não têm o corpo guardado nem registrado.
- **Webhook e rotina diária**: token comparado em tempo constante; o webhook é idempotente pelo `id` do evento.
- **IP do cliente** (`ipDaRequisicao`): `X-Real-IP` ou a última entrada do `X-Forwarded-For` (a que o proxy acrescenta). Num servidor próprio, o Nginx sobrescreve esses cabeçalhos e o Next.js escuta só em `127.0.0.1` ([DEPLOY.md](DEPLOY.md)).
- **Administração**: o layout e cada página conferem o papel antes de qualquer saída. Com a pré-renderização parcial, as páginas renderizam em paralelo com o layout; sem a conferência na página, o cabeçalho estático dela iria no payload. Quem não é da equipe recebe a página "não encontrada" (HTTP 200, porque a casca do layout raiz já saiu), sem nada da área, nem no título.
- **Arquivos enviados**: o DOCX é descompactado com teto de 80 MB antes do leitor (bloqueia a "bomba de ZIP"), e o PDF tem limite de 300 páginas.
- **Busca no acervo**: no máximo 20 mil artigos encontrados entram na ordenação, e cada consulta de busca tem 10 s de tempo máximo no banco (`statement_timeout`). Antes, uma palavra comum ("prazo") levava até 2,5 minutos e segurava uma conexão do banco.
- **Pentest**: 70 verificações automatizadas contra o build de produção em 02/11/2026 (cabeçalhos, acesso sem login, papéis, acesso a dados de outra conta, rotas do Better Auth, CSRF, força bruta, redirecionamento, XSS armazenado, injeção na busca, arquivos maliciosos, cota com pedidos simultâneos). Resultado e correções em [SEGURANCA.md](SEGURANCA.md); para repetir, `npm run seguranca:pentest`.

O `npm audit` aponta avisos moderados em ferramentas de build e desenvolvimento (CLI do shadcn e `drizzle-kit`), que não rodam no servidor em produção.

## Conformidade legal do próprio site

Páginas `/contato`, `/termos`, `/privacidade`, `/cancelamento-e-reembolso`, `/acessibilidade` e `/privacidade/solicitacao` (pedidos de titulares, respondidos em Administração → LGPD). O cadastro registra a versão aceita dos documentos, a data e o IP. Em Minha conta o usuário corrige dados, baixa tudo em JSON e exclui a conta; o cancelamento dentro de 7 dias estorna automaticamente. Detalhes e pendências em [AUDITORIA-JURIDICA.md](AUDITORIA-JURIDICA.md).

A empresa ainda não foi aberta: em `src/lib/legal.ts`, os dados que não existem ficam `null`, e o site mostra "em constituição" ou "a definir", sem inventar nada. Enquanto não houver encarregado de dados, os pedidos LGPD chegam pelo formulário e a administração é avisada por e-mail. **Antes de abrir o site ao público**, preencha esses campos; o painel Administração → Sistema lista o que falta.

## Subir para o Neon

1. Crie o projeto no Neon (PostgreSQL 17) e use a URL com pooling em `DATABASE_URL`.
2. `npm run db:migrar` e `npm run db:semear` (ou importe a tabela real da OAB).
3. Acervo: o completo (1,2 milhão de normas) ocupa cerca de 10 GB. No plano gratuito (0,5 GB), carregue só uma parte, por exemplo `npm run acervo:sincronizar -- --escopo federal,jurisprudencia`. Num plano pago, copie o banco local com `pg_dump`/`pg_restore` ou rode a sincronização completa apontando para o Neon.

## Estrutura

```
.
├─ drizzle/                         migrações (0000: busca textual; 0001: esquema; 0002: limites de tentativas; 0003: curadoria, pagamentos, contato; 0004: CRM, prazos, peças; 0005: fila de IA; 0006: índice do apelido)
├─ tests/e2e/                       testes de ponta a ponta (Playwright) e contratos de exemplo
├─ vercel.json                      agendamento da rotina diária
├─ scripts/
│  ├─ db.mts                        PostgreSQL local: iniciar, parar, status
│  ├─ ia.mts                        IA local (Ollama): iniciar, parar, status, baixar
│  ├─ acervo.mts                    sincronizar, dou, enriquecer, status, rotulos
│  ├─ carga/                        teste de carga: perfis de GPU, emulador, simulação da fila e roteiro com N advogados
│  ├─ usuarios.mts                  papel <email> <papel>, equipe
│  ├─ contas-teste.mts              uma conta de teste por papel (só banco local)
│  └─ semear.mts                    referências ilustrativas da OAB
└─ src/
   ├─ proxy.ts                      redireciona quem não está logado
   ├─ db/                           conexão, esquema do Better Auth e da aplicação
   ├─ app/
   │  ├─ page.tsx, planos/          landing e planos
   │  ├─ (auth)/                    entrar, cadastro, recuperar e redefinir senha
   │  ├─ assinatura/                checkout Asaas e liberação do acesso
   │  ├─ painel/                    módulos, acervo e Minha conta
   │  ├─ admin/                     visão geral, desempenho, faturamento, usuários, contato, IA, assinaturas, acervo, curadoria, LGPD, auditoria, sistema
   │  ├─ termos/, privacidade/, cancelamento-e-reembolso/, acessibilidade/
   │  └─ api/                       auth, webhook do Asaas, cron diário, PDF, DOCX, exportação de dados
   ├─ lib/
   │  ├─ acervo/                    espelho Git, parser, gravação, busca, fontes oficiais
   │  ├─ ai/                        cliente Ollama, equipe de auditoria, pesquisa, análise do caso, explicações
   │  ├─ billing/                   Asaas, webhook, arrependimento
   │  ├─ pricing/                   motor de honorários e proposta
   │  ├─ auth.ts, better-auth.ts    sessão, papéis e assinatura
   │  ├─ legal.ts                   dados da empresa e versões dos documentos
   │  └─ registros.ts               registros de acesso, auditoria, uso de IA e retenção
   └─ components/                   marca, formulários, peças jurídicas, administração, shadcn/ui
```

## Decisões que valem saber

- **PostgreSQL + Better Auth em vez de Supabase**: o mesmo banco roda local e no Neon, sem serviços acoplados. A autorização é feita no servidor: toda consulta de dado de usuário filtra pelo dono.
- **Asaas em vez de Stripe**: o Stripe não cobra assinatura recorrente por Pix no Brasil. A troca de gateway fica isolada em `src/lib/billing/`.
- **Arquivos de contrato**: o PDF ou DOCX é lido em memória para extrair o texto e não é guardado.
- **IA local em vez de API**: o conteúdo não sai do servidor e não há custo por token; o consumo é tempo de GPU. O modelo e o Ollama ficam em `%LOCALAPPDATA%/causidico/ollama`, fora do OneDrive. Uma auditoria faz 4 chamadas, a pesquisa e a peça 2, a análise do caso 1. O uso (tokens e tempo) aparece em Administração → Tarefas e uso de IA.
- **Fila de IA no banco** (`src/lib/ai/fila.ts`, tabela `tarefas_ia`): auditoria, pesquisa, peça e triagem entram numa fila que sobrevive a reinícios (a tarefa de um processo que parou volta para a fila pelo sinal de vida). `IA_PARALELO` define as vagas paralelas, igual ao paralelismo do servidor de IA. Entre as tarefas na fila, passa antes quem tem menos tarefas rodando, e cada pessoa tem no máximo 3 ao mesmo tempo (`IA_MAX_POR_USUARIO`). A triagem pública vai depois das demais. A análise do caso, em que o advogado espera na tela, passa à frente na próxima vaga e desiste depois de 180 s (`IA_ESPERA_MAXIMA_S`). A tela mostra a posição e a previsão, e a administração mostra a fila agora.
- **Cota do plano**: contada na mesma tabela, que não guarda conteúdo. Apagar o item não devolve a cota; erro e cancelamento antes de começar não contam. A cota e o teto por pessoa são conferidos na mesma transação que cria a tarefa, sob uma trava por usuário, então pedidos simultâneos não passam do limite.
- **Protocolo do servidor de IA**: `IA_API=ollama` (padrão) ou `IA_API=openai` para vLLM e SGLang, que agrupam dezenas de tarefas na mesma placa ([DEPLOY.md](DEPLOY.md)).
- **Medido numa RTX 2070 Super (8 GB)**: `qwen3.5:9b` com contexto de 32 mil tokens gera ~24 tokens/s com 81% do modelo na placa; o raciocínio ("thinking") multiplicou o tempo por 18 e fica desligado (`OLLAMA_PENSAR`). O contexto limita o contrato auditado a ~34 mil caracteres (~10 páginas).
- **A IA não redige**: a auditoria aponta o que corrigir (sem cláusula pronta), a pesquisa e o módulo Peças recomendam a peça (requisitos legais, fundamentos, pedidos cabíveis, provas, prazos) e as minutas foram retiradas. A carta-proposta de honorários continua.
- **Citações conferidas no acervo** (`src/lib/acervo/citacoes.ts`): o modelo local erra número de artigo. Depois de cada auditoria, pesquisa e recomendação de peça, cada fundamento citado ("Lei nº 8.245/1991, art. 4º", "CC, art. 422", "art. 51 do CDC") é procurado no acervo; o artigo encontrado vira fonte com o texto oficial e o inexistente vira alerta em vermelho. Não detecta artigo existente citado fora de contexto.
- **Prazos** (`src/lib/prazos/calculo.ts`, funções puras): CPC e CLT em dias úteis, CPP em dias corridos com início em dia útil (Súmula 310 do STF) e prorrogação do vencimento, DJe (Lei 11.419/2006, art. 4º), suspensão de 20/12 a 20/01 (CPC 220, CLT 775-A, CPP 798-A, com a exceção de réu preso) e expediente reduzido (CPC 224, § 1º). Os dias sem expediente sugeridos são conservadores (na dúvida, prazo mais curto); feriados locais e suspensões do tribunal são cadastrados pelo advogado. 13 casos conferidos à mão estão em `tests/e2e/modulos.spec.ts`.
- **CRM e triagem**: o link `/triagem/<código>` é público, sem login, com aviso de privacidade (advogado controlador, Causídico operador), campo invisível contra robôs e limite por IP e por link. O caso vira lead no CRM, e a IA sugere complexidade e risco em segundo plano. Proposta salva na calculadora entra no CRM pelo nome do cliente; proposta aceita torna o lead cliente.
- **Produção com vários advogados**: a Vercel não roda o Ollama. A IA precisa de um servidor com GPU acessível pelo app via `OLLAMA_URL`, em rede privada. O teste de carga com 100 advogados simultâneos e a máquina recomendada estão em [CAPACIDADE.md](CAPACIDADE.md); as ferramentas (`npm run carga:simular`, `carga:emulador`, `carga:teste`) ficam em `scripts/carga/` para repetir o teste na máquina contratada.
- **Acervo, contagens**: as contagens por esfera, área e UF percorrem 1,2 milhão de normas e ficam prontas em `acervo_estado` (`src/lib/acervo/estatisticas.ts`), recalculadas pela rotina diária e ao fim da sincronização. A tela do acervo abria em até 30 s com o disco frio; agora abre em menos de 1 s.

## Pendências conhecidas

- **Dados da empresa**: campos `null` em `src/lib/legal.ts` até a abertura da empresa.
- **Tabela da OAB**: `db:semear` traz só valores ilustrativos de SP, e a interface avisa disso. Importe as tabelas vigentes de cada seccional em `oab_fee_references`.
- **PDF digitalizado**: um PDF que é só imagem é recusado com orientação ao usuário.
- **Ainda não implementado**: troca de plano sem cancelar e vários usuários por escritório.
- **Faturamento**: o livro de cobranças (`pagamentos`) é preenchido pelo webhook a partir desta versão; cobranças anteriores não aparecem.
