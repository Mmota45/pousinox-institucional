#!/usr/bin/env bash
# deploy.sh — Build e publica o site Pousinox no GitHub Pages
# Uso: bash scripts/deploy.sh  (a partir de qualquer diretório)

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE_DIR="$REPO_ROOT/pousinox-site"
DIST_DIR="$SITE_DIR/dist"
WORKTREE_DIR="$REPO_ROOT/.gh-pages-deploy"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║      POUSINOX — Deploy Script        ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── 1. Lint ───────────────────────────────────────────────────────────────────
echo "→ [1/5] Verificando código (TypeScript + ESLint)..."
cd "$SITE_DIR"
# TypeScript bloqueia deploy — erros de compilação não devem ir para produção
if ! npx tsc -b --noEmit; then
  echo ""
  echo "❌  TypeScript encontrou erros. Corrija antes de publicar."
  exit 1
fi
# ESLint é informativo — exibe avisos mas não bloqueia deploy
npm run lint -- --max-warnings 9999 || echo "   ⚠️  ESLint: avisos encontrados (não bloqueante)"
echo "   OK"

# ── 2. Build ──────────────────────────────────────────────────────────────────
echo "→ [2/5] Buildando projeto..."
npm run build
echo "   OK"

# ── 3. Preparar worktree do gh-pages ─────────────────────────────────────────
echo "→ [3/5] Preparando branch gh-pages..."
cd "$REPO_ROOT"

# Limpa worktree anterior caso tenha sobrado de execução anterior
rm -rf "$WORKTREE_DIR"
git worktree prune

git fetch origin gh-pages
# Garante que o branch local está no mesmo ponto que o remote
git branch -f gh-pages origin/gh-pages 2>/dev/null || true
git worktree add "$WORKTREE_DIR" gh-pages
echo "   OK"

# ── 4. Copiar build para worktree ─────────────────────────────────────────────
echo "→ [4/5] Copiando build para gh-pages..."
cd "$WORKTREE_DIR"

# Remove arquivos rastreados antigos (mantém .git do worktree intacto)
git rm -rf . --quiet

# Copia dist para raiz, excluindo .git caso exista no dist
tar -C "$DIST_DIR" --exclude='.git' -cf - . | tar -xf -

# .nojekyll — garante que o GitHub Pages não processa com Jekyll
touch .nojekyll

echo "   OK"

# ── 5. Commit e push ──────────────────────────────────────────────────────────
echo "→ [5/5] Publicando no GitHub Pages..."

git add -A

if git diff --cached --quiet; then
  echo ""
  echo "✓ Sem alterações desde o último deploy. Nada publicado."
  cd "$REPO_ROOT"
  git worktree remove "$WORKTREE_DIR" --force
  exit 0
fi

TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
git commit -m "deploy: $TIMESTAMP

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

git push origin gh-pages

# Limpa worktree
cd "$REPO_ROOT"
git worktree remove "$WORKTREE_DIR" --force

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  ✅  Deploy concluído com sucesso!   ║"
echo "║      pousinox.com.br atualizado      ║"
echo "╚══════════════════════════════════════╝"
echo ""
