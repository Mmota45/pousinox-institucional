# Integração N8N + Supabase + Z-API — Pousinox Leads

Pipeline completo: formulário do site → N8N → Supabase (banco) + Z-API (WhatsApp para o lead + notificação interna).

---

## Arquitetura

```
Site Pousinox (React)
  └── fetch POST JSON
        └── N8N Webhook
              ├── Supabase: INSERT na tabela leads
              ├── Z-API: WhatsApp de confirmação para o lead
              └── Z-API: Notificação interna para a equipe
```

---

## 1. Pré-requisitos

| Serviço | O que precisar |
|---|---|
| N8N | Instância rodando (self-hosted ou cloud) |
| Supabase | Projeto `pousinox-outlet` já existente |
| Z-API | Conta ativa + instância conectada ao WhatsApp |

---

## 2. Supabase — Criar tabela `leads`

No **SQL Editor** do Supabase, execute:

```sql
create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  telefone      text not null,
  email         text,
  empresa       text,
  cidade        text,
  segmento      text,
  tipo_obra     text,
  quantidade    text,
  prazo         text,
  mensagem      text,
  produto       text,
  origem        text,
  timestamp_envio timestamptz,
  criado_em     timestamptz default now()
);

-- RLS: só admins autenticados leem/editam
alter table public.leads enable row level security;

create policy "admin_all" on public.leads
  for all to authenticated using (true) with check (true);

-- Service role pode inserir (usado pelo N8N)
create policy "service_insert" on public.leads
  for insert to service_role with check (true);
```

### Obter a Service Role Key

1. Supabase → Settings → API
2. Copie a **service_role key** (não a anon key)
3. Copie também a **Project URL**

---

## 3. N8N — Importar o workflow

1. Abra seu N8N
2. Menu lateral → **Workflows** → **Import from file**
3. Selecione: `n8n-workflow-pousinox-leads.json`
4. Clique em **Import**

### Configurar credencial Supabase no N8N

1. N8N → **Credentials** → **New** → busque **Supabase**
2. Preencha:
   - **Host**: `https://SEU-PROJETO.supabase.co`
   - **Service Role Secret**: cole a service_role key
3. Salve como **"Supabase Pousinox"**
4. No workflow, clique no nó **"Salvar Lead no Supabase"** e selecione essa credencial

### Configurar variáveis de ambiente N8N

Adicione as variáveis no seu `.env` do N8N (ou nas configurações da instância):

```env
# Z-API
ZAPI_INSTANCE_ID=SUA_INSTANCIA_ID
ZAPI_TOKEN=SEU_TOKEN
ZAPI_CLIENT_TOKEN=SEU_CLIENT_TOKEN

# Número que recebe notificações internas (formato: 5535XXXXXXXXX)
ZAPI_NOTIFICACAO_NUMERO=5535999999999
```

> No N8N self-hosted com Docker, adicione ao `docker-compose.yml` na seção `environment`.

---

## 4. Z-API — Configurar instância

1. Acesse [app.z-api.io](https://app.z-api.io)
2. Crie ou abra uma instância
3. Escaneie o QR Code com o WhatsApp da Pousinox (ou um número dedicado)
4. Copie:
   - **Instance ID** → `ZAPI_INSTANCE_ID`
   - **Token** → `ZAPI_TOKEN`
   - **Client Token** (Security → Client-Token) → `ZAPI_CLIENT_TOKEN`

### Testar Z-API

```bash
curl -X POST \
  "https://api.z-api.io/instances/SEU_INSTANCE_ID/token/SEU_TOKEN/send-text" \
  -H "Client-Token: SEU_CLIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone": "5535999999999", "message": "Teste Pousinox Z-API"}'
```

Deve retornar `{"zaapId":"...","messageId":"..."}`.

---

## 5. Ativar o webhook no N8N

1. No workflow importado, clique em **"Webhook Fixador Orçamento"**
2. Clique em **"Listen for test event"** para pegar a URL de teste
3. A URL de produção será: `https://SEU-N8N.com/webhook/orcamento-fixador`
4. Repita para **"Webhook Contato Geral"**: `https://SEU-N8N.com/webhook/contato-lead`

---

## 6. Atualizar as URLs no site

Edite os dois arquivos abaixo e substitua o placeholder pela URL real:

**`src/pages/FixadorOrcamento.tsx`** — linha 10:
```tsx
const N8N_WEBHOOK_URL = 'https://n8n.pousinox.com.br/webhook/orcamento-fixador'
//                       ^^^^^ substitua pelo seu domínio N8N
```

**`src/pages/Contato.tsx`** — linha 10:
```tsx
const N8N_WEBHOOK_URL = 'https://n8n.pousinox.com.br/webhook/contato-lead'
```

Depois, faça o deploy:
```bash
bash deploy.sh
```

---

## 7. Testar end-to-end

### Teste rápido via curl

```bash
curl -X POST https://SEU-N8N.com/webhook/orcamento-fixador \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Marco Teste",
    "telefone": "35999999999",
    "email": "marco@teste.com",
    "empresa": "Construtora Teste",
    "cidade": "Pouso Alegre / MG",
    "tipo_obra": "Fachada",
    "quantidade": "150 m²",
    "mensagem": "Teste de integração",
    "produto": "Fixador de Porcelanato",
    "origem": "teste-curl",
    "timestamp": "2026-04-07T20:00:00.000Z"
  }'
```

**Resultado esperado:**
- `{"ok": true, "message": "Lead recebido com sucesso"}`
- Lead aparece na tabela `leads` do Supabase
- WhatsApp de confirmação chega para `35999999999`
- Notificação interna chega para o número configurado em `ZAPI_NOTIFICACAO_NUMERO`

### Teste pelo formulário do site

1. Acesse `/fixador-porcelanato/orcamento` em produção
2. Preencha e envie
3. Verifique: tela de sucesso no site, linha no Supabase, WhatsApp no celular

---

## 8. Estrutura dos dados enviados pelo site

```json
{
  "nome": "string (obrigatório)",
  "telefone": "string (obrigatório)",
  "email": "string",
  "empresa": "string",
  "cidade": "string",
  "tipo_obra": "string",
  "quantidade": "string",
  "prazo": "string",
  "segmento": "string",
  "mensagem": "string",
  "produto": "Fixador de Porcelanato | Inox Geral",
  "origem": "site-fixador-orcamento | site-contato",
  "timestamp": "ISO 8601",
  "arquivo_nome": "string (nome do arquivo, se anexado)"
}
```

---

## 9. Troubleshooting

| Problema | Verificação |
|---|---|
| Formulário retorna erro | Verifique se o webhook do N8N está ativo (não em modo teste) |
| Lead não aparece no Supabase | Confirme que a service_role key está correta na credencial N8N |
| WhatsApp não chega | Verifique se a instância Z-API está conectada (ícone verde no painel) |
| CORS error no console | Adicione `https://pousinox.com.br` em allowedOrigins no webhook N8N |
| Número inválido Z-API | O telefone deve ter DDI+DDD+número sem espaços: `5535999999999` |

---

## 10. Manutenção

- **Ver todos os leads**: Supabase → Table Editor → `leads`
- **Filtrar por produto**: `select * from leads where produto = 'Fixador de Porcelanato'`
- **Ver execuções N8N**: N8N → Workflow → Executions
- **Reenviar execução falha**: clique na execução → "Retry"
