# Implantação em servidor próprio (VPS)

Guia para colocar o Causídico no ar fora da Vercel, numa VPS com GPU ou numa VPS comum ligada a um servidor de GPU. O dimensionamento (qual máquina comprar e quantos advogados ela atende) está em [CAPACIDADE.md](CAPACIDADE.md).

## Arquitetura

```
Internet ──443──▶ Nginx ──▶ Next.js (127.0.0.1:3000) ──▶ PostgreSQL (127.0.0.1:5432)
                                  │
                                  └── rede privada ──▶ servidor de IA (vLLM :8000 ou Ollama :11434)
```

- **Uma máquina só** (mais simples): uma VPS com GPU roda tudo. Na Magalu Cloud, a L40S com 16 vCPU e 128 GB dá folga para o banco do acervo (~10 GB) ficar na memória.
- **Duas máquinas** (mais barato de crescer): uma VPS comum em São Paulo para o site e o banco (8 vCPU, 32 GB, NVMe de 150 GB) e o servidor de GPU separado, acessível só pelo IP da VPS. Trocar a GPU não mexe no site.

O conteúdo das tarefas vai do site ao servidor de IA. Se a GPU ficar em outro provedor ou país, inclua o provedor na Política de Privacidade (LGPD, arts. 33 a 36, transferência internacional) antes de usar com clientes reais.

## 1. Servidor de IA

### vLLM (recomendado para 100 pessoas ou mais)

O vLLM agrupa as gerações de dezenas de tarefas na mesma placa. Com o Ollama, a mesma placa atende uma ou poucas por vez.

```bash
vllm serve <modelo Qwen3.5-9B em AWQ ou FP8 no Hugging Face> \
  --max-model-len 32768 --max-num-seqs 48 --gpu-memory-utilization 0.90 \
  --api-key <segredo> --host 0.0.0.0 --port 8000
```

No `.env` do site:

```
IA_API=openai
OLLAMA_URL=http://<ip-privado-da-gpu>:8000
OLLAMA_MODEL=<o mesmo nome passado ao vllm serve>
IA_API_KEY=<segredo>
IA_PARALELO=48          # igual ao --max-num-seqs; veja a tabela em CAPACIDADE.md
```

Antes de fechar contrato longo, meça a placa contratada com `vllm bench serve` e ajuste os números do perfil em `scripts/carga/perfis.mts`.

### Ollama (uma placa pequena, poucos usuários)

```
OLLAMA_URL=http://<ip-privado-da-gpu>:11434
IA_PARALELO=2           # e OLLAMA_NUM_PARALLEL=2 no serviço do Ollama
```

### Firewall

A porta do servidor de IA só aceita conexões do IP da VPS do site (`ufw allow from <ip-da-vps> to any port 8000`). Ela nunca fica aberta para a internet.

## 2. Banco de dados

PostgreSQL 17 com as extensões `unaccent` e `pg_trgm` (as migrações criam). Para o acervo completo numa máquina de 32 GB:

```
shared_buffers = 8GB
effective_cache_size = 24GB
work_mem = 32MB
random_page_cost = 1.1      # disco NVMe
max_connections = 100
```

```bash
npm run db:migrar && npm run db:semear
pg_restore -d causidico acervo.dump     # ou npm run acervo:sincronizar (horas)
npm run acervo:rotulos                   # só se o acervo veio de antes de 02/11/2026
```

Faça backup diário com `pg_dump` (dados de clientes, propostas e auditorias); o acervo pode ser sincronizado de novo.

## 3. Site (Next.js)

```bash
npm ci && npm run build
NODE_ENV=production npm start            # escuta em 127.0.0.1:3000 atrás do Nginx
```

Variáveis além das do `.env.example`: `DATABASE_POOL_MAX=20` para 100 pessoas simultâneas, `BETTER_AUTH_URL` e `NEXT_PUBLIC_SITE_URL` com o domínio em `https://`, `AUTH_EXIGIR_VERIFICACAO_EMAIL` vazio (exigida), `RESEND_API_KEY`, chaves do Asaas de produção e `CRON_SECRET`.

Rode um processo só do site, como serviço do systemd com `Restart=always`. A fila de IA roda dentro dele e retoma sozinha as tarefas interrompidas por um reinício. Para mais de um processo, deixe `IA_FILA=false` em todos menos um.

Rotina diária (crontab do servidor, 6h de Brasília):

```
0 9 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<dominio>/api/cron/diario > /dev/null
```

## 4. Nginx

```nginx
server {
  listen 443 ssl http2;
  server_name <dominio>;
  # certificados do Let's Encrypt (certbot --nginx)

  client_max_body_size 25m;             # contratos em PDF/DOCX de até 20 MB

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    # O site usa estes cabeçalhos nos limites de tentativas: o Nginx sobrescreve o que o cliente mandar.
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto https;
    proxy_read_timeout 300s;            # a análise do caso espera até 180 s por uma vaga na IA
    proxy_buffering off;                # streaming das páginas
  }
}
server { listen 80; server_name <dominio>; return 301 https://$host$request_uri; }
```

O Next.js escuta só em `127.0.0.1`. Exposto direto na internet, o cliente poderia forjar o `X-Real-IP` e escapar dos limites por IP (os limites por conta e por e-mail continuam valendo).

## 5. Conferência depois de subir

1. `npm run typecheck && npm run lint` e `npm run test:e2e` contra a URL nova (`E2E_URL=https://<dominio>`), com contas de teste num banco de homologação.
2. Teste de carga contra a homologação, nunca contra a produção com clientes. Em outra máquina com acesso ao banco de homologação, rode `npm run carga:teste -- --url https://<dominio> --usuarios 100`; o script recusa banco que não seja local, então rode-o no próprio servidor de homologação.
3. Em Administração → Tarefas e uso de IA, acompanhe a fila: espera média alta com a placa cheia é sinal de que falta GPU.
