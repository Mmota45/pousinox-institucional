---
description: Validação rápida — typecheck, build, imports, console.logs
---

# Smoke Test

Execute todas as verificações e reporte um resumo consolidado.

## 1. Typecheck
- Rode `npm run typecheck`
- Conte erros por arquivo
- Se passou, marque ✅

## 2. Build
- Rode `npm run build`
- Se falhou, liste os erros
- Se passou, marque ✅ e reporte tamanho do bundle (linhas de output do Vite)

## 3. Console.logs em código commitado
- Rode `git grep -c "console\.\(log\|debug\|warn\)" -- "src/**/*.ts" "src/**/*.tsx"` (ignora node_modules)
- Reporte como warning (⚠️) com contagem por arquivo
- Ignore arquivos de teste

## 4. Resumo
Apresente tabela:

| Verificação | Status | Detalhes |
|---|---|---|
| Typecheck | ✅/❌ | N erros |
| Build | ✅/❌ | tamanho bundle |
| Console.logs | ⚠️/✅ | N ocorrências em M arquivos |

Se tudo OK: "🟢 Projeto saudável — pronto para deploy"
Se há erros: "🔴 N problemas encontrados — corrigir antes de deploy"
