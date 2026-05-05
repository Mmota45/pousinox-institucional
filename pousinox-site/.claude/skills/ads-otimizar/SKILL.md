---
description: Otimização de tráfego pago via API — negativar termos, pausar an��ncios, sugerir criativos e redistribuir budget
---

# Ads Otimizar

Execute ações de otimização diretamente nas contas de Google Ads e Meta Ads via API, sem precisar abrir os gerenciadores.

## 1. Diagnóstico automático

### Análise Google Ads
```
1. Termos de busca (últimos 14 dias):
   - Termos com gasto > R$50 e 0 conversões → NEGATIVAR
   - Termos com CPA > 2x meta → REVISAR
   - Termos com conversão abaixo de R$X → EXPANDIR (broad)

2. Keywords:
   - QS < 5 com gasto alto → OTIMIZAR (LP ou anúncio)
   - QS ≥ 8 com posição média > 3 → AUMENTAR LANCE
   - Keywords sem impressão (7d) → VERIFICAR status

3. Anúncios:
   - RSA com força "Pobre" ou "Média" → MELHORAR assets
   - CTR < 2% → TESTAR novas headlines
   - Sem anúncio ativo no grupo → ALERTA

4. Campanhas:
   - Budget limitado (impression share < 60%) → AUMENTAR ou segmentar
   - Custo/dia > budget configurado → VERIFICAR
```

### Análise Meta Ads
```
1. Criativos:
   - CTR < 1% (últimos 7d) → PAUSAR ou substituir
   - Frequency > 3.5 → FADIGA (renovar público ou criativo)
   - CPM > 2x média da conta → PÚBLICO saturado

2. Conjuntos:
   - CPA > meta por 3+ dias → PAUSAR
   - CPA < meta e budget < 30% do total → ESCALAR (+20% budget)
   - Sem conversão em 72h → PAUSAR

3. Públicos:
   - Lookalike sem teste → RECOMENDAR criação
   - Retargeting sem exclusão de compradores → CORRIGIR
   - Interesse amplo demais (>10M pessoas) → SEGMENTAR

4. Funil:
   - Só campanhas de fundo → RECOMENDAR topo (awareness)
   - Topo sem conexão com remarketing → CRIAR audiência
```

## 2. Ações via API

### Google Ads — Negativar termos
```typescript
// Adicionar negative keywords
async function negativarTermos(termos: string[], campaignId: string) {
  const operations = termos.map(termo => ({
    create: {
      campaignId,
      keyword: { text: termo, matchType: 'EXACT' },
      negative: true
    }
  }))
  
  await googleAds.mutate({
    customerId: CUSTOMER_ID,
    operations: operations.map(op => ({
      campaignCriterionOperation: op
    }))
  })
  
  return { negativados: termos.length }
}
```

### Google Ads — Sugerir headlines (IA)
```typescript
async function sugerirHeadlines(adGroup: string, keywords: string[]) {
  const prompt = `
    Contexto: Pousinox — fixadores de porcelanato em aço inox
    Keywords do grupo: ${keywords.join(', ')}
    
    Gere 5 headlines (max 30 chars cada) para Google Ads RSA.
    Foco em: benefício, diferencial técnico, urgência, prova social.
    Tom: profissional B2B.
  `
  
  const headlines = await claude.generate(prompt)
  
  // Criar como rascunho (não publica direto)
  await googleAds.createDraftAd({
    adGroup,
    headlines,
    status: 'PAUSED' // Sempre pausado para revisão
  })
  
  return { sugestoes: headlines, status: 'rascunho_criado' }
}
```

### Meta Ads — Pausar/Ativar
```typescript
async function alterarStatusAnuncio(adId: string, status: 'ACTIVE' | 'PAUSED') {
  await fetch(`https://graph.facebook.com/v19.0/${adId}`, {
    method: 'POST',
    body: JSON.stringify({ status }),
    headers: { Authorization: `Bearer ${META_TOKEN}` }
  })
}

async function escalarAdset(adsetId: string, percentual: number) {
  const adset = await getAdset(adsetId)
  const novoBudget = Math.round(adset.daily_budget * (1 + percentual / 100))
  
  // Limite: nunca mais que +30% de uma vez (regra Meta)
  const maxBudget = Math.round(adset.daily_budget * 1.3)
  const budgetFinal = Math.min(novoBudget, maxBudget)
  
  await fetch(`https://graph.facebook.com/v19.0/${adsetId}`, {
    method: 'POST',
    body: JSON.stringify({ daily_budget: budgetFinal })
  })
}
```

## 3. Fluxo de otimização

### Rotina diária (automática via /routines)
```
09:00 — Coleta de dados (últimas 24h)
09:05 — Diagnóstico automático
09:10 — Classificar ações por impacto:
         🔴 Crítico: gasto sem retorno → executa automaticamente (negativar/pausar)
         ⚠️ Importante: sugestões → envia para aprovação
         💡 Oportunidade: escalar → envia sugestão
09:15 — Enviar resumo WhatsApp com ações tomadas + pendentes de aprovação
```

### Rotina semanal (revisão profunda)
```
Segunda 10:00 — Análise completa 7 dias
- Top 10 termos desperdiçando verba
- Top 5 criativos para escalar
- Sugestão de novos testes A/B
- Redistribuição de budget por performance
- Relatório enviado por email (PDF)
```

## 4. Regras de segurança

### Limites de ação automática (sem aprovação)
| Ação | Limite | Condição |
|---|---|---|
| Negativar termo | Ilimitado | Gasto > R$30 e 0 conversões |
| Pausar anúncio Meta | Max 2/dia | CPA > 3x meta por 3 dias |
| Ajustar lance | ±15% max | Baseado em QS e posição |

### Ações que SEMPRE pedem aprovação
| Ação | Por quê |
|---|---|
| Pausar campanha inteira | Impacto alto |
| Aumentar budget > 20% | Impacto financeiro |
| Publicar novo anúncio | Precisa revisão de copy |
| Criar nova campanha | Decisão estratégica |
| Alterar público/segmentação | Pode afetar funil |

### Rollback
- Toda ação grava log em `activity_log` com estado anterior
- Botão "Desfazer" disponível por 24h
- Se CPA piorar >30% após ação → alerta autom��tico

## 5. Sugestões de criativos (IA)

### Para Google Ads (texto)
```
Input: keywords do grupo + landing page + anúncios atuais
Output:
- 5 Headlines (max 30 chars)
- 3 Descriptions (max 90 chars)
- 2 Sitelinks sugeridos
- Pin suggestions (qual headline na posição 1)
```

### Para Meta Ads (conceito)
```
Input: público-alvo + objetivo + criativos atuais (performance)
Output:
- 3 conceitos de criativo (descrição visual + copy)
- Hook sugerido (primeiros 3 segundos para vídeo)
- Formato recomendado (carrossel/vídeo/imagem)
- Referência: /carrossel ou /gerar-video para produzir
```

## 6. Formato de entrega

```
★ ADS OTIMIZAR — [data]

═══ DIAGNÓSTICO ═══

GOOGLE ADS:
🔴 Crítico:
- [N] termos desperdiçando R$ XXX (0 convers��es)
- [N] keywords com QS < 5

⚠️ Importante:
- [N] anúncios com CTR < 2%
- Budget limitado em [campanha]

META ADS:
🔴 Crítico:
- [N] anúncios com CPA > 3x meta
- Frequency > 4 em [adset]

⚠️ Importante:
- Sem campanha de topo de funil
- [N] criativos com fadiga

═══ AÇÕES EXECUTADAS (automático) ═══
✅ Negativados: [N] termos (economia estimada: R$ XXX/mês)
✅ Pausados: [N] anúncios Meta (CPA > 3x)

═══ AÇÕES PENDENTES (aguardando aprovação) ═══
1. Escalar [adset] (+20% budget) — CPA 40% abaixo da meta
2. Publicar 3 novas headlines em [campanha]
3. Criar Lookalike 1% de compradores

Aprovar? (responda com número ou "todas")

═══ SUGESTÕES DE CRIATIVO ═══
Headlines Google:
1. "Fixador Inox com Laudo Técnico"
2. "Porcelanato em Fachada? Sem Risco"
3. "Direto da Fábrica — Sem Intermediário"

Conceito Meta:
- Vídeo 15s: antes/depois de fachada com fixador inox
- Carrossel: "5 motivos para usar inox em vez de galvanizado"
```

## 7. Quando usar
- Diariamente: rotina automática de otimização
- Ao notar CPA subindo ou conversões caindo
- Semanalmente: revisão profunda com redistribuição
- Ao lançar campanha nova (setup + monitoramento inicial)
- Quando criativos perdem performance (fadiga)
