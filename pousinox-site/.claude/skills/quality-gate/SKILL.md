---
description: Quality Gates automáticos (Ratchet) — baseline de métricas, bloqueio de regressão e loop de auto-correção
---

# Quality Gate

Sistema de "catraca" que congela métricas de qualidade e impede regressão. O código só pode melhorar ou empatar — nunca piorar.

## Conceito

```
BASELINE (estado atual)
    │
    ▼  PR submete mudanças
┌─────────────────────────┐
│ QUALITY GATE             │
│ Compara: novo vs base    │
│                         │
│ ✅ Melhorou ou empatou  │──→ PR aprovado (merge)
│ ❌ Piorou               │──→ PR bloqueado (agente corrige)
└─────────────────────────┘
```

Princípio: o humano não revisa 10.000 linhas — a catraca revisa automaticamente.

## 1. Métricas rastreadas

| Métrica | Ferramenta | Direção | Tolerância |
|---|---|---|---|
| Erros TypeScript | `tsc --noEmit` | Só diminui | 0 (zero tolerance) |
| Warnings ESLint | `eslint --format json` | Só diminui | 0 novos |
| Console.logs | `git grep console.log` | Só diminui | 0 novos em src/ |
| Cobertura de testes | `vitest --coverage` | Só sobe | -0.5% max |
| Duplicação de código | `jscpd --reporters json` | Só diminui | 0 novos blocos |
| Tamanho do bundle | `vite build` (output) | Só diminui | +5% max |
| Arquivos > 500 linhas | `wc -l` | Só diminui | 0 novos |
| TODO/FIXME | `git grep` | Só diminui | 0 novos |

## 2. Gerar baseline

### Script: `scripts/baseline.sh`
```bash
#!/bin/bash
# Gera baseline.json com estado atual das métricas

echo "Gerando baseline de qualidade..."

# TypeScript errors
TS_ERRORS=$(npx tsc --noEmit 2>&1 | grep "error TS" | wc -l)

# ESLint warnings
LINT_WARNINGS=$(npx eslint src/ --format json 2>/dev/null | node -e "
  const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  console.log(data.reduce((acc,f) => acc + f.warningCount, 0))
" 2>/dev/null || echo "0")

# Console.logs
CONSOLE_LOGS=$(git grep -c "console\.\(log\|debug\|warn\)" -- "src/**/*.ts" "src/**/*.tsx" 2>/dev/null | awk -F: '{sum+=$2} END {print sum+0}')

# Bundle size (KB)
npm run build 2>/dev/null
BUNDLE_SIZE=$(du -sk dist/ 2>/dev/null | cut -f1 || echo "0")

# Arquivos grandes (>500 linhas)
BIG_FILES=$(find src/ -name "*.tsx" -o -name "*.ts" | xargs wc -l 2>/dev/null | grep -v total | awk '$1 > 500 {count++} END {print count+0}')

# TODOs
TODOS=$(git grep -c "TODO\|FIXME\|HACK\|XXX" -- "src/**/*.ts" "src/**/*.tsx" 2>/dev/null | awk -F: '{sum+=$2} END {print sum+0}')

# Duplicação (se jscpd instalado)
DUPLICATES=$(npx jscpd src/ --reporters json --output .jscpd/ 2>/dev/null && node -e "
  const r = JSON.parse(require('fs').readFileSync('.jscpd/jscpd-report.json','utf8'));
  console.log(r.statistics.total.duplicatedLines || 0)
" 2>/dev/null || echo "0")

# Gerar JSON
cat > baseline.json << EOF
{
  "generated_at": "$(date -Iseconds)",
  "metrics": {
    "ts_errors": $TS_ERRORS,
    "lint_warnings": $LINT_WARNINGS,
    "console_logs": $CONSOLE_LOGS,
    "bundle_size_kb": $BUNDLE_SIZE,
    "big_files": $BIG_FILES,
    "todos": $TODOS,
    "duplicated_lines": $DUPLICATES
  }
}
EOF

echo "✅ Baseline salvo em baseline.json"
cat baseline.json
```

### Executar pela primeira vez
```bash
chmod +x scripts/baseline.sh
./scripts/baseline.sh
git add baseline.json
git commit -m "chore: congelar baseline de qualidade"
```

## 3. Script de comparação (Quality Gate)

### `scripts/quality-gate.sh`
```bash
#!/bin/bash
# Compara métricas atuais com baseline — falha se piorou

set -e

if [ ! -f baseline.json ]; then
  echo "❌ baseline.json não encontrado. Rode scripts/baseline.sh primeiro."
  exit 1
fi

echo "🔍 Executando Quality Gate..."

# Coletar métricas atuais (mesma lógica do baseline)
TS_ERRORS=$(npx tsc --noEmit 2>&1 | grep "error TS" | wc -l)
CONSOLE_LOGS=$(git grep -c "console\.\(log\|debug\|warn\)" -- "src/**/*.ts" "src/**/*.tsx" 2>/dev/null | awk -F: '{sum+=$2} END {print sum+0}')
BIG_FILES=$(find src/ -name "*.tsx" -o -name "*.ts" | xargs wc -l 2>/dev/null | grep -v total | awk '$1 > 500 {count++} END {print count+0}')
TODOS=$(git grep -c "TODO\|FIXME\|HACK\|XXX" -- "src/**/*.ts" "src/**/*.tsx" 2>/dev/null | awk -F: '{sum+=$2} END {print sum+0}')

# Ler baseline
BASE_TS=$(node -e "console.log(JSON.parse(require('fs').readFileSync('baseline.json','utf8')).metrics.ts_errors)")
BASE_CONSOLE=$(node -e "console.log(JSON.parse(require('fs').readFileSync('baseline.json','utf8')).metrics.console_logs)")
BASE_BIG=$(node -e "console.log(JSON.parse(require('fs').readFileSync('baseline.json','utf8')).metrics.big_files)")
BASE_TODOS=$(node -e "console.log(JSON.parse(require('fs').readFileSync('baseline.json','utf8')).metrics.todos)")

# Comparar
FAILED=0
REPORT=""

check_metric() {
  local name=$1 current=$2 baseline=$3
  if [ "$current" -gt "$baseline" ]; then
    REPORT="$REPORT\n❌ $name: $baseline → $current (+$((current - baseline)))"
    FAILED=1
  elif [ "$current" -lt "$baseline" ]; then
    REPORT="$REPORT\n✅ $name: $baseline → $current (melhorou!)"
  else
    REPORT="$REPORT\n✅ $name: $current (manteve)"
  fi
}

check_metric "TypeScript errors" $TS_ERRORS $BASE_TS
check_metric "Console.logs" $CONSOLE_LOGS $BASE_CONSOLE
check_metric "Arquivos >500 linhas" $BIG_FILES $BASE_BIG
check_metric "TODOs/FIXMEs" $TODOS $BASE_TODOS

echo ""
echo "═══ QUALITY GATE REPORT ═══"
echo -e "$REPORT"
echo ""

if [ $FAILED -eq 1 ]; then
  echo "🔴 QUALITY GATE FALHOU — PR bloqueado"
  echo "Corrija as regressões antes de fazer merge."
  exit 1
else
  echo "🟢 QUALITY GATE PASSOU — Código manteve ou melhorou qualidade"
  
  # Atualizar baseline se melhorou
  if echo -e "$REPORT" | grep -q "melhorou"; then
    echo "📈 Atualizando baseline com novas métricas..."
    ./scripts/baseline.sh
  fi
  
  exit 0
fi
```

## 4. Integração com CI (GitHub Actions)

### `.github/workflows/quality-gate.yml`
```yaml
name: Quality Gate

on:
  pull_request:
    branches: [main, preview]

jobs:
  quality-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      
      - run: npm ci
      - run: chmod +x scripts/quality-gate.sh
      - run: ./scripts/quality-gate.sh
      
      - name: Comment PR on failure
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## 🔴 Quality Gate Failed\n\nEste PR piorou métricas de qualidade. Corrija antes de merge.\n\nRode \`./scripts/quality-gate.sh\` localmente para ver detalhes.`
            })
```

## 5. Loop de auto-correção (agente)

### Quando o gate falha no PR:
```
1. CI reporta falha no PR (comment automático)
2. Agente (routine ou Claude Code) detecta falha
3. Agente lê o relatório do gate
4. Para cada métrica que piorou:
   - ts_errors: roda typecheck, corrige erros
   - console_logs: remove console.logs novos
   - big_files: refatora arquivo (extrai componentes)
   - todos: resolve ou remove TODOs
5. Commit fix
6. CI re-roda quality gate
7. Se passou: merge automático (se configurado)
8. Se falhou de novo: loop (max 3 tentativas)
9. Se falhou 3x: notifica humano
```

### Implementação via Routine
```yaml
trigger: github PR check failed
action:
  1. Ler comentário do Quality Gate
  2. Identificar métricas que pioraram
  3. Para cada:
     - Localizar arquivos afetados
     - Aplicar correção mínima
     - Commitar com msg "fix: quality gate — [métrica]"
  4. Push → CI re-executa
  5. Se falhou novamente → notificar Marco
```

## 6. Atualização do baseline

### Quando atualizar
- ✅ Automaticamente quando métricas MELHORAM (catraca sobe)
- ✅ Manualmente após refactor planejado que piora temporariamente
- ❌ NUNCA para "acomodar" código pior

### Reset manual (com justificativa)
```bash
# Só quando há razão legítima (ex: migração de lib que adiciona warnings temporários)
./scripts/baseline.sh
git add baseline.json
git commit -m "chore: reset baseline — motivo: [justificativa]"
```

## 7. Integração com skills existentes

```
/smoke-test (verificação rápida)
    ↓ se passou
/quality-gate (verificação profunda — baseline)
    ↓ se passou
/deploy (publicação)

/routines (PR review)
    ↓ se gate falhou
Loop de auto-correção (agente corrige)
    ↓ se corrigiu
Merge automático
```

### Adicionar ao `/smoke-test`
O smoke-test pode chamar o quality gate como etapa adicional:
```
| Verificação | Status | Detalhes |
|---|---|---|
| Typecheck | ✅/❌ | N erros |
| Build | ✅/❌ | tamanho bundle |
| Console.logs | ⚠️/✅ | N ocorrências |
| Quality Gate | ✅/❌ | N métricas pioraram |
```

## 8. Formato de entrega

```
★ QUALITY GATE — [contexto]

═══ BASELINE ATUAL ═══
| Métrica | Valor | Última atualização |
|---|---|---|
| TS errors | N | [data] |
| Console.logs | N | [data] |
| Bundle size | NNN KB | [data] |
| Big files | N | [data] |
| TODOs | N | [data] |

═══ ESTADO ATUAL ═══
| Métrica | Baseline | Atual | Status |
|---|---|---|---|
| TS errors | N | N | ✅/❌ |
| Console.logs | N | N | ✅/❌ |
| ... | ... | ... | ... |

═══ RESULTADO ═══
🟢 PASSOU — N métricas melhoraram, N mantiveram
🔴 FALHOU — N métricas pioraram (lista)

═══ AÇÕES ═══
- [correção necessária 1]
- [correção necessária 2]
```

## 9. Quando usar
- Ao congelar baseline pela primeira vez (setup)
- Antes de todo merge/deploy (automático via CI)
- Ao revisar PR grande (>200 linhas)
- Mensalmente: verificar evolução das métricas
- Ao adicionar nova métrica ao gate
