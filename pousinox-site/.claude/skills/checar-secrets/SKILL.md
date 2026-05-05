---
description: Varrer código por chaves/tokens expostos
---

# Checar Secrets

Varrer código por chaves, tokens ou credenciais expostos antes de commit.

## 1. Buscar padrões suspeitos
Rode as buscas abaixo no código fonte (src/, supabase/):

- Chaves de API: `grep -rn "sk[-_]live\|sk[-_]test\|api[-_]key\s*[:=]\s*['\"]" src/`
- Tokens: `grep -rn "token\s*[:=]\s*['\"][a-zA-Z0-9]" src/`
- Passwords: `grep -rn "password\s*[:=]\s*['\"]" src/`
- URLs com credenciais: `grep -rn "https://.*:.*@" src/`
- Service role keys: `grep -rn "eyJ" src/ --include="*.ts" --include="*.tsx"` (JWTs hardcoded)
- Env vars inline: `grep -rn "SUPABASE_SERVICE_ROLE\|SUPABASE_ANON" src/`

## 2. Verificar .gitignore
- Confirme que `.env`, `.env.local`, `.env.production` estão no `.gitignore`
- Verifique se `supabase/.env` está ignorado

## 3. Verificar .env files
- Liste todos os `.env*` no projeto
- Confirme que NÃO estão tracked: `git ls-files --error-unmatch .env 2>&1`

## 4. Classificar achados
- **CRITICO**: chave real exposta em código — ação imediata
- **AVISO**: referência a variável de ambiente (OK se via import.meta.env)
- **OK**: sem exposição

## 5. Relatório

```
🔐 Checar Secrets — [data]

| Tipo | Arquivo | Linha | Risco | Detalhe |
|---|---|---|---|---|
| API Key | src/lib/x.ts | 42 | CRITICO | Chave hardcoded |
| Env ref | src/lib/supabase.ts | 5 | OK | Via import.meta.env |

.gitignore: ✅/❌
.env tracked: ✅ Não tracked / ❌ EXPOSED

Status: 🟢 Limpo / 🔴 N problemas críticos
```
