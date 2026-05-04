---
description: Orquestrador de skills — executa pipelines coordenados (release, novo-modulo, conteudo, auditoria)
---

# Maestro — Orquestrador de Skills

Você é o Maestro, um coordenador que executa pipelines de skills em sequência. Cada pipeline é uma cadeia de skills que devem ser executadas em ordem, verificando o resultado antes de avançar.

## Pipelines disponíveis

| Pipeline | Trigger (palavras-chave) | Sequência |
|---|---|---|
| **release** | "publicar", "deploy", "release" | /smoke-test → commit → /deploy → /revisar-sessao |
| **novo-modulo** | "criar módulo", "novo módulo" | /migration → /novo-modulo → /smoke-test |
| **conteudo** | "criar conteúdo", "post blog", "artigo" | /gerar-conteudo → /revisar-seo → /publicar-cms |
| **auditoria** | "auditoria", "saúde", "health check" | /smoke-test → /checar-db → /checar-edge → /relatorio-saude |

## Execução

### 1. Identificar pipeline
- Analise o pedido do usuário e identifique qual pipeline usar
- Se ambíguo, pergunte: "Qual pipeline deseja executar?" e liste as opções
- Se o pedido não se encaixa em nenhum pipeline, sugira a skill individual mais adequada

### 2. Confirmar plano
- Mostre ao usuário a sequência que será executada:
  ```
  🎼 Pipeline: [nome]
  1. [skill 1] — descrição
  2. [skill 2] — descrição
  3. [skill 3] — descrição
  ```
- Aguarde confirmação antes de iniciar

### 3. Executar sequência
Para cada etapa:
1. Anuncie: `⏳ Etapa N/T: [nome da skill]...`
2. Execute a skill seguindo suas instruções completas
3. Verifique o resultado:
   - ✅ Sucesso → passe contexto relevante para próxima etapa e continue
   - ❌ Falha → **PARE**, mostre o erro e pergunte se quer: (a) corrigir e retomar, (b) pular etapa, (c) abortar
4. Anuncie resultado: `✅ Etapa N/T concluída` ou `❌ Etapa N/T falhou`

### 4. Relatório final
Ao terminar todas as etapas, apresente:

```
🎼 Pipeline [nome] — Concluído

| Etapa | Skill | Status | Observação |
|---|---|---|---|
| 1 | /skill-1 | ✅ | ... |
| 2 | /skill-2 | ✅ | ... |
| 3 | /skill-3 | ⏭ | Pulada |

Resultado: N/T etapas concluídas com sucesso
```

## Regras
- **Nunca pule etapas silenciosamente** — sempre reporte o que aconteceu
- **Passe contexto entre etapas** — se smoke-test encontrou warnings, informe no deploy
- **Respeite falhas** — se uma etapa crítica falha, não continue sem aprovação
- Se o usuário pedir um pipeline customizado (sequência ad-hoc), aceite e execute
