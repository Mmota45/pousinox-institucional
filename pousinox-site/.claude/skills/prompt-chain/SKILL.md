---
description: Desenhar pipelines multi-step de prompts
---

# Prompt Chain

Monte uma cadeia de prompts (pipeline) onde a saída de um alimenta o próximo.

## 1. Entender o fluxo
- Qual o objetivo final? (relatório, análise, conteúdo, decisão)
- Quais etapas intermediárias são necessárias?
- Alguma etapa precisa de provider/modelo diferente?

## 2. Desenhar a cadeia
Mapeie cada step:

```
Step 1: [Extrair] → input bruto → dados estruturados
Step 2: [Analisar] → dados → insights
Step 3: [Gerar] → insights → output final
```

## 3. Criar prompts por step
Para cada step, defina:
- System prompt específico
- Formato de saída (JSON para steps intermediários, texto para final)
- Provider/modelo recomendado
- Critério de parada (quando abortar a cadeia)

## 4. Implementar
Use `aiPipeline()` do `aiHelper.ts`:

```typescript
const resultado = await aiPipeline(inputInicial, [
  { target: { provider: 'gemini', model: 'gemini-2.0-flash' }, system: 'Step 1: ...' },
  { target: { provider: 'gemini', model: 'gemini-2.0-flash' }, system: 'Step 2: ...' },
  { target: { provider: 'groq', model: 'llama-3.3-70b-versatile' }, system: 'Step 3: ...' },
])
```

Ou use `aiReviewer()` para padrão gerador+revisor:

```typescript
const { main, review } = await aiReviewer(prompt, mainTarget, reviewerTarget, system)
```

## 5. Otimizações
- Steps de extração/classificação → modelo rápido (Gemini Flash, Groq)
- Steps de geração criativa → modelo capaz (Claude, GPT-4)
- Steps de validação → modelo diferente do gerador (evita viés)
- Formato JSON entre steps para parsing confiável

## 6. Entregar
Apresente:
- Diagrama da cadeia (Step 1 → Step 2 → ...)
- Prompt de cada step
- Código pronto para copiar
- Estimativa de custo/latência total
