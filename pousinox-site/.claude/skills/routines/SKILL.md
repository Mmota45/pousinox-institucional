---
description: Configurar Claude Routines (automação cloud 24/7) — triggers, pipelines e integrações Pousinox
---

# Routines

Configure rotinas autônomas no Claude Routines (cloud Anthropic) para automação 24/7 sem depender de computador local.

## Conceito

Claude Routines = sessões Claude Code rodando na nuvem com acesso ao repositório GitHub, skills e settings. Três tipos de trigger:
- **Schedule** — cron (horário fixo)
- **Webhook** — evento externo (compra, lead, pagamento)
- **GitHub** — ação no repositório (PR, issue, push)

## 1. Rotinas Pousinox

### Schedule (Diárias)

#### KPI Morning Brief — 7h
```
Trigger: Schedule diário 07:00 BRT
Ação:
1. Consultar Supabase:
   - fin_movimentacoes (saldo ontem)
   - pipeline_deals (novos, ganhos, valor total)
   - followups (vencidos, hoje)
   - leads (últimas 24h)
   - ordens_producao (em andamento)
2. Montar resumo executivo (max 15 linhas)
3. Enviar via Z-API WhatsApp para Marco

Formato:
★ BOM DIA — [data]
💰 Saldo: R$ XX.XXX
📊 Pipeline: X deals (R$ XX.XXX)
🔥 Follow-ups hoje: N | Atrasados: N
📥 Leads novos: N
🏭 OPs em produção: N
⚠️ Alertas: [pendências críticas]
```

#### Follow-up Alert — 8h
```
Trigger: Schedule diário 08:00 BRT
Ação:
1. SELECT * FROM followups WHERE status='pendente' AND data_prevista <= CURRENT_DATE
2. Agrupar por vendedor/responsável
3. Para cada follow-up atrasado:
   - Nome do prospect/cliente
   - Dias de atraso
   - Último contato
   - Deal vinculado (se houver)
4. Enviar alerta WhatsApp

Formato:
⚠️ FOLLOW-UPS PENDENTES — [N] atrasados

1. [Empresa] — X dias atraso — Deal R$ XX.XXX
2. [Empresa] — X dias atraso — Sem deal
...
Ação: Responda com número para ver detalhe
```

#### Estoque Mínimo Check — 6h
```
Trigger: Schedule diário 06:00 BRT
Ação:
1. SELECT * FROM estoque_itens WHERE saldo_atual <= estoque_minimo AND ativo=true
2. Se houver itens abaixo do mínimo:
   - Listar item, saldo atual, mínimo, deficit
   - Verificar se já existe SC pendente para o item
3. Enviar alerta apenas se houver itens críticos

Formato:
🔴 ESTOQUE CRÍTICO — [N] itens abaixo do mínimo

| Item | Saldo | Mínimo | Deficit |
|---|---|---|---|
| [nome] | X | Y | -Z |

SC pendente: [sim/não para cada]
```

### Schedule (Semanais)

#### Pesquisa Concorrência — Segunda 9h
```
Trigger: Schedule semanal seg 09:00 BRT
Ação:
1. Buscar Meta Ads Library: "fixador porcelanato", "inox construção", "fixação fachada"
2. Identificar anúncios ativos de concorrentes
3. Para cada concorrente:
   - Quantidade de anúncios ativos
   - Tipos de criativo (imagem/vídeo/carrossel)
   - Hooks principais (primeiras linhas)
   - Landing pages (URL + screenshot)
   - Ofertas identificadas
4. Comparar com semana anterior (se houver histórico)
5. Salvar em knowledge_guias + enviar resumo

Formato:
★ RADAR CONCORRÊNCIA — Semana [N]

[Concorrente 1]: X anúncios ativos
  Hooks: "...", "..."
  Oferta: [descrição]
  Mudança: [+N novos | -N removidos | sem mudança]

[Concorrente 2]: ...

INSIGHT: [observação estratégica]
OPORTUNIDADE: [gap identificado]
```

#### Radar SEO — Terça 8h
```
Trigger: Schedule semanal ter 08:00 BRT
Ação:
1. Consultar Google Search Console (API ou cache GSC)
2. Top queries: impressões, cliques, posição média, CTR
3. Identificar:
   - Keywords subindo (posição melhorou >3 posições)
   - Keywords caindo (posição piorou >3 posições)
   - Oportunidades (impressões altas + posição 5-20)
   - Quick wins (posição 4-10, CTR < média)
4. Cruzar com market_keywords (volume mensal)
5. Salvar análise + enviar resumo

Formato:
★ RADAR SEO — Semana [N]

📈 SUBINDO: [keyword] pos X→Y (+Z cliques)
📉 CAINDO: [keyword] pos X→Y
🎯 OPORTUNIDADE: [keyword] — Z impressões, pos X
⚡ QUICK WIN: [keyword] — melhorar título/meta

Ação recomendada: [1 sugestão prática]
```

#### Relatório Semanal — Sexta 17h
```
Trigger: Schedule semanal sex 17:00 BRT
Ação:
1. Agregar dados da semana:
   - Receitas realizadas vs previstas
   - Deals ganhos/perdidos
   - Leads gerados
   - OPs concluídas
   - NFs emitidas
2. Comparar com semana anterior (% variação)
3. Listar top 3 conquistas + top 3 pendências
4. Gerar resumo executivo + salvar knowledge_guias

Formato:
★ SEMANA [N] — RESUMO EXECUTIVO

💰 Receita: R$ XX.XXX (▲/▼ X% vs anterior)
🤝 Deals: X ganhos (R$ XXX) | Y perdidos
📥 Leads: N novos
🏭 Produção: X OPs concluídas
📄 Fiscal: X NFs emitidas (R$ XXX)

TOP 3 CONQUISTAS:
1. ...
2. ...
3. ...

PENDÊNCIAS CRÍTICAS:
1. ...
```

### Webhooks

#### Novo Lead — Evento site
```
Trigger: Webhook POST /routines/novo-lead
Payload: { nome, email, telefone, origem, interesse }
Ação:
1. Inserir em leads (Supabase)
2. Scoring rápido:
   - Tem CNPJ? (+3)
   - Origem Google Ads? (+2)
   - Interesse em produto específico? (+2)
   - Telefone com DDD de UF prioritária? (+1)
3. Se score >= 7: notificar Marco imediatamente via WhatsApp
4. Se score < 7: agendar follow-up para próximo dia útil
5. Enviar email de boas-vindas (Brevo)

Formato WhatsApp (lead quente):
🔥 LEAD QUENTE — Score [N]/10
[Nome] — [Cidade/UF]
Interesse: [produto/serviço]
Origem: [canal]
Tel: [número]
→ Ligar em até 5 min para máxima conversão
```

#### Pagamento Confirmado — Webhook Pix
```
Trigger: Webhook POST /routines/pagamento
Payload: { pedido_id, valor, metodo }
Ação:
1. Atualizar pedido status → 'pago'
2. Criar fin_movimentacoes (entrada)
3. Atualizar fin_lancamentos status → 'pago'
4. Notificar produção (se produto sob encomenda)
5. Enviar confirmação WhatsApp ao cliente
6. Notificar Marco (resumo)
```

#### NF Emitida — Webhook fiscal
```
Trigger: Webhook POST /routines/nf-emitida
Payload: { chave_nf, tipo, valor, destinatario }
Ação:
1. Registrar em docs_fiscais_emitidos
2. Gerar movimentação de saída (estoque)
3. Criar fin_lancamentos (receita) com categorização automática por CNPJ
4. Atualizar dashboard financeiro
```

### GitHub Triggers

#### PR Review — Pull Request opened
```
Trigger: GitHub PR opened/updated em pousinox-site
Ação:
1. Ler diff completo
2. Verificar:
   - TypeScript errors (rodar typecheck)
   - Console.logs em código de produção
   - Imports não usados
   - Padrões do CLAUDE.md respeitados
   - RLS em novas tabelas
   - Secrets hardcoded
3. Comentar no PR com findings
4. Aprovar se tudo OK, request changes se crítico

Formato comentário:
## 🤖 Review Automático

✅ Typecheck OK
✅ Sem console.logs
⚠️ [warning leve]
❌ [problema crítico — bloqueia merge]

Sugestão: [melhoria opcional]
```

#### Issue Triage — Issue created
```
Trigger: GitHub issue created
Ação:
1. Analisar título e corpo
2. Classificar: bug | feature | question | docs
3. Atribuir labels
4. Se bug: tentar reproduzir, sugerir fix
5. Se feature: avaliar complexidade (P/M/G)
6. Comentar com classificação e próximos passos
```

#### Deploy Monitor — Push to main
```
Trigger: GitHub push to main
Ação:
1. Rodar smoke-test (typecheck + build)
2. Se passou: confirmar deploy healthy
3. Se falhou: abrir issue automática + notificar Marco
4. Verificar Lighthouse score pós-deploy
5. Reportar resultado
```

## 2. Configuração

### Estrutura no repositório
```
.claude/
  routines/
    kpi-morning.md        # Instruções da rotina
    followup-alert.md
    estoque-check.md
    concorrencia.md
    radar-seo.md
    semanal.md
    novo-lead.md
    pagamento.md
    pr-review.md
```

### Formato do arquivo de rotina
```markdown
---
trigger: schedule
schedule: "0 7 * * *"  # cron expression
timezone: "America/Sao_Paulo"
---

# KPI Morning Brief

[Instruções completas para o agente executar]
```

### Secrets necessários
| Secret | Uso | Onde configurar |
|---|---|---|
| SUPABASE_URL | Acesso ao banco | Routines settings |
| SUPABASE_SERVICE_KEY | Admin access | Routines settings |
| ZAPI_INSTANCE_ID | WhatsApp | Routines settings |
| ZAPI_TOKEN | WhatsApp | Routines settings |
| BRAVE_API_KEY | Busca web | Routines settings |
| BREVO_API_KEY | Email | Routines settings |

### Webhook URLs
Após criar a routine, copiar a URL gerada e configurar nos sistemas externos:
- Site (formulário de contato) → webhook novo-lead
- Gateway Pix → webhook pagamento
- Sistema fiscal → webhook nf-emitida

## 3. Boas práticas

### Idempotência
- Toda rotina deve ser segura para re-executar (sem duplicar dados)
- Usar `upsert` com constraint em vez de `insert`
- Verificar se ação já foi tomada antes de executar (ex: `WHERE notificado=false`)

### Rate limits
- WhatsApp Z-API: max 15 msgs/dia (distribuir ao longo do dia)
- Supabase: sem limite prático para service_role
- Meta Ads Library: respeitar rate limit (1 req/s)
- GSC API: 1200 queries/min

### Fallback
- Se WhatsApp falhar → enviar por email (Brevo)
- Se Supabase timeout → retry 1x após 30s
- Se busca web falhar → usar cache da última execução

### Monitoramento
- Cada rotina salva log em `activity_log` (tipo='routine', detalhes=resultado)
- Dashboard de rotinas: última execução, status, próxima execução
- Alerta se rotina falhar 2x consecutivas

## 4. Prioridade de implementação

| Fase | Rotinas | Impacto |
|---|---|---|
| 1 (imediato) | KPI Morning, Follow-up Alert, PR Review | Alto — visibilidade diária |
| 2 (semana 1) | Novo Lead webhook, Estoque Check | Alto — automação comercial |
| 3 (semana 2) | Radar SEO, Concorrência | Médio — inteligência |
| 4 (semana 3) | Relatório Semanal, Deploy Monitor | Médio — governança |
| 5 (futuro) | Pagamento webhook, NF webhook | Alto — mas depende de integrações |

## 5. Formato de entrega

```
★ ROUTINE — [nome]

Trigger: [schedule/webhook/github] — [detalhe]
Frequência: [quando roda]
Dependências: [APIs, secrets, tabelas]

═══ LÓGICA ═══
1. [passo]
2. [passo]
3. [passo]

═══ OUTPUT ═══
[formato da mensagem/ação final]

═══ CONFIGURADO ═══
✅ Arquivo: .claude/routines/[nome].md
✅ Secrets: [lista]
✅ Testado: [sim/não]
```

## 6. Quando usar esta skill
- Ao identificar tarefa repetitiva que Marco faz manualmente
- Ao querer monitoramento proativo (não esperar Marco perguntar)
- Ao integrar sistema externo que gera eventos
- Ao querer "funcionário digital" fazendo trabalho de rotina
