---
description: Estratégia MCP + Skills — mapear capacidades, decidir camada correta e integrar ferramentas com inteligência
---

# MCP Strategy

Framework para decidir quando usar MCP, Skill ou ambos. Mapeia capacidades disponíveis, gaps e integrações ideais para o ecossistema Pousinox.

## Conceito central

```
┌─────────────────────────────────────────────┐
│  SKILL (Inteligência)                       │
│  "Como, quando e por que usar"              │
│  → Markdown com padrões, lógica, formato    │
├─────────────────────────────────────────────┤
│  MCP (Capacidade)                           │
│  "O que consigo fazer"                      │
│  → Protocolo que conecta a sistemas externos│
├─────────────────────────────────────────────┤
│  CLAUDE CODE (Motor)                        │
│  "Executo instruções com ferramentas"       │
│  → Bash, Read, Write, Edit, Grep, etc.     │
└─────────────────────────────────────────────┘
```

- **MCP sem Skill** = capacidade bruta (faz, mas sem padrão)
- **Skill sem MCP** = inteligência limitada (sabe como, mas não consegue)
- **MCP + Skill** = agente completo (sabe + consegue + segue padrão)

## 1. Matriz de decisão

| Situação | Solução | Exemplo |
|---|---|---|
| Claude não consegue acessar sistema X | MCP isolado | Ler emails do Gmail |
| Claude faz a tarefa mas sem padrão/formato | Skill isolada | Gerar relatório SEO |
| Claude precisa acessar E seguir metodologia | MCP + Skill | Pesquisar YouTube + extrair cortes |
| Claude já tem a ferramenta (Bash, Read, etc.) | Skill isolada | Smoke test, deploy |
| Automação 24/7 sem interação | Routine + MCP + Skill | KPI morning brief |

## 2. MCPs do ecossistema Pousinox

### Já conectados

| MCP | Capacidade | Skills que usam |
|---|---|---|
| Context-mode | Indexar, buscar, executar código em sandbox | Todas (pesquisa, análise) |
| Canva | Criar/editar designs, exportar | `/gerar-conteudo`, `/social-post` |
| Gmail | Ler/enviar emails | `/routines` (alertas) |
| Google Calendar | Ler/criar eventos | `/routines` (agendamentos) |
| Google Drive | Ler/criar arquivos | `/pesquisar` (fontes) |

### Recomendados (instalar)

| MCP | Capacidade que adiciona | Prioridade | Skills beneficiadas |
|---|---|---|---|
| **Supabase** | CRUD direto, RPC, realtime | Alta | `/routines`, `/audit-bundle`, `/checar-db` |
| **Z-API (WhatsApp)** | Enviar/receber mensagens | Alta | `/routines`, `/central-vendas`, `/sdr-autonomo` |
| **Brave Search** | Busca web estruturada | Alta | `/pesquisar`, `/radar-seo`, `/concorrencia` |
| **GitHub** | Issues, PRs, Actions | Média | `/routines` (PR review), `/deploy` |
| **Brevo (email)** | Envio transacional/marketing | Média | `/routines`, `/nurturing` |
| **YouTube** | Transcrição, metadata | Média | `/pesquisar`, `/gerar-conteudo` |
| **Google Search Console** | Queries, posições, cliques | Média | `/radar-seo`, `/routines` |
| **Meta Ads Library** | Anúncios concorrentes | Baixa | `/concorrencia`, `/meta-ads` |
| **Serper** | SERP Google estruturada | Baixa | `/pesquisar`, `/radar-seo` |
| **Firecrawl** | Navegação web segura, scraping, sessões persistentes | Alta | `/pesquisar`, `/audit-instagram`, `/routines` (concorrência), `/radar-seo` |
| **Notion/Linear** | Gestão de tarefas | Baixa | `/maestro`, `/empresa-ia` |

## 3. Arquitetura de tokens (Progressive Disclosure)

### Como funciona
```
Inicialização (~3.000 tokens):
├── CLAUDE.md (contexto do projeto)
├── MEMORY.md (índice de memórias)
├── Skills index (nome + description de cada)  ← ~20 tokens/skill
└── MCPs index (nome + description de cada)    ← ~30 tokens/MCP

Ativação sob demanda:
├── Usuário menciona "deploy" → carrega /deploy (~200 tokens)
├── Skill chama MCP Supabase → carrega schema (~500 tokens)
└── Total por interação: ~1.000-2.000 tokens extras
```

### Regras de economia
- Skill description: max 1 linha (usada para matching)
- MCP tools: só as relevantes são carregadas (não todas)
- Nunca carregar >3 skills simultaneamente
- MCPs com muitas tools (>20): criar wrapper skill que filtra

## 4. Padrão de integração MCP + Skill

### Template de skill que usa MCP
```markdown
---
description: [o que faz em 1 linha]
---

# [Nome]

## Pré-requisitos
- MCP: [nome do MCP necessário]
- Tabelas: [se precisa Supabase]
- Secrets: [se precisa credenciais]

## Fluxo
1. [Etapa usando ferramenta nativa (Read, Bash)]
2. [Etapa usando MCP — especificar qual tool do MCP]
3. [Etapa de decisão/análise (inteligência da skill)]
4. [Etapa de output — formato definido]

## Quando o MCP não está disponível
- Fallback: [alternativa sem MCP — ex: usar Bash + curl]
- Limitação: [o que perde sem o MCP]
```

### Exemplo real: Pesquisa com Brave MCP
```markdown
## Fluxo
1. Definir queries de busca (Skill: inteligência)
2. Executar busca via MCP Brave (Capacidade)
   → tool: brave_search({ query: "fixador porcelanato mercado 2026" })
3. Filtrar e validar fontes (Skill: critérios)
4. Sintetizar no formato do objetivo (Skill: template)
5. Salvar em knowledge_guias via MCP Supabase (Capacidade)

## Fallback sem MCP Brave
- Usar ctx_fetch_and_index com URLs conhecidas
- Limitação: não descobre fontes novas, só analisa conhecidas
```

## 5. Mapa de integrações Pousinox

```
                    ┌─────────────┐
                    │   ROUTINES  │ (cloud 24/7)
                    └──────┬──────┘
                           │ triggers
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐       ┌────▼────┐       ┌────▼────┐
   │Schedule │       │Webhook  │       │GitHub   │
   │(cron)   │       │(evento) │       │(PR/push)│
   └────┬────┘       └────┬────┘       └────┬────┘
        │                  │                  │
        ▼                  ▼                  ▼
   ┌─────────────────────────────────────────────┐
   │              SKILLS (Inteligência)           │
   │  /routines  /pesquisar  /deploy  /sdr       │
   └───────────────────┬─────────────────────────┘
                       │ chamam
        ┌──────────────┼──────────────────┐
        │              │                  │
   ┌────▼────┐   ┌────▼────┐       ┌────▼────┐
   │Supabase │   │ Z-API   │       │  Brave  │
   │  MCP    │   │  MCP    │       │  MCP    │
   └────┬────┘   └────┬────┘       └────┬────┘
        │              │                  │
        ▼              ▼                  ▼
   ┌─────────┐  ┌──────────┐     ┌──────────┐
   │ Banco   │  │ WhatsApp │     │ Web/SERP │
   │ Dados   │  │ Clientes │     │ Fontes   │
   └─────────┘  └──────────┘     └──────────┘
```

## 6. Plano de implementação

### Fase 1 — Fundação (agora)
| Ação | Detalhe |
|---|---|
| Instalar MCP Supabase | `npx @anthropic-ai/mcp-supabase` — acesso direto ao banco |
| Mapear tools existentes | Listar todas as tools dos MCPs já conectados |
| Auditar skills sem MCP | Identificar skills que precisam de capacidade externa |

### Fase 2 — Comunicação (semana 1)
| Ação | Detalhe |
|---|---|
| Configurar MCP Z-API | Wrapper REST → enviar/receber WhatsApp |
| Configurar MCP Brevo | Envio de emails transacionais |
| Atualizar `/routines` | Apontar para MCPs em vez de edge functions |

### Fase 3 — Inteligência (semana 2)
| Ação | Detalhe |
|---|---|
| Configurar MCP Brave | Busca web estruturada |
| Configurar MCP YouTube | Transcrição para pesquisa |
| Criar skill `/cortes-video` | MCP YouTube + Skill de análise |
| Atualizar `/pesquisar` | Usar MCP Brave como fonte primária |

### Fase 4 — Monitoramento (semana 3)
| Ação | Detalhe |
|---|---|
| Configurar MCP GSC | Google Search Console |
| Configurar MCP GitHub | Issues + PRs programáticos |
| Criar dashboard de MCPs | Status, uso, tokens consumidos |

## 7. Como criar um MCP custom (para APIs próprias)

Se não existe MCP pronto para uma API que usamos (ex: Z-API, NFSTok):

```typescript
// server.ts — MCP server custom
import { Server } from "@modelcontextprotocol/sdk/server/index.js";

const server = new Server({ name: "zapi-mcp", version: "1.0.0" }, {
  capabilities: { tools: {} }
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "send_whatsapp",
      description: "Envia mensagem WhatsApp via Z-API",
      inputSchema: {
        type: "object",
        properties: {
          phone: { type: "string", description: "Número com DDI (5535...)" },
          message: { type: "string", description: "Texto da mensagem" }
        },
        required: ["phone", "message"]
      }
    },
    {
      name: "check_whatsapp",
      description: "Verifica se número tem WhatsApp",
      inputSchema: {
        type: "object",
        properties: { phone: { type: "string" } },
        required: ["phone"]
      }
    }
  ]
}));
```

Registrar em `.claude/settings.json`:
```json
{
  "mcpServers": {
    "zapi": {
      "command": "node",
      "args": ["./mcp-servers/zapi/server.js"],
      "env": { "ZAPI_TOKEN": "..." }
    }
  }
}
```

## 8. Anti-padrões

| Anti-padrão | Problema | Correto |
|---|---|---|
| MCP para tudo | Consome tokens desnecessários | Só quando Claude não consegue nativamente |
| Skill que repete docs do MCP | Redundante, desatualiza | Skill foca no "quando/como", não no "o quê" |
| MCP sem skill | Capacidade sem padrão = resultado inconsistente | Sempre parear com skill de uso |
| Muitos MCPs simultâneos | 82K tokens na init | Progressive disclosure, max 5 ativos |
| MCP para leitura de arquivos locais | Claude já tem Read/Glob/Grep | Só MCP para sistemas externos |

## 9. Formato de entrega

```
★ MCP STRATEGY — Avaliação

═══ CAPACIDADES ATUAIS ═══
| MCP | Status | Tools disponíveis |
|---|---|---|
| [nome] | ✅ Conectado | N tools |

═══ GAPS IDENTIFICADOS ═══
| Necessidade | Solução | Prioridade |
|---|---|---|
| [o que falta] | MCP X / Skill Y / Ambos | Alta/Média/Baixa |

═══ RECOMENDAÇÃO ═══
Próximo MCP a instalar: [nome]
Motivo: [desbloqueia N skills]
Esforço: [baixo/médio/alto]

═══ INTEGRAÇÕES PROPOSTAS ═══
- Skill [X] + MCP [Y] → resultado [Z]
```

## 10. Quando usar esta skill
- Ao decidir se precisa de MCP, Skill ou ambos para resolver um problema
- Ao planejar nova automação (qual camada resolve?)
- Ao instalar novo MCP (como integrar com skills existentes?)
- Ao auditar consumo de tokens (MCPs desnecessários?)
- Ao criar MCP custom para API proprietária
