# CLAUDE.md — Pousinox Site Institucional

Este arquivo orienta o Claude Code ao trabalhar neste repositório.

## Visão Geral

Site institucional da **Pousinox** — fabricante de fixadores de porcelanato em aço inox, Pouso Alegre/MG. Domínio: `pousinox.com.br`. Deploy via Cloudflare Pages.

## Stack

- **Framework:** Vite + React 19 + TypeScript
- **Roteamento:** React Router v7
- **Banco de dados:** Supabase (`@supabase/supabase-js`)
- **SEO:** `react-helmet-async`
- **Deploy:** Cloudflare Pages (`wrangler.toml` → worker `pousinox-institucional`)
- **Build:** `tsc -b && vite build` → saída em `dist/`

## Identidade Visual

- **Cores:** azul escuro + prata + branco
- **Tipografia:** Inter
- Variáveis CSS definidas em `src/styles/`

## Estrutura de Pastas

```
src/
  pages/          # Páginas do site (Home, Produtos, Sobre, Contato, etc.)
  components/     # Componentes reutilizáveis (Header, Footer, SEO, Search…)
  contexts/       # React Contexts
  hooks/          # Custom hooks
  lib/            # Clientes externos (Supabase, etc.)
  data/           # Dados estáticos
  assets/         # Imagens e recursos estáticos
  styles/         # Estilos globais
```

## Páginas Principais

| Rota | Componente | Descrição |
|---|---|---|
| `/` | `Home` | Página inicial |
| `/produtos` | `Produtos` | Catálogo de produtos |
| `/segmentos/:slug` | `Segmento` | Páginas por segmento |
| `/sobre` | `Sobre` | Institucional |
| `/contato` | `Contato` | Formulário de contato |
| `/blog` | `Blog` | Blog (lista) |
| `/blog/:slug` | `Blog` | Blog (post individual) |
| `/servicos/corte-laser` | `CorteLaser` | Serviço de corte a laser |
| `/pronta-entrega` | `Outlet` | Produtos pronta entrega |
| `/outlet` | — | Redirect para `/pronta-entrega` |
| `/obrigado` | `Obrigado` | Pós-conversão |

## Painel Admin

Rotas `/admin/*` com layout próprio (`AdminLayout`). Módulos:

- `AdminDashboard` — visão geral
- `AdminConteudo` — gerenciar conteúdo
- `AdminVendas` / `AdminOrcamento` — vendas e orçamentos
- `AdminOutlet` — gestão do outlet
- `AdminEstoque` — controle de estoque
- `AdminAnalytics` — métricas
- `AdminAnaliseNF` — análise de notas fiscais
- `AdminRelatorios` — relatórios
- `AdminUsuarios` — usuários

## Comandos

```bash
npm run dev       # Servidor de desenvolvimento (Vite)
npm run build     # Build de produção (tsc + vite build)
npm run preview   # Preview do build local
npm run deploy    # Deploy via script ../scripts/deploy.sh
```

## Convenções

- Todo texto em português (pt-BR).
- CSS Modules por componente (`.module.css` ao lado do `.tsx`).
- SEO gerenciado pelo componente `SEO` com `react-helmet-async`.
- Dados do Supabase acessados via `src/lib/`.
- Automações n8n para formulário de contato, outlet e bot de negociação (workflows em `n8n-*.json` na raiz).
