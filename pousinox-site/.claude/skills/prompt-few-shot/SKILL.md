---
description: Montar prompts com exemplos para consistência
---

# Prompt Few-Shot

Crie um prompt com exemplos (few-shot) para tarefas que precisam de consistência.

## 1. Entender a tarefa
- Qual a entrada? (texto, dados, pergunta)
- Qual a saída esperada? (classificação, extração, transformação)
- Há padrões que a IA precisa seguir?

## 2. Coletar exemplos
- Peça ao usuário 2-3 exemplos reais de entrada → saída
- Se não tiver, gere exemplos representativos baseados no domínio

## 3. Estruturar

```
TAREFA: [descrição clara]

EXEMPLOS:

Entrada: [exemplo 1 entrada]
Saída: [exemplo 1 saída]

Entrada: [exemplo 2 entrada]
Saída: [exemplo 2 saída]

Entrada: [exemplo 3 entrada]
Saída: [exemplo 3 saída]

Agora processe:
Entrada: {input}
Saída:
```

## 4. Boas práticas
- Exemplos devem cobrir casos diferentes (fácil, médio, edge case)
- Manter formato consistente entre exemplos
- Incluir um exemplo negativo se relevante ("quando NÃO classificar como X")
- Ordenar do mais simples ao mais complexo

## 5. Testar
- Rode o prompt com 3 entradas novas via `/admin/ia` ou Studio
- Verifique se as saídas seguem o padrão dos exemplos
- Ajuste exemplos se necessário

## 6. Entregar
Apresente o prompt com:
- N exemplos incluídos
- Casos cobertos
- Provider recomendado
- Sugestão de temperatura (0.0-0.3 para consistência, 0.7+ para criatividade)
