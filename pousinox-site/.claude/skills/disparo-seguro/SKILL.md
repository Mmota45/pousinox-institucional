---
description: Disparo WhatsApp B2B seguro — anti-ban, intervalos humanos, sequências de follow-up e integração pipeline
---

# Disparo Seguro

Sistema de prospecção ativa via WhatsApp com proteções anti-ban, intervalos humanos e sequências automatizadas. Integra com AdminCentralVendas e AdminPipeline.

## Contexto Pousinox

- Base: 800K+ prospects com telefone/WhatsApp
- Histórico: ban na semana 2026-04-28 (Z-API, volume alto sem warm-up)
- Objetivo: reativar prospecção ativa sem risco de novo ban
- Stack atual: Z-API (pausado) — considerar Evolution API como alternativa

## 1. Regras anti-ban (OBRIGATÓRIAS)

### Limites diários progressivos (warm-up)
| Semana | Msgs/dia | Intervalo min | Intervalo max | Horário |
|---|---|---|---|---|
| 1 (warm-up) | 5-10 | 300s (5min) | 600s (10min) | 9h-11h |
| 2 | 10-20 | 180s (3min) | 420s (7min) | 9h-12h |
| 3 | 20-35 | 120s (2min) | 300s (5min) | 9h-12h, 14h-16h |
| 4+ (cruzeiro) | 35-50 | 90s | 210s | 9h-12h, 14h-17h |

### Regras invioláveis
- ❌ NUNCA mais de 50 msgs/dia por número
- ❌ NUNCA disparar entre 20h-8h
- ❌ NUNCA disparar sábado/domingo
- ❌ NUNCA mesmo texto para todos (variação obrigatória)
- ❌ NUNCA enviar link na primeira mensagem
- ❌ NUNCA enviar para número não validado
- ✅ SEMPRE validar número antes (phone-exists)
- ✅ SEMPRE variar texto (min 3 templates por nicho)
- ✅ SEMPRE intervalo aleatório (não fixo)
- ✅ SEMPRE parar se taxa de bloqueio > 5%
- ✅ SEMPRE ter dias de "descanso" (1-2 dias/semana sem disparo)

### Sinais de alerta (PARAR IMEDIATAMENTE)
- Mensagem não entregue (1 check, não 2) > 3 seguidas
- Número desconectado do WhatsApp Web
- Recebeu aviso do WhatsApp
- Taxa de resposta caiu abaixo de 2% (pode indicar shadow ban)
- Muitos "bloqueou você" em sequência

## 2. Estratégia de números

### Multi-número (recomendado)
| Número | Uso | Volume | Status |
|---|---|---|---|
| Principal (Marco) | Respostas e fechamento | 0 disparos | Preservado |
| Comercial 1 | Prospecção segmentos A | 30-50/dia | Warm-up |
| Comercial 2 | Prospecção segmentos B | 30-50/dia | Futuro |

### Warm-up de número novo
1. Semana -2: usar normalmente (conversas reais, grupos)
2. Semana -1: enviar mensagens para contatos conhecidos
3. Semana 1: iniciar disparos (5/dia, crescer gradual)
4. Nunca usar número apenas para disparo (precisa de conversas reais)

## 3. Templates por segmento

### Estrutura do template
```
[SAUDAÇÃO] + [CONTEXTO/GANCHO] + [PROPOSTA DE VALOR] + [PERGUNTA ABERTA]
```

Max 250 caracteres (sem link, sem mídia na primeira msg).

### Construção Civil / Construtoras
```
Variante A:
Oi [nome], tudo bem? Vi que a [empresa] atua com obras em [cidade]. Trabalhamos com fixação de porcelanato em fachada, tudo em inox com laudo técnico. Vocês usam algum sistema de fixação atualmente?

Variante B:
[nome], boa tarde! A Pousinox fabrica fixadores de porcelanato em aço inox aqui em Pouso Alegre. Atendemos construtoras em [UF] com projeto sob medida. Posso te mostrar como funciona?

Variante C:
Olá [nome]! Somos fabricantes de fixadores inox para porcelanato — fachada e piso. Temos laudo SENAI e entregamos em [UF]. Trabalham com revestimento em alguma obra agora?
```

### Arquitetura / Especificadores
```
Variante A:
Oi [nome], tudo bem? Sou da Pousinox, fabricamos fixadores de porcelanato em inox 304. Muitos arquitetos especificam nosso sistema para fachadas ventiladas. Você trabalha com esse tipo de projeto?

Variante B:
[nome], boa tarde! A Pousinox tem um sistema de fixação que vários escritórios de arquitetura já especificam. Posso enviar nossa ficha técnica pra você avaliar?
```

### Revendas / Home Centers
```
Variante A:
Oi [nome]! A Pousinox fabrica fixadores de porcelanato em inox — produto com alta procura em lojas de acabamento. Vocês trabalham com esse tipo de produto? Temos condição especial pra revenda.

Variante B:
[nome], boa tarde! Somos fabricantes de fixadores inox, fornecemos direto pra lojas e home centers. Tem interesse em conhecer nossa linha? Margem atrativa pro lojista.
```

### Restaurantes / Food Service
```
Variante A:
Oi [nome]! Vi que o [restaurante] fica em [cidade]. Fabricamos peças em inox sob medida — mesas, coifas, bancadas. Vocês precisam de algo em inox pro espaço?

Variante B:
[nome], tudo bem? A Pousinox faz projetos em inox sob medida pra cozinhas profissionais. Posso te mostrar alguns trabalhos que fizemos na região?
```

### Template genérico (fallback)
```
Oi [nome], tudo bem? Sou da Pousinox, trabalhamos com aço inox — desde fixadores de porcelanato até projetos sob medida. Vi que a [empresa] pode ter demanda nessa área. Faz sentido conversarmos?
```

## 4. Sequência de follow-up

### Cadência padrão
```
D+0: Primeira mensagem (template por segmento)
     → Se respondeu: SAI DA SEQUÊNCIA → Pipeline
     → Se não respondeu: aguardar

D+2: Follow-up 1 (leve)
     "Oi [nome], enviei uma mensagem uns dias atrás. Conseguiu ver?"
     → Se respondeu: SAI → Pipeline
     → Se visualizou e ignorou: aguardar
     → Se não entregue: REMOVER da lista

D+5: Follow-up 2 (valor)
     "Oi [nome]! Separei um case de [segmento similar] que ficou muito bom. Posso compartilhar?"
     → Se respondeu: SAI → Pipeline
     → Se ignorou: último attempt

D+10: Follow-up 3 (último — despedida)
     "[nome], como não tive retorno vou encerrar por aqui. Se precisar de algo em inox no futuro, fico à disposição! Abs"
     → FIM DA SEQUÊNCIA (não insistir mais)
```

### Regras de follow-up
- NUNCA mais de 3 follow-ups (total 4 mensagens)
- NUNCA follow-up no mesmo dia
- Se bloqueou: remover permanentemente
- Se pediu para parar: remover + registrar opt-out
- Intervalo entre follow-ups: mínimo 48h
- Variação de horário entre mensagens (não sempre às 9h)

### Após resposta positiva
```
1. Mover para pipeline (estagio='entrada')
2. Atribuir ao responsável comercial
3. Próxima ação: ligação ou envio de material (número principal)
4. Registrar em activity_log
```

## 5. Implementação técnica

### Tabela de controle (Supabase)
```sql
CREATE TABLE disparos_whatsapp (
  id BIGSERIAL PRIMARY KEY,
  prospect_id BIGINT REFERENCES prospeccao(id),
  numero VARCHAR(20) NOT NULL,
  numero_remetente VARCHAR(20) NOT NULL,
  template_usado VARCHAR(100),
  mensagem_enviada TEXT,
  status VARCHAR(20) DEFAULT 'pendente',
    -- pendente, enviado, entregue, lido, respondeu, falhou, bloqueou, optout
  sequencia_posicao INT DEFAULT 0, -- 0=primeira, 1=followup1, 2=followup2, 3=followup3
  enviado_em TIMESTAMPTZ,
  entregue_em TIMESTAMPTZ,
  lido_em TIMESTAMPTZ,
  respondeu_em TIMESTAMPTZ,
  resposta_texto TEXT,
  erro TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_disparos_status ON disparos_whatsapp(status);
CREATE INDEX idx_disparos_prospect ON disparos_whatsapp(prospect_id);
CREATE INDEX idx_disparos_sequencia ON disparos_whatsapp(prospect_id, sequencia_posicao);

-- Controle de opt-out (NUNCA mais disparar)
CREATE TABLE optout_whatsapp (
  numero VARCHAR(20) PRIMARY KEY,
  motivo VARCHAR(100),
  criado_em TIMESTAMPTZ DEFAULT NOW()
);
```

### Edge function: disparar-sequencia
```typescript
// Lógica principal
async function processarFila() {
  // 1. Buscar próximos da fila (respeitando limite diário)
  const limite = calcularLimiteDiario(semanaAtual)
  const jaEnviados = await contarEnviadosHoje(numeroRemetente)
  const disponivel = limite - jaEnviados
  
  if (disponivel <= 0) return { msg: 'Limite diário atingido' }
  
  // 2. Buscar pendentes (não opt-out, não bloqueado, sequência correta)
  const pendentes = await buscarPendentes(disponivel)
  
  // 3. Para cada, enviar com intervalo aleatório
  for (const p of pendentes) {
    const intervalo = randomEntre(intervaloMin, intervaloMax)
    await sleep(intervalo * 1000)
    
    // Verificar opt-out antes de cada envio
    if (await isOptOut(p.numero)) continue
    
    const msg = renderTemplate(p.template, p.prospect)
    const resultado = await enviarWhatsApp(p.numero, msg)
    await registrarEnvio(p.id, resultado)
  }
}
```

### Webhook de resposta
```typescript
// Receber mensagem de volta
async function onMensagemRecebida(payload) {
  const { from, text, timestamp } = payload
  
  // Buscar disparo ativo para este número
  const disparo = await buscarDisparoAtivo(from)
  if (!disparo) return // Mensagem não relacionada
  
  // Atualizar status
  await atualizarDisparo(disparo.id, {
    status: 'respondeu',
    respondeu_em: timestamp,
    resposta_texto: text
  })
  
  // Criar deal no pipeline
  await criarDealPipeline(disparo.prospect_id, text)
  
  // Notificar responsável
  await notificarMarco(`Resposta de ${disparo.prospect.nome}: "${text}"`)
  
  // PARAR sequência para este prospect
  await pararSequencia(disparo.prospect_id)
}
```

## 6. Evolution API vs Z-API

| Critério | Z-API | Evolution API |
|---|---|---|
| Tipo | SaaS (pago) | Open source (self-hosted) |
| Custo | R$ 80-200/mês por número | Grátis (custo = VPS) |
| Setup | Fácil (dashboard) | Médio (Docker na VPS) |
| Multi-número | Pago por número | Ilimitado |
| Webhooks | ✅ | ✅ |
| Rate limit | Definido por eles | Você controla |
| Estabilidade | Alta | Média (depende da VPS) |
| Risco de ban | Igual (depende do comportamento) | Igual |

### Recomendação
- **Fase 1 (agora):** Usar Z-API com número novo + warm-up (já conhecem a API)
- **Fase 2 (quando escalar):** Migrar para Evolution API (custo zero por número)

## 7. Dashboard de controle

### Métricas diárias
```
┌─────────────────────────────────────────────┐
│ DISPAROS HOJE                               │
│                                             │
│ Enviados: 32/50    ████████████░░░░  64%    │
│ Entregues: 30      ██████████████░░  94%    │
│ Lidos: 18          █████████░░░░░░░  60%    │
│ Responderam: 4     ██░░░░░░░░░░░░░░  13%    │
│                                             │
│ ⚠️ Bloqueios: 1 (3%) — OK                   │
│ ⏸️ Opt-outs: 0                              │
└─────────────────────────────────────────────┘
```

### Métricas de saúde (monitorar sempre)
| Métrica | Saudável | Alerta | Crítico (PARAR) |
|---|---|---|---|
| Taxa entrega | >95% | 90-95% | <90% |
| Taxa leitura | >40% | 20-40% | <20% |
| Taxa resposta | >5% | 2-5% | <2% |
| Taxa bloqueio | <2% | 2-5% | >5% |
| Opt-outs/dia | <3 | 3-5 | >5 |

## 8. Integração com sistema existente

```
AdminCentralVendas (Hot List)
    │
    ▼ Selecionar prospects + segmento
┌─────────────────────┐
│ Módulo Disparo      │
│ - Template por nicho│
│ - Fila com intervalo│
│ - Status em tempo   │
└────────┬────────────┘
         │
    ▼ Resposta recebida
┌─────────────────────┐
│ AdminPipeline       │
│ - Deal criado auto  │
│ - Estagio: entrada  │
│ - Notifica vendas   │
└────────┬────────────┘
         │
    ▼ Deal avança
┌─────────────────────┐
│ AdminOrcamento      │
│ - Proposta gerada   │
│ - Enviada pelo nº   │
│   principal         │
└─────────────────────┘
```

## 9. Formato de entrega

```
★ DISPARO SEGURO — Configuração

═══ STATUS ═══
Número: [tel] — Semana [N] warm-up
Limite hoje: [N] msgs
Segmentos ativos: [lista]
Templates: [N] por segmento

═══ FILA ═══
Pendentes: [N] prospects validados
Próximo envio: [horário]
Sequência ativa: [N] em follow-up

═══ RESULTADOS (últimos 7 dias) ═══
| Métrica | Valor | Status |
|---|---|---|
| Enviados | N | ✅ |
| Entregues | N (X%) | ✅/⚠️ |
| Lidos | N (X%) | ✅/⚠️ |
| Responderam | N (X%) | ✅/⚠️ |
| Deals criados | N | |
| Bloqueios | N (X%) | ✅/⚠️/🔴 |

═══ SAÚDE ═══
🟢 Operação normal / ⚠️ Atenção / 🔴 PAUSAR
```

## 10. Quando usar
- Ao reativar prospecção ativa pós-ban
- Ao configurar número novo para disparos
- Ao definir cadência para novo segmento
- Ao monitorar saúde dos disparos (diário)
- Ao escalar volume (adicionar número)
