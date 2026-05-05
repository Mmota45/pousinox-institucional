---
description: Transcrever áudio/vídeo e extrair action items, resumo e decisões
---

# Transcrever Audio

Transcreva áudios de reuniões, calls comerciais ou treinamentos e extraia informações estruturadas.

## 1. Receber o áudio
Pergunte ao usuário:
- Arquivo de áudio/vídeo (mp3, m4a, wav, mp4, webm)
- Ou URL do YouTube/Google Drive
- Contexto: reunião comercial / call com cliente / treinamento / entrevista?
- Participantes (se souber): nomes e papéis

## 2. Transcrever
- Use a edge function `assistente-arquivo` para processar o áudio
- Se arquivo grande (>25MB), sugira dividir ou usar transcrição via Gemini (suporta áudio longo)
- Para YouTube: usar transcrição automática via `indexar-documento` (já suporta YouTube)

## 3. Estruturar output

### Resumo executivo (3-5 linhas)
- O que foi discutido
- Principais decisões tomadas
- Próximos passos acordados

### Action items
| # | Ação | Responsável | Prazo | Prioridade |
|---|---|---|---|---|
| 1 | ... | ... | ... | Alta/Média/Baixa |

### Decisões tomadas
- [Decisão 1]: contexto e justificativa
- [Decisão 2]: contexto e justificativa

### Pontos em aberto
- [Dúvida/pendência 1]
- [Dúvida/pendência 2]

### Transcrição completa (colapsável)
- Com timestamps a cada 30s-1min
- Identificação de speakers (se possível)
- Formatada em parágrafos legíveis

## 4. Formato de entrega

```
★ TRANSCRIÇÃO — [Contexto] — [Data]
Duração: [X min]
Participantes: [nomes]

═══ RESUMO EXECUTIVO ═══
[3-5 linhas]

═══ ACTION ITEMS ═══
| # | Ação | Responsável | Prazo |
|---|---|---|---|
| 1 | ... | ... | ... |

═══ DECISÕES ═══
1. ...
2. ...

═══ PONTOS EM ABERTO ═══
- ...

═══ TRANSCRIÇÃO COMPLETA ═══
[00:00] ...
[00:30] ...
```

## 5. Integrações sugeridas
- Action items → criar em `followups` (se comercial)
- Decisões de projeto → anotar em `projetos.observacoes`
- Salvar resumo em `knowledge_guias` (se treinamento relevante)
- Gerar email de follow-up → `/copy-vendas`
