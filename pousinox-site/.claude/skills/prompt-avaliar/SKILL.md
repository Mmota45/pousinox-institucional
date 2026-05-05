---
description: Avaliar qualidade de prompt existente e sugerir melhorias
---

# Prompt Avaliar

Avalie a qualidade de um prompt existente e sugira melhorias.

## 1. Receber o prompt
- Peça ao usuário o prompt a avaliar
- Ou busque em `knowledge_guias` categoria `prompts`
- Ou leia do código fonte (system prompts em edge functions)

## 2. Checklist de qualidade

### Clareza (0-10)
- [ ] Objetivo explícito? A IA sabe exatamente o que fazer?
- [ ] Sem ambiguidades? Cada instrução tem uma única interpretação?
- [ ] Linguagem direta? Sem rodeios ou instruções contraditórias?

### Estrutura (0-10)
- [ ] Papel definido? (role prompting)
- [ ] Contexto suficiente? A IA tem informação para responder bem?
- [ ] Formato de saída especificado?
- [ ] Seções organizadas logicamente?

### Guardrails (0-10)
- [ ] Restrições claras? (o que NÃO fazer)
- [ ] Proteção contra alucinação? ("se não souber, diga que não sabe")
- [ ] Escopo limitado? (não tenta fazer tudo)
- [ ] Tratamento de edge cases?

### Eficiência (0-10)
- [ ] Tamanho adequado? (sem repetição, sem filler)
- [ ] Exemplos necessários incluídos?
- [ ] Poderia ser mais curto sem perder qualidade?

### Domínio (0-10)
- [ ] Vocabulário correto para o domínio?
- [ ] Dados de contexto relevantes incluídos?
- [ ] Tom adequado ao público?

## 3. Diagnóstico
Identifique:
- **Pontos fortes**: o que funciona bem
- **Fraquezas**: o que pode falhar
- **Riscos**: onde a IA pode alucinar ou fugir do escopo

## 4. Relatório

```
📝 Avaliação de Prompt

| Critério | Nota | Observação |
|---|---|---|
| Clareza | X/10 | ... |
| Estrutura | X/10 | ... |
| Guardrails | X/10 | ... |
| Eficiência | X/10 | ... |
| Domínio | X/10 | ... |

Score total: XX/50

Melhorias sugeridas:
1. [prioridade alta] ...
2. [prioridade média] ...
3. [prioridade baixa] ...
```

## 5. Reescrever
- Apresente versão melhorada do prompt
- Destaque as mudanças com comentários
- Estime melhoria esperada
