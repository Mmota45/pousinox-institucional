---
description: Detecta bugs de UI/runtime em qualquer componente — JSX em strings, classes CSS ausentes, imports não usados, props inválidas
---

# Audit UI

Analisa componentes React (.tsx) em busca de bugs que o TypeScript NÃO detecta — problemas de runtime que só aparecem no browser. Funciona em páginas admin, páginas públicas e componentes reutilizáveis.

## Argumentos

- **Arquivo(s):** caminho(s) dos arquivos .tsx a auditar. Se omitido, audita todos os arquivos `.tsx` em `src/pages/` e `src/components/` modificados no último commit ou com mudanças não commitadas.
- **Escopo:** `admin` (só Admin*.tsx), `site` (só páginas públicas), `components` (só src/components), ou `all` (tudo). Default: `all`.

## 1. JSX em string literals (CRÍTICO)

Buscar padrões onde componentes JSX estão dentro de aspas/template literals em vez de fragments:

```
# Padrões problemáticos — renderizam como texto literal
'<ComponentName size={14} /> texto'
`<ComponentName /> texto`
"<ComponentName />"

# Padrão correto
<><ComponentName size={14} /> texto</>
```

**Como detectar:**
- `grep -nP "'<[A-Z][a-zA-Z]+ " arquivo.tsx` — JSX em aspas simples
- `grep -nP '"<[A-Z][a-zA-Z]+ ' arquivo.tsx` — JSX em aspas duplas  
- `grep -nP "'\<[A-Z]" arquivo.tsx` — início de componente em string

**Causa comum:** `replace_all` em editor substituindo emoji por Lucide dentro de ternários como `{cond ? 'texto' : 'texto'}`, que vira `{cond ? '<Icon /> texto' : '<Icon /> texto'}` em vez de `{cond ? <><Icon /> texto</> : <><Icon /> texto</>}`.

## 2. Classes CSS inexistentes

Para cada `className={styles.xxx}` no TSX:
- Verificar se `.xxx` existe no CSS Module correspondente
- Listar classes referenciadas mas não definidas

**Como detectar:**
```bash
# Extrair classes usadas no TSX
grep -oP 'styles\.(\w+)' arquivo.tsx | sort -u

# Extrair classes definidas no CSS
grep -oP '\.(\w+)' arquivo.module.css | sort -u

# Diff = classes ausentes
```

## 3. Imports não usados

Verificar se cada import nomeado de `lucide-react` ou outros pacotes é realmente usado no JSX/código:

```bash
# Para cada símbolo importado, verificar se aparece fora da linha de import
```

## 4. Emojis residuais em botões/labels

Buscar emojis que deveriam ter sido substituídos por ícones Lucide:

```bash
# Emojis comuns em UI que devem ser ícones
grep -nP '[\x{1F300}-\x{1F9FF}]' arquivo.tsx
```

Exceções permitidas: emojis em strings de mensagem (`showMsg`, `alert`), comentários, e dados estáticos.

## 5. className="xxx" em CSS Modules

Detectar `className="xxx"` (string literal) quando o componente usa CSS Modules — deveria ser `className={styles.xxx}`:

```bash
grep -nP 'className="(?!spin|sr-only)' arquivo.tsx
```

Exceções: classes globais conhecidas (`spin`, `sr-only`, `leaflet-*`).

## 6. Resumo

Apresentar tabela:

| Verificação | Status | Detalhes |
|---|---|---|
| JSX em strings | ✅/🔴 | N instâncias em M arquivos |
| Classes CSS ausentes | ✅/⚠️ | N classes não encontradas |
| Imports não usados | ✅/⚠️ | N imports órfãos |
| Emojis residuais | ✅/⚠️ | N emojis em M arquivos |
| className literal | ✅/⚠️ | N instâncias |

Se há 🔴: "CRÍTICO — bugs visíveis no browser, corrigir imediatamente"
Se só ⚠️: "Avisos — não quebram mas devem ser limpos"
Se tudo ✅: "Módulo(s) limpo(s)"
