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
- `AdminProjetos` — módulo de projetos sob medida (ver abaixo)
- `AdminProspeccao` — hub de prospecção B2B (800K CNPJs)
- `AdminCatalogo` — catálogo de produtos

## Módulo AdminProjetos (src/pages/AdminProjetos.tsx)

Módulo principal de ERP leve. Gerencia projetos sob medida com ciclo de aprendizado.

### Funcionalidades
- **CRUD de projetos** com campos: título, cliente, CNPJ, segmento, status, datas, valor, observações, projetista, revisão, norma, escala, data do projeto
- **Segmento livre** — select com opção "Outro…" abre input de texto; segmentos históricos aparecem como grupo "Personalizados"
- **Atributos estruturados** — catálogo em `atributos_catalogo`, salvo em `projeto_atributos`. Suporte a enum, numérico e texto. Edit inline com ✏️
- **Componentes** — lista de peças/materiais em `projeto_componentes` (nome, quantidade, ordem). Aba 🔩 Componentes no formulário
- **Anexos** — upload para Supabase Storage (bucket `projetos-anexos`), tabela `projeto_anexos`
- **Criar do PDF** — botão na lista extrai campos básicos + atributos + componentes via Edge Function `extrair-memorial`, pré-preenche o formulário inteiro
- **Analisar PDF com IA** — botão na aba Atributos (componente `UploadMemorial`) analisa PDF e salva atributos diretamente
- **Similaridade Jaccard** — RPC `buscar_similares` retorna projetos similares por atributos
- **Shadow mode pgvector** — embeddings Gemini `gemini-embedding-001` em `projeto_embeddings`, comparação paralela em `similarity_shadow_log`, feature flag `vector_similarity_shadow`
- **Recorrências** — detecção automática de padrões repetidos em `recorrencias`
- **Produtos Padrão** — `produtos_padrao` vinculados a projetos
- **Catálogo de atributos** — aba interna para gerenciar `atributos_catalogo` (chave, label, tipo, enum, unidade)
- **Gerar Orçamento** — botão no detalhe do projeto navega para `/admin/orcamento` pré-preenchido com cliente e componentes

### Tabelas Supabase relevantes
- `projetos`, `projeto_atributos`, `projeto_anexos`
- `projeto_componentes` — peças/materiais do projeto
- `projeto_embeddings` — embeddings vetoriais (modelo gemini-embedding-001-3072)
- `similarity_shadow_log` — logs comparativos Jaccard vs vetorial
- `feature_flags` — flag `vector_similarity_shadow`
- `atributos_catalogo` — catálogo de atributos (inclui: peso, comprimento, largura, altura, espessura, acabamento, superficie, aplicacao, tipo_produto, liga)
- `recorrencias`, `recorrencia_projetos`, `produtos_padrao`

### Edge Functions
- `extrair-memorial` — extrai campos básicos + atributos + componentes de PDF via Claude Haiku
- `gerar-embeddings` — gera embeddings via Gemini para projetos pendentes

### Componentes
- `src/components/UploadMemorial/` — upload e análise de PDF na aba Atributos

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
