---
description: Scaffold completo de módulo admin — página, CSS, rota, permissão
---

# Novo Módulo Admin

Crie um módulo admin completo seguindo os padrões do projeto.

## 1. Coletar informações
Pergunte ao usuário (se não especificado):
- **Nome do módulo** (ex: "Logistica") → rota `/admin/logistica`, componente `AdminLogistica`
- **Seção** no menu: Comercial | Marketing | Catálogo | Compras | Estoque | Operação | Fiscal | Financeiro | Relatórios | Configuração
- **Descrição curta** para o label do menu

## 2. Criar página TSX
- Arquivo: `src/pages/Admin<Nome>.tsx`
- Estrutura mínima:
  - Import do CSS module e `supabaseAdmin`
  - Estado: `loading`, `items[]`, `vista` (lista/form/detalhe)
  - `useEffect` para fetch inicial
  - Toolbar com título + badge de contagem + botão "Novo"
  - Loading state com `AdminLoading` (anel SVG)
  - Lista com busca
  - Formulário colapsável (seções colapsáveis fechadas por padrão)
  - Mobile-first (referência Drogasil)

## 3. Criar CSS Module
- Arquivo: `src/pages/Admin<Nome>.module.css`
- Classes base: `.wrap`, `.toolbar`, `.toolbarTitle`, `.badge`, `.btnPrimary`, `.btnSecondary`, `.formCard`, `.formCampos`, `.campo`, `.label`, `.input`, `.searchBar`, `.list`, `.card`, `.actions`, `.msg`, `.msgOk`, `.msgErro`
- Seguir paleta: azul escuro (#1B3A5C), prata, branco, fundo #f1f5f9
- Botões com border-radius, transitions, hover states
- Media query `@media (max-width: 768px)` para mobile

## 4. Adicionar rota em App.tsx
- Import lazy: `const Admin<Nome> = lazy(() => import('./pages/Admin<Nome>'))`
- Adicionar `<Route path="<slug>" element={<Admin<Nome> />} />` dentro do grupo admin

## 5. Registrar em AdminLayout.tsx
- `ROTA_PERMISSAO`: adicionar `'<slug>': '<permissao>'`
- `TODAS_PERMISSOES`: adicionar `'<permissao>'` ao array
- `NAV_ITEMS`: adicionar item com `to`, `label`, `permissao`, `section`, `icon` (SVG inline)

## 6. SQL de permissão
- Gerar e mostrar: `UPDATE admin_perfis SET permissoes = permissoes || '{<permissao>}';`
- Instruir o usuário a rodar no SQL Editor

## 7. Atualizar CLAUDE.md
- Adicionar linha na tabela de módulos existentes
