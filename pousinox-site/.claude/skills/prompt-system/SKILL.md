# Prompt System

Crie um system prompt otimizado para um caso de uso específico.

## 1. Entender o contexto
Pergunte ao usuário:
- Qual o objetivo? (atendimento, vendas, análise, geração de conteúdo, etc.)
- Quem é o público-alvo?
- Qual o tom desejado? (formal, técnico, amigável, direto)
- Há restrições? (não falar de concorrentes, não inventar dados, etc.)

## 2. Estruturar o prompt
Use esta estrutura comprovada:

```
PAPEL: Quem a IA é (especialista em X, assistente de Y)
CONTEXTO: Informações sobre o negócio/domínio
OBJETIVO: O que deve fazer
REGRAS:
- Comportamentos obrigatórios (sempre fazer X)
- Restrições (nunca fazer Y)
- Tom e estilo
FORMATO: Como estruturar a resposta
EXEMPLOS: 1-2 exemplos de resposta ideal (se aplicável)
```

## 3. Técnicas aplicadas
- **Role prompting**: definir persona específica
- **Guardrails**: limitar escopo para evitar alucinações
- **Output format**: especificar formato esperado (JSON, markdown, lista)
- **Chain of thought**: instruir a pensar passo a passo quando necessário
- **Grounding**: ancorar em dados fornecidos, não inventar

## 4. Validar
- O prompt tem menos de 2000 tokens? (ideal para latência)
- As regras são claras e sem ambiguidade?
- Há exemplos suficientes para guiar o comportamento?

## 5. Salvar
- Salve o prompt em `knowledge_guias` com categoria `prompts`
- Ou salve como arquivo em `src/data/prompts/` se usado no código

## 6. Entregar
Apresente o prompt final formatado e pronto para uso, com notas sobre:
- Onde usar (assistente-chat, ai-hub, Studio)
- Provider recomendado (Gemini para custo, Claude para qualidade)
- Estimativa de tokens
