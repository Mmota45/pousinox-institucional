---
description: Comprimir CLAUDE.md, prompts e contexto para economizar tokens (até 75%)
---

# Compress

Otimize arquivos de contexto (CLAUDE.md, prompts, skills) para reduzir consumo de tokens sem perder informação essencial.

## 1. Identificar alvo
- **CLAUDE.md** — arquivo principal de contexto (carregado em toda mensagem)
- **Skills** — prompts longos que podem ser condensados
- **System prompts** — edge functions com instruções verbosas
- **Memórias** — MEMORY.md e arquivos de memória

## 2. Técnicas de compressão

### Nível 1 — Limpeza (economia ~20%)
- Remover linhas em branco duplicadas
- Remover comentários óbvios ("Este módulo faz X" quando o título já diz)
- Abreviar descrições redundantes
- Unificar tabelas com colunas similares

### Nível 2 — Condensação (economia ~40%)
- Converter parágrafos em bullets de 1 linha
- Tabelas: remover colunas com info derivável
- Substituir descrições longas por notação compacta
- Agrupar itens similares (ex: "Módulos existentes" → só listar novos/diferentes)
- Eliminar exemplos quando a regra é suficiente

### Nível 3 — Telegráfico (economia ~60-75%)
- Notação de referência: `AdminProjetos → CRUD+PDF+IA+recorrências+similaridade`
- Abreviações consistentes: `EF=Edge Function, SB=Supabase, RLS=Row Level Security`
- Remover seções inteiras que podem ser derivadas do código
- Manter apenas: decisões não-óbvias, convenções especiais, gotchas

## 3. Regras de compressão

### MANTER (nunca remover)
- Convenções que não são deriváveis do código
- Gotchas e armadilhas (ex: ".order() com coluna inexistente retorna null")
- Decisões de arquitetura (por que X e não Y)
- Comandos (npm run X)
- Permissões e segurança (RLS, service_role)

### REMOVER (derivável do código)
- Listas de arquivos que `ls` ou `glob` resolvem
- Detalhes de implementação que `grep` encontra
- Histórico de mudanças (git log tem isso)
- Descrições de UI (é só abrir o componente)

### CONDENSAR (manter essência, cortar verbosidade)
- Tabela de módulos: nome + 3-5 palavras-chave em vez de descrição longa
- Migrations: apenas nome do arquivo (conteúdo está no arquivo)
- Integrações: "A → B via C" em vez de parágrafo explicando

## 4. Executar

### Para CLAUDE.md
1. Ler arquivo completo
2. Medir tokens (estimativa: palavras × 1.3)
3. Aplicar nível de compressão solicitado
4. Reescrever mantendo mesma estrutura de seções
5. Medir tokens novos
6. Mostrar diff de tamanho

### Para Skills
1. Identificar skills com >150 linhas
2. Condensar sem perder funcionalidade
3. Manter frontmatter e estrutura de steps

### Para System Prompts (edge functions)
1. Listar prompts em `supabase/functions/*/index.ts`
2. Identificar instruções verbosas
3. Sugerir versão comprimida

## 5. Formato de entrega

```
★ COMPRESS — [Alvo]

Antes: [N] linhas / ~[X]k tokens
Depois: [N] linhas / ~[X]k tokens
Economia: [X]% ([N] tokens salvos por mensagem)

Custo mensal estimado salvo: ~$[X] (baseado em [N] msgs/dia)

Alterações:
- [Seção X]: removida (derivável do código)
- [Seção Y]: condensada de 40→12 linhas
- [Seção Z]: mantida (contém decisões)

Aplicar? (s/n)
```

## 6. Glossário de abreviações (se nível 3)

Se aplicar nível telegráfico, adicionar glossário no topo do arquivo:
```
## Abreviações
SB=Supabase, EF=Edge Function, RLS=Row Level Security,
FE=Frontend, BE=Backend, LP=Landing Page, WA=WhatsApp,
CTA=Call to Action, SEO=Search Engine Optimization
```

## 7. Validação
Após comprimir:
- [ ] Claude ainda entende o contexto? (testar com pergunta sobre o projeto)
- [ ] Nenhuma convenção importante foi perdida?
- [ ] Comandos essenciais ainda estão presentes?
- [ ] Informações de segurança preservadas?
