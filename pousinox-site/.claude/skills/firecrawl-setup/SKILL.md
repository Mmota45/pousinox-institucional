---
description: Configurar Firecrawl como navegador web seguro para Claude — scraping, sessões persistentes e automação web
---

# Firecrawl Setup

Guia para configurar o Firecrawl como MCP no Claude Code, dando ao agente capacidade de navegar a web de forma segura, persistente e econômica.

## Por que Firecrawl

| Problema | Solução Firecrawl |
|---|---|
| Claude não acessa web nativamente | Navegador controlado via API |
| Dar acesso ao browser local é inseguro | Ambiente isolado (sandbox) |
| Sessions esquecem login entre conversas | Credenciais persistentes |
| Screenshots consomem muitos tokens | Extrai texto/dados direto (barato) |
| Captchas e JS bloqueiam crawlers simples | Renderiza JS completo como browser real |

## 1. Criar conta Firecrawl

```
1. Acesse: https://firecrawl.dev
2. Criar conta (Google ou email)
3. Plano Free: 500 créditos/mês (suficiente para testes)
4. Plano Growth: $50/mês — 50.000 créditos (produção)
5. Copiar API Key: Dashboard → API Keys → Copiar
```

### Consumo estimado por skill
| Skill | Uso | Créditos/execução |
|---|---|---|
| `/pesquisar` | 5-10 páginas por pesquisa | 5-10 |
| `/audit-instagram` | 1 perfil público | 3-5 |
| `/routines` (concorrência) | Meta Ads Library + 3 LPs | 10-15 |
| `/radar-seo` | 5 SERPs | 5-10 |
| Postagem em comunidade | 1 sessão com login | 5-8 |

Free (500/mês) cobre ~50 execuções. Growth cobre uso diário.

## 2. Instalar MCP Firecrawl

### Opção A: Via npm (Claude Code CLI)
```bash
npm install -g firecrawl-mcp
```

Adicionar em `.claude/settings.json`:
```json
{
  "mcpServers": {
    "firecrawl": {
      "command": "npx",
      "args": ["-y", "firecrawl-mcp"],
      "env": {
        "FIRECRAWL_API_KEY": "fc-xxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

### Opção B: Via conector (Claude Desktop/Co-work)
```
1. Claude Desktop → Configurações → Gerenciar Conectores
2. Adicionar conector personalizado
3. URL: https://api.firecrawl.dev/v1
4. Cabeçalho de autenticação: Bearer fc-xxxxxxxxxxxxxxxx
5. Permissões: "Sempre permitir" (para automação sem interrupção)
```

### Opção C: Docker (self-hosted — sem limites)
```bash
# Para uso ilimitado sem pagar por créditos
git clone https://github.com/mendableai/firecrawl
cd firecrawl
docker compose up -d

# Configurar em settings.json com URL local
# "FIRECRAWL_API_URL": "http://localhost:3002"
```

## 3. Tools disponíveis

Após conectar, o Claude ganha estas ferramentas:

| Tool | O que faz | Quando usar |
|---|---|---|
| `firecrawl_scrape` | Extrai conteúdo de 1 URL | Ler página específica |
| `firecrawl_crawl` | Navega site inteiro (múltiplas páginas) | Mapear site concorrente |
| `firecrawl_map` | Lista todas URLs de um domínio | Descobrir estrutura |
| `firecrawl_search` | Busca web e retorna conteúdo | Pesquisar tema |
| `firecrawl_extract` | Extrai dados estruturados (JSON) | Pegar preços, contatos |
| `firecrawl_batch_scrape` | Múltiplas URLs em paralelo | Análise em massa |

### Exemplos de uso

#### Scrape simples (ler uma página)
```
firecrawl_scrape({
  url: "https://concorrente.com.br/produtos",
  formats: ["markdown"],  // ou "html", "links", "screenshot"
  onlyMainContent: true   // ignora nav, footer, ads
})
```

#### Crawl (navegar site completo)
```
firecrawl_crawl({
  url: "https://concorrente.com.br",
  limit: 20,              // max 20 páginas
  includePaths: ["/produtos/*", "/servicos/*"],
  excludePaths: ["/blog/*", "/admin/*"]
})
```

#### Extract (dados estruturados)
```
firecrawl_extract({
  urls: ["https://concorrente.com.br/produtos"],
  schema: {
    type: "object",
    properties: {
      produtos: {
        type: "array",
        items: {
          type: "object",
          properties: {
            nome: { type: "string" },
            preco: { type: "string" },
            material: { type: "string" }
          }
        }
      }
    }
  }
})
```

#### Search (busca web)
```
firecrawl_search({
  query: "fixador porcelanato fachada preço",
  limit: 5,
  lang: "pt-br",
  country: "br"
})
```

## 4. Sessões persistentes (navegação com login)

### Criar sessão
```
firecrawl_scrape({
  url: "https://comunidade.exemplo.com/login",
  formats: ["markdown"],
  actions: [
    { type: "fill", selector: "input[name=email]", value: "user@email.com" },
    { type: "fill", selector: "input[name=password]", value: "senha123" },
    { type: "click", selector: "button[type=submit]" },
    { type: "wait", milliseconds: 3000 }
  ],
  sessionId: "sessao-comunidade"  // Reutilizável
})
```

### Reutilizar sessão (próxima execução)
```
firecrawl_scrape({
  url: "https://comunidade.exemplo.com/feed",
  formats: ["markdown"],
  sessionId: "sessao-comunidade"  // Usa cookies salvos
})
```

### Postar em comunidade (automação)
```
firecrawl_scrape({
  url: "https://comunidade.exemplo.com/novo-post",
  actions: [
    { type: "fill", selector: "textarea[name=content]", value: "Texto do post..." },
    { type: "click", selector: "button.publicar" },
    { type: "wait", milliseconds: 2000 }
  ],
  sessionId: "sessao-comunidade"
})
```

## 5. Casos de uso Pousinox

### Pesquisa de concorrentes (semanal)
```
Rotina:
1. firecrawl_search("fixador porcelanato inox fabricante") → top 10 resultados
2. firecrawl_scrape(cada URL) → extrair produtos, preços, diferenciais
3. firecrawl_extract(Meta Ads Library) → anúncios ativos concorrentes
4. Skill /pesquisar → sintetizar findings
5. Salvar em knowledge_guias
```

### Audit Instagram (sem prints)
```
Rotina:
1. firecrawl_scrape("https://instagram.com/concorrente") → bio, grid, métricas públicas
2. firecrawl_extract → estruturar dados (seguidores, posts, engajamento)
3. Skill /audit-instagram → analisar e gerar relatório
```

### Monitor de preços
```
Rotina diária:
1. firecrawl_batch_scrape([urls de concorrentes/marketplaces])
2. firecrawl_extract → preços por produto
3. Comparar com nossos preços (Supabase)
4. Alertar se concorrente baixou preço
```

### SERP tracking (radar SEO)
```
Rotina semanal:
1. firecrawl_search("fixador porcelanato") → posição Pousinox
2. firecrawl_search("fixador fachada ventilada") → posição
3. Comparar com semana anterior
4. Skill /radar-seo → relatório
```

### Scraping de leads (complementar Apify)
```
Sob demanda:
1. firecrawl_search("[segmento] [cidade] telefone email")
2. firecrawl_extract → nome, tel, email, endereço
3. Inserir em prospeccao (Supabase)
4. Validar WhatsApp via Z-API
```

## 6. Segurança

### Boas práticas
- ❌ NUNCA salvar credenciais bancárias no Firecrawl
- ❌ NUNCA dar acesso a email pessoal (usar email comercial)
- ❌ NUNCA scraping de sites que proíbem explicitamente (robots.txt)
- ✅ Usar sessionId separado por serviço
- ✅ Rotacionar sessions periodicamente
- ✅ Monitorar créditos consumidos
- ✅ Respeitar rate limits dos sites alvo

### Limites éticos e legais
| Permitido | Proibido |
|---|---|
| Scraping de dados públicos | Acessar áreas restritas sem permissão |
| Monitorar preços de concorrentes | Scraping em massa que derrube o site |
| Extrair dados de perfis públicos | Coletar dados pessoais (LGPD) |
| Ler Meta Ads Library (público) | Bypass de paywall/login de terceiros |

## 7. Firecrawl vs alternativas

| Critério | Firecrawl | Puppeteer/Playwright | Apify | Brave Search API |
|---|---|---|---|---|
| Setup | 5 min (MCP) | 30 min (código) | 10 min (conta) | 5 min (key) |
| JS rendering | ✅ | ✅ | ✅ | ❌ |
| Login/sessões | ✅ | ✅ (manual) | ✅ | ❌ |
| Ações (click, fill) | ✅ | ✅ | ✅ | ❌ |
| Integração Claude | MCP nativo | Via Bash | Via API | MCP |
| Custo | $0-50/mês | Grátis (VPS) | $49+/mês | $0-5/mês |
| Melhor para | Tudo-em-um | Controle total | Scraping em massa | Busca rápida |

**Recomendação:** Firecrawl como principal + Brave Search para buscas simples (mais barato).

## 8. Troubleshooting

| Problema | Causa | Solução |
|---|---|---|
| "Unauthorized" | API key inválida | Verificar key no dashboard |
| Timeout na página | Site lento ou bloqueou | Aumentar timeout, usar proxy |
| Conteúdo vazio | JS não renderizou | Adicionar `waitFor: 5000` |
| Sessão expirou | Login caiu | Recriar sessão com credentials |
| Rate limited | Muitos requests | Espaçar com intervals |
| Créditos esgotados | Free plan acabou | Upgrade ou self-host |

## 9. Checklist de configuração

```
═══ FIRECRAWL SETUP — Checklist ═══

□ Conta criada em firecrawl.dev
□ API Key copiada
□ MCP configurado em .claude/settings.json
□ Testado: firecrawl_scrape em URL pública
□ Testado: firecrawl_search com query
□ Testado: firecrawl_extract com schema
□ (Opcional) Sessão persistente criada para [serviço]
□ (Opcional) Routine configurada usando Firecrawl
□ Créditos monitorados (alerta em 80% uso)
```

## 10. Quando usar
- Ao configurar Firecrawl pela primeira vez
- Ao criar nova routine que precisa de acesso web
- Ao querer scraping sem escrever código (Puppeteer)
- Ao monitorar concorrentes automaticamente
- Referência para troubleshooting de sessões
