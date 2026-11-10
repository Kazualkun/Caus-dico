# Pentest e correções — 02/11/2026

Teste de invasão automatizado contra o build de produção (`next build && next start`) com o banco local, as contas de teste de cada papel e um atacante sem conta. O roteiro tem 70 verificações. Na primeira rodada, 14 falharam; depois das correções abaixo, as 70 passam. Repetido em 03/11/2026, depois das últimas mudanças na fila de IA (a tarefa para quando o item é apagado): 70 de 70.

## O que foi verificado

| Grupo | Verificações | O que o teste faz |
|---|---|---|
| Cabeçalhos | 5 | Proteção contra enquadramento (CSP `frame-ancestors` e `X-Frame-Options`), `nosniff`, política de referência, HSTS, ausência de `X-Powered-By` |
| Sem login | 11 | Painel, administração e checkout redirecionam ao login; exportação LGPD e PDF exigem sessão; rotina diária e webhook do Asaas recusam segredo ausente ou errado |
| Papéis | 10 | Assinante e conta sem assinatura não veem a administração; suporte não vê faturamento, LGPD nem sistema; administrador não vê sistema; conta sem assinatura não abre módulo pago |
| Dados de outra conta (IDOR) | 8 | Contrato, pesquisa, peça, proposta, cliente, processo e PDF de outro usuário pelo id; exportação LGPD só da própria conta |
| Rotas do Better Auth | 18 | Rotas de login, cadastro, senha, perfil, sessões e conta fechadas, inclusive com barra no fim, maiúsculas, caractere codificado e parâmetros; link de confirmação de e-mail aberto |
| Login | 7 | Server Action com `Origin` de outro site (CSRF), força bruta num e-mail trocando o IP a cada tentativa, redirecionamento para fora do site pelo `next=`, flags do cookie de sessão |
| Triagem pública | 1 | Limite de 5 envios por hora por IP |
| XSS armazenado | 1 | Nome e relato com `<img onerror>`, `<script>` e link `javascript:` enviados pela triagem e abertos pelo advogado |
| Injeção na busca | 5 | `' OR 1=1--`, `pg_sleep`, barra invertida, 5 mil caracteres e `drop table` na busca do acervo e nos filtros |
| Arquivos | 2 | DOCX "bomba" (300 MB descompactados em 300 KB) e arquivo .pdf que não é PDF |
| Cota e fila | 2 | 10 pedidos simultâneos da mesma conta; excluir um resultado concluído |

## Achados e correções

| # | Achado | Gravidade | Correção |
|---|---|---|---|
| 1 | **Excluir um item devolvia a cota do plano.** O uso era contado pelas linhas que ainda existiam; quem apagasse cada auditoria podia fazer auditorias sem limite. | Alta (perda de receita) | O consumo passou a ser contado no registro da fila (`tarefas_ia`), que não guarda conteúdo e fica depois da exclusão. Erro e cancelamento antes de começar não contam. |
| 2 | **Pedidos simultâneos passavam do limite do plano.** A conferência da cota e a criação do item não eram atômicas. | Média | Cota e teto conferidos na mesma transação que cria a tarefa, sob uma trava por usuário (`pg_advisory_xact_lock`). No teste, 10 pedidos simultâneos resultaram em 3 aceitos (o teto por pessoa) e 7 recusados com aviso. |
| 3 | **Uma conta podia ocupar a GPU de todos.** Até o limite do mês (60 a 250 auditorias), tudo entrava na fila de uma vez. | Média (negação de serviço) | No máximo 3 tarefas por pessoa na fila ou em andamento; quem tem menos tarefas rodando passa antes; a triagem pública vai depois das demais. |
| 4 | **`/change-password` aberta por HTTP.** Ela confere a senha atual sem limite de tentativas: quem roubasse um cookie de sessão poderia descobrir a senha por força bruta. Também estavam abertas `/change-email`, `/revoke-sessions`, `/list-sessions`, `/get-session` e outras que o site não usa. | Média | Todas fechadas em `disabledPaths`. O site usa o Better Auth só pelo servidor; ficam abertas só as rotas dos links de e-mail. |
| 5 | **Busca "Dentro dos artigos" com palavra comum levava até 2,5 minutos** e segurava uma das 10 conexões do banco. Dez buscas assim travariam o site. | Alta (negação de serviço) | Teto de 20 mil artigos candidatos, trecho recortado só para os 20 da página e `statement_timeout` de 10 s por consulta de busca. "prazo": de 120 s para 1,4 s. |
| 6 | **Busca por nome lia a tabela inteira de normas** (1,6 GB de disco por busca) por causa do `apelido ilike '%…%'`. | Média (desempenho sob carga) | Índice de trigramas parcial nas 131 normas com apelido (migração 0006). "CDC": de 3,5 s para 20 ms. |
| 7 | **Bomba de ZIP no envio de DOCX.** O leitor de Word descompactava tudo na memória. | Média | Descompactação de conferência com teto de 80 MB antes do leitor; PDF limitado a 300 páginas. A bomba é recusada em 0,3 s. |
| 8 | **IP do cliente lido da primeira entrada do `X-Forwarded-For`**, que o próprio cliente escolhe; com proxy, os limites por IP podiam ser contornados. | Baixa (os limites por e-mail e por conta continuam) | Usa `X-Real-IP` ou a última entrada do `X-Forwarded-For`. O DEPLOY.md manda o Nginx sobrescrever os cabeçalhos e o Next.js escutar só em `127.0.0.1`. |
| 9 | **A administração mostrava seu cabeçalho e o título da aba a quem não é da equipe.** Com a pré-renderização parcial, a casca da página saía antes da conferência do papel, e o título e a descrição de cada página iam no payload. Nenhum dado vazava. | Baixa | O layout confere o papel antes de qualquer saída (`instant = false`), cada página também confere o seu na primeira linha, e o título vira "Página não encontrada". O código HTTP continua 200 (a casca do layout raiz já saiu), mas sem nada da área. |
| 10 | **Rótulos de artigo errados em 105.980 dispositivos** ("Art. 11. O", "Art. 11-O" vindo de "Artigo 11 - O Plano…"). Não é falha de segurança, mas fazia o verificador de citações acusar artigos existentes como inexistentes. | Média (qualidade) | Expressão corrigida, 14 casos em `tests/e2e/acervo-parser.spec.ts` e `npm run acervo:rotulos` para refazer os rótulos gravados. |

O teste não acusou injeção de SQL (todas as consultas usam parâmetros), XSS (React escapa o conteúdo e o Markdown não aceita HTML), acesso a dados de outra conta, CSRF (o Next recusa Server Action de outra origem), redirecionamento aberto nem cookie sem `HttpOnly`/`SameSite`.

## Recomendações que ficam

- **Exclusão da conta pede só o e-mail digitado.** Quem estiver com a sessão aberta de outra pessoa (computador compartilhado) apaga a conta e os dados dos clientes dela. Pedir a senha de novo nessa tela.
- **Cadastro revela se o e-mail já tem conta** ("Já existe uma conta com este e-mail"). Prática comum e de baixo risco; a alternativa é responder sempre "enviamos um e-mail" e avisar por e-mail quem já tem conta.
- **Política de segurança de conteúdo** só com `frame-ancestors`, `base-uri` e `object-src`. Uma CSP com `script-src` por nonce bloquearia scripts injetados, mas tornaria todas as páginas dinâmicas.
- **Esfera e vigência nos dispositivos.** A busca de fontes da IA com uma palavra genérica e o filtro federal ainda percorre boa parte da tabela de artigos (hoje cortada em 4 s, e o termo é ignorado). Copiar esfera e vigência para `dispositivos`, com um índice parcial, resolveria de vez.
- **Antes de abrir ao público**: rodar o pentest de novo contra a homologação na VPS (com o Nginx da frente) e um teste externo independente.

## Como repetir

Com o build de produção no ar (`npm run build && npm start`), rode `npm run seguranca:pentest`. O roteiro (`scripts/seguranca/pentest.mjs`) usa as contas de `npm run usuario:teste`, cria e apaga itens de teste e só roda com o banco local.
