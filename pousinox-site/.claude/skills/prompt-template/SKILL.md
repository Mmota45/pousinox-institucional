---
description: Criar templates de prompt reutilizáveis com variáveis
---

# Prompt Template

Crie um template de prompt reutilizável com variáveis dinâmicas.

## 1. Entender o uso
- Qual tarefa será repetida? (email, análise, resposta, classificação)
- Quais partes mudam a cada uso? (nome, dados, contexto)
- Quais partes são fixas? (tom, regras, formato)

## 2. Identificar variáveis
Mapeie cada campo dinâmico:

```
{nome_cliente} — nome do prospect/cliente
{segmento} — segmento de atuação
{dados} — dados do banco para contexto
{historico} — interações anteriores
{objetivo} — o que se quer alcançar
```

## 3. Criar template

```typescript
const template = {
  nome: 'nome-descritivo',
  descricao: 'Para que serve este template',
  categoria: 'vendas | suporte | analise | conteudo',
  variaveis: ['nome_cliente', 'segmento', 'dados'],
  system: `Você é um especialista em {categoria}.
Contexto do cliente: {dados}
Objetivo: {objetivo}`,
  prompt: `Analise o seguinte sobre {nome_cliente} do segmento {segmento}:
{dados}

Responda em formato:
1. Diagnóstico
2. Recomendações
3. Próximos passos`,
}
```

## 4. Validar template
- Preencha com dados reais e teste
- Verifique se funciona com valores vazios (graceful fallback)
- Teste com valores extremos (texto muito longo, caracteres especiais)

## 5. Salvar
Opções de armazenamento:
- `knowledge_guias` com categoria `templates` — pesquisável pelo Assistente
- `src/data/prompts/templates.ts` — se usado programaticamente no código

## 6. Entregar
Apresente:
- Template completo com variáveis destacadas
- Exemplo preenchido com dados reais
- Instrução de uso (onde chamar, como preencher variáveis)
- Provider recomendado e temperatura
