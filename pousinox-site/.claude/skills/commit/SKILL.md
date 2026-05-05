# Commit

Crie um commit padronizado com mensagem estruturada.

## 1. Analisar mudanças
- Rode `git status` e `git diff --stat`
- Identifique os arquivos modificados e agrupe por tipo (feat, fix, refactor, docs, chore)

## 2. Classificar
- **feat:** nova funcionalidade
- **fix:** correção de bug
- **refactor:** reestruturação sem mudança de comportamento
- **chore:** manutenção, limpeza, configs
- **style:** formatação, CSS
- **perf:** melhoria de performance

## 3. Gerar mensagem
Formato: `tipo: descrição curta (max 72 chars)`

Corpo (se necessário):
- O que mudou e por que
- Arquivos principais afetados

## 4. Executar
- Stage dos arquivos relevantes (NÃO usar `git add -A` — listar arquivos específicos)
- NÃO incluir `.env`, credenciais ou arquivos sensíveis
- Criar o commit com Co-Authored-By

## 5. Confirmar
- Rode `git log --oneline -1` para confirmar
- Reporte o hash e a mensagem
