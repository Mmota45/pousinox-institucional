---
description: Analisar métricas de campanha (GA4/Meta) e sugerir otimizações de budget e criativo
---

# Otimizar Campanha

Analise métricas de campanhas ativas e gere recomendações de otimização.

## 1. Coletar dados
Pergunte ao usuário:
- Plataforma: Meta Ads / Google Ads / ambos?
- Período: últimos 7d / 14d / 30d?
- Peça para colar as métricas ou screenshot

Se disponível via GA4 (AdminAnalytics), busque automaticamente:
- Sessões, usuários, taxa de rejeição
- Conversões (leads, WhatsApp clicks)
- Fontes de tráfego (paid vs organic)

### Métricas essenciais para análise
| Métrica | Meta Ads | Google Ads |
|---|---|---|
| Custo | CPM, CPC, CPA | CPC, CPA |
| Engajamento | CTR, Hook rate (3s) | CTR, Quality Score |
| Conversão | Leads, ROAS | Conversões, Conv. Rate |
| Audiência | Frequência, Alcance | Impression Share |

## 2. Diagnosticar

### Sinais de problema
- **CTR < 1%** → Criativo fraco ou público errado
- **CPC > R$3** (B2B industrial) → Segmentação muito restrita ou concorrência alta
- **CPM > R$30** → Audiência saturada ou qualidade baixa
- **Frequência > 3** → Fadiga de criativo, precisa renovar
- **Hook rate < 25%** (vídeo) → Primeiros 3s fracos
- **Taxa rejeição > 70%** → Landing page desalinhada com anúncio
- **Conv. rate < 2%** → Oferta fraca ou fricção no formulário

### Benchmarks Pousinox (B2B industrial)
- CTR Meta: 0.8-2.0%
- CPC Meta: R$1.50-4.00
- CPL (custo por lead): R$15-50
- Taxa conversão LP: 3-8%
- ROAS mínimo viável: 3x

## 3. Recomendar ações

### Por diagnóstico
| Problema | Ação | Prioridade |
|---|---|---|
| CTR baixo | Testar novos criativos (3+ variações) | Alta |
| CPC alto | Ampliar audiência (broad) ou negativar irrelevantes | Alta |
| Frequência alta | Renovar criativos, expandir público | Média |
| Conv. baixa | Revisar LP, simplificar form, testar CTA | Alta |
| CPM alto | Testar horários diferentes, reduzir overlap | Média |

### Budget
- **Regra 70/20/10:** 70% no que funciona, 20% testando, 10% experimental
- **Kill rule:** Pausar ad set sem conversão após 2x CPA target em gasto
- **Scale rule:** Aumentar 20% budget a cada 3 dias se CPA estável

## 4. Plano de ação

```
★ OTIMIZAÇÃO — [Plataforma] — [Período]

DIAGNÓSTICO
| Métrica | Valor | Benchmark | Status |
|---|---|---|---|
| CTR | X% | 0.8-2.0% | ✅/⚠/✗ |
| CPC | R$X | R$1.50-4.00 | ✅/⚠/✗ |
| CPL | R$X | R$15-50 | ✅/⚠/✗ |
| Frequência | X | < 3 | ✅/⚠/✗ |

AÇÕES RECOMENDADAS (por prioridade)
1. [ALTA] ...
2. [ALTA] ...
3. [MÉDIA] ...

BUDGET
- Realocar: [de onde] → [para onde]
- Pausar: [campaigns/ad sets com baixa performance]
- Escalar: [campaigns com bom CPA]

CRIATIVOS
- Manter: [top performers]
- Pausar: [fadiga/baixo CTR]
- Criar: [N novos com ângulos X, Y, Z] → usar /meta-ads

PRÓXIMA REVISÃO: [data — 3-7 dias]
```

## 5. Integração com outras skills
- Performance ruim nos criativos? → Sugerir `/meta-ads` para novos kits
- Copy fraca na LP? → Sugerir `/copy-vendas` para reescrever
- SEO orgânico complementar? → Sugerir `/radar-seo`
