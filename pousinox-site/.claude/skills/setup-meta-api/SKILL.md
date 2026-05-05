---
description: Guia passo a passo para configurar app Meta (Facebook) — API de Ads, aprovação e integração com Claude Code
---

# Setup Meta API

Guia completo para criar, configurar e aprovar um app no Meta for Developers, permitindo que o Claude Code leia dados e execute ações na conta de anúncios.

## Visão geral do processo

```
Etapa 1: Criar app (10 min)
Etapa 2: Configurar permissões (15 min)
Etapa 3: Gerar token de longa duração (10 min)
Etapa 4: Testar leitura (5 min)
Etapa 5: Ativar app + verificação (30 min + espera 1-5 dias)
Etapa 6: Integrar com Pousinox (15 min)

Total hands-on: ~1h30
Tempo de espera (aprovação Meta): 1-5 dias úteis
```

## Etapa 1 — Criar o app

### 1.1 Acessar Meta for Developers
```
URL: https://developers.facebook.com/
Login: usar conta pessoal vinculada ao Business Manager da Pousinox
```

### 1.2 Criar novo app
```
1. Clique em "Meus Apps" → "Criar App"
2. Tipo de app: "Negócios" (Business)
3. Nome do app: "Pousinox Ads Manager"
4. E-mail de contato: adm@pousinox.com.br
5. Business Manager: selecionar "Pousinox" (se disponível)
6. Clique "Criar app"
```

### 1.3 Configurar informações básicas
```
Menu: Configurações → Básico

- Nome de exibição: Pousinox Ads Manager
- Domínio do app: pousinox.com.br
- URL da Política de Privacidade: https://www.pousinox.com.br/privacidade
- URL dos Termos de Serviço: https://www.pousinox.com.br/privacidade
- Ícone do app: logo Pousinox (1024×1024, PNG)
- Categoria: Utilitários de Produtividade para Negócios
- Subcategoria: Marketing e Publicidade
```

## Etapa 2 — Configurar permissões (Marketing API)

### 2.1 Adicionar produto "Marketing API"
```
1. Menu lateral → "Adicionar produto"
2. Buscar "Marketing API" → Configurar
3. Aceitar termos
```

### 2.2 Permissões necessárias

| Permissão | Uso | Tipo |
|---|---|---|
| `ads_read` | Ler campanhas, métricas, insights | Padrão |
| `ads_management` | Criar/editar/pausar anúncios | Avançada |
| `pages_read_engagement` | Ler dados de páginas vinculadas | Padrão |
| `business_management` | Gerenciar contas do Business Manager | Avançada |
| `read_insights` | Ler métricas de performance | Padrão |

### 2.3 Solicitar permissões avançadas
```
Menu: Revisão do App → Permissões e Recursos

Para cada permissão avançada:
1. Clique "Solicitar permissões avançadas"
2. Descreva o caso de uso:
   
   ads_management:
   "Gerenciamos campanhas de anúncios da nossa própria empresa (Pousinox).
   Precisamos criar, editar e pausar anúncios programaticamente para otimizar
   performance com base em dados de conversão do nosso CRM interno."

   business_management:
   "Precisamos acessar dados da nossa conta Business Manager para consolidar
   métricas de marketing em nosso dashboard interno."
```

### 2.4 Vincular conta de anúncios
```
1. Menu: Configurações → Avançado
2. "Contas de anúncios autorizadas": adicionar Ad Account ID
3. Para encontrar seu Ad Account ID:
   - Gerenciador de Anúncios → URL contém "act_XXXXXXXXX"
   - Ou: Business Manager → Contas de anúncios → copiar ID
```

## Etapa 3 — Gerar token de acesso

### 3.1 Token de curta duração (teste)
```
1. Menu: Ferramentas → Explorador da API Graph
2. Selecione seu app "Pousinox Ads Manager"
3. Clique "Gerar token de acesso"
4. Marque as permissões: ads_read, ads_management, read_insights
5. Clique "Gerar"
6. Copie o token (válido ~1-2 horas)
```

### 3.2 Token de longa duração (produção)
```
# Trocar token curto por token longo (60 dias)
# Executar no terminal:

curl -X GET "https://graph.facebook.com/v19.0/oauth/access_token?\
grant_type=fb_exchange_token&\
client_id={APP_ID}&\
client_secret={APP_SECRET}&\
fb_exchange_token={TOKEN_CURTO}"

# Resposta:
# { "access_token": "TOKEN_LONGO_60_DIAS", "token_type": "bearer", "expires_in": 5184000 }
```

### 3.3 Token permanente (System User — recomendado)
```
1. Business Manager → Configurações → Usuários do sistema
2. Criar novo usuário do sistema:
   - Nome: "Pousinox API Bot"
   - Função: Admin
3. Atribuir ativos:
   - Conta de anúncios: acesso total
   - Página: acesso total
4. Gerar token:
   - App: "Pousinox Ads Manager"
   - Permissões: ads_management, pages_read_engagement, read_insights
   - Escopo: ads_read, ads_management
5. Copiar token (NÃO expira)
```

**IMPORTANTE:** O token de System User é o recomendado para produção — não expira e não depende de conta pessoal.

## Etapa 4 — Testar leitura

### 4.1 Verificar acesso à conta
```bash
# Listar campanhas
curl -X GET "https://graph.facebook.com/v19.0/act_{AD_ACCOUNT_ID}/campaigns?\
fields=name,status,objective,daily_budget&\
access_token={TOKEN}"

# Resposta esperada:
# { "data": [{ "id": "123", "name": "Campanha X", "status": "ACTIVE" }] }
```

### 4.2 Ler métricas (insights)
```bash
# Performance últimos 7 dias
curl -X GET "https://graph.facebook.com/v19.0/act_{AD_ACCOUNT_ID}/insights?\
fields=spend,impressions,clicks,ctr,cpc,actions&\
date_preset=last_7d&\
level=campaign&\
access_token={TOKEN}"
```

### 4.3 Testar escrita (pausar anúncio)
```bash
# Pausar um adset específico (CUIDADO: ação real!)
curl -X POST "https://graph.facebook.com/v19.0/{ADSET_ID}?\
status=PAUSED&\
access_token={TOKEN}"

# Resposta: { "success": true }
```

### 4.4 Checklist de validação
- [ ] Listou campanhas com sucesso
- [ ] Leu insights com métricas
- [ ] Conseguiu pausar/ativar (se ads_management aprovado)
- [ ] Token armazenado com segurança

## Etapa 5 — Ativar app e aprovação

### 5.1 Mudar para modo "Ativo"
```
1. Configurações → Básico
2. Alternar "Modo do app" de "Desenvolvimento" para "Ativo"
3. Confirmar (pode pedir verificação 2FA)
```

### 5.2 Verificação de empresa (se necessário)
```
Business Manager → Configurações → Central de Segurança → Verificação

Documentos aceitos:
- CNPJ (cartão ou comprovante)
- Conta de luz/telefone no nome da empresa
- Extrato bancário da conta PJ

Upload e aguardar 1-3 dias úteis
```

### 5.3 Revisão do app (para permissões avançadas)

#### Preparar demonstração em vídeo
```
Gravar screencast mostrando:
1. O dashboard Pousinox consumindo dados via API
2. A funcionalidade de pausar/ativar anúncios
3. A geração de relatórios com dados reais
4. Que os dados são usados apenas para gestão interna

Ferramentas para gravar: OBS Studio, Loom, ou ShareX
Duração: 2-5 minutos por vídeo
Formato: MP4, max 100MB
```

#### Submeter para revisão
```
Menu: Revisão do App → Enviar para revisão

Para cada permissão avançada, preencher:
1. Descrição detalhada do uso (em português ou inglês)
2. Passos para testar (como a Meta pode verificar)
3. Vídeo de demonstração (upload)
4. Capturas de tela do dashboard

Exemplo de descrição para ads_management:
"We use this permission to programmatically manage our own advertising
campaigns. Our internal dashboard (built for Pousinox, a stainless steel
manufacturer) reads campaign performance data and allows our team to pause
underperforming ads or scale successful ones based on CPA thresholds.
No third-party data is accessed — only our own ad account."
```

#### Tempo de aprovação
- Permissões padrão: imediato (após ativar app)
- Permissões avançadas: 1-5 dias úteis
- Verificação de empresa: 1-3 dias úteis
- Se rejeitado: corrigir e resubmeter (sem limite de tentativas)

### 5.4 Motivos comuns de rejeição e como resolver

| Motivo | Solução |
|---|---|
| "Vídeo não demonstra uso real" | Gravar com dados reais da conta, não mockups |
| "Descrição insuficiente" | Detalhar caso de uso específico (não genérico) |
| "Política de privacidade inadequada" | Garantir que menciona uso de dados de ads |
| "App sem finalidade clara" | Renomear e descrever como "gestão interna" |
| "Conta não verificada" | Completar verificação de empresa primeiro |

## Etapa 6 — Integrar com Pousinox

### 6.1 Salvar credenciais
```bash
# Adicionar ao .env (NÃO commitar!)
META_APP_ID=123456789
META_APP_SECRET=abc123def456
META_ADS_TOKEN=EAAxxxxx...token_longo
META_AD_ACCOUNT_ID=act_123456789
META_PAGE_ID=123456789
```

### 6.2 Secrets no Supabase (para edge functions)
```sql
-- Via CLI
npx supabase secrets set META_ADS_TOKEN="EAAxxxxx..."
npx supabase secrets set META_AD_ACCOUNT_ID="act_123456789"
npx supabase secrets set META_APP_SECRET="abc123def456"
```

### 6.3 Edge function: meta-ads-insights
```typescript
// supabase/functions/meta-ads-insights/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const META_TOKEN = Deno.env.get('META_ADS_TOKEN')
const AD_ACCOUNT = Deno.env.get('META_AD_ACCOUNT_ID')
const BASE_URL = 'https://graph.facebook.com/v19.0'

serve(async (req) => {
  const { action, params } = await req.json()

  switch (action) {
    case 'insights': {
      const { date_preset = 'last_7d', level = 'campaign' } = params
      const url = `${BASE_URL}/${AD_ACCOUNT}/insights?` +
        `fields=campaign_name,spend,impressions,clicks,ctr,cpc,actions,cost_per_action_type&` +
        `date_preset=${date_preset}&level=${level}&access_token=${META_TOKEN}`
      const res = await fetch(url)
      return new Response(JSON.stringify(await res.json()))
    }

    case 'campaigns': {
      const url = `${BASE_URL}/${AD_ACCOUNT}/campaigns?` +
        `fields=name,status,objective,daily_budget,lifetime_budget&` +
        `access_token=${META_TOKEN}`
      const res = await fetch(url)
      return new Response(JSON.stringify(await res.json()))
    }

    case 'pause': {
      const { entity_id } = params
      const url = `${BASE_URL}/${entity_id}?status=PAUSED&access_token=${META_TOKEN}`
      const res = await fetch(url, { method: 'POST' })
      return new Response(JSON.stringify(await res.json()))
    }

    case 'activate': {
      const { entity_id } = params
      const url = `${BASE_URL}/${entity_id}?status=ACTIVE&access_token=${META_TOKEN}`
      const res = await fetch(url, { method: 'POST' })
      return new Response(JSON.stringify(await res.json()))
    }

    case 'create_ad': {
      // Criar anúncio como rascunho (PAUSED)
      const { adset_id, creative, name } = params
      const url = `${BASE_URL}/${AD_ACCOUNT}/ads`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          adset_id,
          creative,
          status: 'PAUSED', // Sempre pausado para revisão
          access_token: META_TOKEN
        })
      })
      return new Response(JSON.stringify(await res.json()))
    }

    default:
      return new Response(JSON.stringify({ error: 'Ação inválida' }), { status: 400 })
  }
})
```

### 6.4 Configurar MCP (alternativa à edge function)
```json
// .claude/settings.json
{
  "mcpServers": {
    "meta-ads": {
      "command": "node",
      "args": ["./mcp-servers/meta-ads/server.js"],
      "env": {
        "META_ADS_TOKEN": "${META_ADS_TOKEN}",
        "META_AD_ACCOUNT_ID": "${META_AD_ACCOUNT_ID}"
      }
    }
  }
}
```

### 6.5 Testar integração completa
```bash
# Via edge function
curl -X POST https://vcektwtpofypsgdgdjlx.supabase.co/functions/v1/meta-ads-insights \
  -H "Authorization: Bearer {ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"action": "insights", "params": {"date_preset": "last_7d"}}'

# Esperado: JSON com dados de campanhas
```

## 7. Renovação de token (se não usar System User)

### Cron de renovação (a cada 50 dias)
```typescript
// Routine ou cron job
async function renovarToken() {
  const tokenAtual = await getSecret('META_ADS_TOKEN')
  
  const res = await fetch(
    `https://graph.facebook.com/v19.0/oauth/access_token?` +
    `grant_type=fb_exchange_token&` +
    `client_id=${APP_ID}&` +
    `client_secret=${APP_SECRET}&` +
    `fb_exchange_token=${tokenAtual}`
  )
  
  const { access_token } = await res.json()
  await updateSecret('META_ADS_TOKEN', access_token)
  
  // Notificar que renovou
  await notificarMarco('🔑 Token Meta Ads renovado com sucesso')
}
```

**Recomendação:** usar System User Token (não expira) para evitar essa complexidade.

## 8. Checklist final

```
═══ SETUP META API — Checklist ═══

□ Etapa 1 — App criado
  □ App criado no developers.facebook.com
  □ Informações básicas preenchidas
  □ Ícone e política de privacidade configurados

□ Etapa 2 — Permissões
  □ Marketing API adicionada
  □ ads_read solicitado
  □ ads_management solicitado
  □ Conta de anúncios vinculada

□ Etapa 3 — Token
  □ System User criado no Business Manager
  □ Token permanente gerado
  □ Token testado com sucesso

□ Etapa 4 — Teste
  □ Listou campanhas ✅
  □ Leu insights ✅
  □ Pausou/ativou anúncio ✅

□ Etapa 5 — Aprovação
  □ App mudado para "Ativo"
  □ Empresa verificada
  □ Vídeos de demonstração gravados
  □ Permissões avançadas aprovadas

□ Etapa 6 — Integração
  □ Secrets configurados no Supabase
  □ Edge function deployada
  □ Skills /ads-dashboard e /ads-otimizar funcionando
  □ Routine diária configurada
```

## 9. Quando usar
- Ao configurar integração Meta Ads pela primeira vez
- Quando token expirar e precisar renovar
- Ao adicionar nova conta de anúncios
- Ao solicitar novas permissões
- Referência para troubleshooting de API
