# Capacidade e escolha do servidor — 02 e 03/11/2026

Pergunta: como o Causídico se sai com **100 advogados usando ao mesmo tempo e pedindo IA**, e qual máquina contratar para isso. O relatório com gráficos está no artefato [Capacidade do Causídico](https://claude.ai/artifact/KVMG8W7sVmW7gKBK3eaA5x).

## Resposta curta

- **Este computador (RTX 2070 Super, 8 GB) não serve para produção.** Ele atende uma tarefa de IA por vez, cerca de 26 por hora. No teste real com 100 advogados, só 24 das 100 tarefas terminaram em 20 minutos e quase metade das análises do caso desistiu na fila; pela simulação, a fila leva ~4 horas para esvaziar.
- **Recomendado: Magalu Cloud, 1× L40S 48 GB, em São Paulo**, com o vLLM. Com 100 pedidos ao mesmo tempo, tudo fica pronto em ~3 minutos; com 500, em ~11. Custa R$ 6.310/mês (8 vCPU, 64 GB) ou R$ 8.182/mês (16 vCPU, 128 GB). A segunda opção acomoda também o site e o banco na mesma máquina.
- **Alternativa barata:** Hetzner GEX44 (RTX 4000 SFF Ada 20 GB, ~€ 184/mês, na Alemanha). Com 100 pedidos ao mesmo tempo, as auditorias levam até ~15 minutos. Fica fora do Brasil (exige cláusula de transferência internacional na Política de Privacidade) e pode ter saído de linha.
- **Evitar:** AWS g6.xlarge (L4 24 GB) em São Paulo. Custa perto da L40S (~US$ 999/mês sob demanda) e entrega cerca de um quarto da capacidade.

## Como foi medido

1. **Teste real neste computador.** 100 advogados virtuais entram em 60 segundos no build de produção, com o banco local e a GPU de verdade. Cada um navega (painel, busca no acervo, uma norma, prazos) e faz um pedido de IA: 35% análise do caso, 25% pesquisa, 20% recomendação de peça, 20% auditoria. Quem espera um resultado atualiza a página a cada 4 s, como o navegador faz. O teste dura até 20 minutos.
2. **Sistema inteiro com GPU emulada.** O mesmo teste, com o site, o banco e a fila de verdade, mas a IA respondida por um emulador (`scripts/carga/emulador-gpu.mts`). Ele fala o protocolo do Ollama, devolve JSON válido para o formato pedido e demora o que a GPU do perfil levaria, considerando quantas tarefas ela gera ao mesmo tempo. Serve para ver se site, banco e fila aguentam 100 pessoas com todas as tarefas terminando.
3. **Simulação da fila por servidor** (`scripts/carga/simular-fila.mts`). Usa as mesmas regras do sistema (vagas, reserva para a análise do caso, uma chamada por vez em cada tarefa, desistência em 180 s) e o tamanho de cada chamada medido nas tarefas reais.

O tamanho das chamadas veio da tabela `ai_usage`, com 9 auditorias, 6 pesquisas, 4 análises do caso e 4 triagens reais. Uma auditoria faz 4 chamadas e gera ~6 mil tokens; a pesquisa e a peça fazem 2 (~1.300 tokens); a análise do caso faz 1 (~340 tokens). O modelo usa só 544 MB de memória de contexto para 32 mil tokens (arquitetura híbrida), então uma placa de 24 GB ou mais comporta dezenas de tarefas simultâneas. O limite passa a ser o cálculo, não a memória.

## Simulação por servidor

Mesma mistura de pedidos; os advogados entram ao longo de 1 minuto (100) ou 2 minutos (300 e 500). "Tudo pronto" é quando a última tarefa termina. "Advogados no dia a dia" supõe 7 tarefas por advogado por dia útil (3 análises do caso, 2 pesquisas, 1 peça, 1 auditoria), concentradas em 8 horas, com pico de 2× a média e a placa a no máximo 70%.

| Servidor | Placa | 100: tudo pronto | 100: análise do caso (mediana) | 100: auditoria (95%) | 300: tudo pronto | 500: tudo pronto | Tarefas por hora | Advogados no dia a dia |
|---|---|---|---|---|---|---|---|---|
| Este computador | RTX 2070 Super 8 GB (Ollama, medido) | 4,2 h | 2,5 min; 21 de 31 desistem | 3,9 h | mais de 6 h (107 sem terminar) | mais de 6 h (229 sem terminar) | 26 | 10 |
| Hetzner GEX44 | RTX 4000 SFF Ada 20 GB (vLLM) | 17 min | 41 s | 15 min | 44 min | 1,2 h | 429 | 171 |
| AWS g6.xlarge (São Paulo) | L4 24 GB (vLLM) | 11 min | 17 s | 9 min | 29 min | 46 min | 609 | 243 |
| **Magalu Cloud (São Paulo)** | **L40S 48 GB (vLLM)** | **3 min** | **7 s** | **2 min** | **7 min** | **11 min** | **2.831** | **1.132** |
| Hetzner GEX131 | RTX PRO 6000 Blackwell 96 GB (vLLM) | 2 min | 4 s | 1 min | 4 min | 7 min | 4.908 | 1.963 |

Os perfis da nuvem são estimativas para o vLLM a partir da banda de memória de cada placa e de testes publicados com modelos de 8B (`scripts/carga/perfis.mts`). Os testes com GPU emulada confirmam que o sistema se comporta como a simulação prevê para esses perfis (tabela abaixo); o que falta confirmar é a velocidade real de cada placa, com `vllm bench serve` na máquina contratada.

## Sistema inteiro com GPU emulada (100 advogados)

Site, banco e fila de verdade, no build de produção deste computador (i7-9700K, 8 núcleos, 16 GB), com `DATABASE_POOL_MAX=20`. O gerador de carga e o emulador rodaram na mesma máquina.

| | L40S emulada (48 vagas) | L4 emulada (16 vagas) |
|---|---|---|
| Tarefas de IA concluídas | 100 de 100 | 100 de 100 |
| Análise do caso (mediana / 95%) | 8 s / 12 s | 17 s / 24 s |
| Pesquisa (95%) | 46 s | 6,3 min |
| Peça (95%) | 49 s | 6,8 min |
| Auditoria (mediana / 95%) | 2,1 min / 2,3 min | 5,6 min / 8,7 min |
| Tudo pronto | 3,3 min | 9,9 min |
| Páginas servidas / com erro | 1.786 / 0 | 4.981 / 0 |
| Páginas, 95% no pico da entrada | 1,7 s | 0,9 s |
| Páginas, 95% depois do pico | 155 ms | 327 ms |
| CPU da máquina (média / máxima) | 52% / 77% | 46% / 77% |
| Conexões abertas no banco (máximo) | 25 | 25 |

Os tempos de IA batem com a simulação: auditoria a 95% em 2,3 min (simulação: 2,2) e 8,7 min (simulação: 9,4). O site e o banco atenderam 100 pessoas usando metade de uma máquina de 8 núcleos, já contando o gerador de carga; na VPS, 8 vCPU e 32 GB ou mais bastam para essa parte.

## Teste real neste computador (100 advogados)

Build de produção, banco local e a GPU de verdade (RTX 2070 Super 8 GB, Ollama, `IA_PARALELO=1`), em 03/11/2026. Os 100 advogados entraram em 60 segundos e o teste durou 20 minutos.

| | Resultado |
|---|---|
| Tarefas de IA concluídas em 20 min | 24 de 100 (14 análises do caso, 6 pesquisas, 4 peças, nenhuma auditoria) |
| Análises do caso recusadas por fila cheia | 12 de 26 (esperaram 3 min por uma vaga e desistiram, com aviso na tela) |
| Ainda na fila no fim | 64 (23 pesquisas, 17 peças, 24 auditorias) |
| Análise do caso (mediana / 95%) | 2,2 min / 3,3 min |
| Pesquisa / peça (mediana) | 13 min / 15 min |
| Páginas servidas / com erro | 19.250 / 0 |
| Páginas, 95% no pico da entrada / depois | 0,9 s / 633 ms |
| CPU da máquina (média / máxima) | 59% / 96% |
| Conexões abertas no banco (máximo) | 26 |

O teste confirma a simulação para este computador: a análise do caso esperou 2,2 min na mediana (simulação: 2,5 min), e quase nenhuma tarefa longa terminou em 20 minutos. Desistiram 12 de 26 análises do caso, menos que os dois terços da simulação, porque a análise tem vaga reservada e passa à frente na fila. As 24 tarefas que terminaram são quase todas curtas.

O site e o banco não falharam: 19.250 páginas sem nenhum erro, com o processador dividido entre o site, o Ollama e o gerador de carga. Ao apagar as 100 contas no fim, as 64 tarefas na fila e a que estava em andamento pararam em segundos, sem erro no log (a tarefa confere a cada etapa se o item ainda existe).

No primeiro teste real, em 02/11, as auditorias não entraram na fila por um erro do roteiro de carga, que enviava o formulário de um jeito que o site recusa. O roteiro foi corrigido e este segundo teste inclui as auditorias.
