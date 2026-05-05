---
description: Revisa a sessão atual — lista mudanças, atualiza CLAUDE.md e memórias, commita
---

# Revisar Sessão

Execute as etapas abaixo em sequência:

## 1. Listar o que foi feito
- Rode `git diff --stat HEAD` e `git log --oneline -5` para ver arquivos modificados e commits recentes
- Categorize por tipo: frontend, edge function, config, banco, memória

## 2. Resumir para o usuário
- Apresente uma tabela markdown com: Arquivo | Mudança
- Separe por categoria (Frontend, Edge Functions, Config, etc.)
- Seja conciso — 1 linha por arquivo

## 3. Atualizar CLAUDE.md
- Verifique se algum módulo novo foi criado ou funcionalidade importante adicionada
- Atualize a tabela de módulos ou seções relevantes do CLAUDE.md
- NÃO adicione detalhes de implementação — apenas funcionalidades visíveis

## 4. Atualizar memórias
- Crie ou atualize memórias em `~/.claude/projects/C--Users-marco-Pousinox-Site/memory/` para informações úteis em futuras sessões
- Remova ou corrija memórias que ficaram desatualizadas
- NÃO salve coisas que podem ser derivadas do código ou git log

## 5. Commit + Push
- `git add` dos arquivos relevantes (NÃO incluir .env, credentials, ou arquivos temp)
- Commit com mensagem descritiva seguindo o padrão do projeto (feat/fix/refactor)
- Pergunte ao usuário se quer push

## 6. Salvar guia (se skill nova foi criada)
- Se alguma skill nova foi criada nessa sessão, inserir guia em `knowledge_guias` via REST API
- Formato: titulo, categoria, nivel, o_que_e, quando_usar, como_fazer, onde_fazer, por_que
