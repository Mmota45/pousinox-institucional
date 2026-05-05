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

## Painel Admin

Rotas `/admin/*` com layout próprio (`AdminLayout`). Todos os módulos usam `supabaseAdmin` (service_role). RLS em todas as tabelas admin: `USING (auth.role() = 'service_role')`.

### Permissões
- Cada rota tem uma permissão em `ROTA_PERMISSAO` em `AdminLayout.tsx`
- `TODAS_PERMISSOES` define o conjunto completo — sempre adicionar aqui ao criar módulo novo
- Permissões ficam salvas em `admin_perfis.permissoes` (array text[]) por usuário
- **Atenção:** ao adicionar nova permissão, usar `UPDATE admin_perfis SET permissoes = permissoes || '{nova-permissao}';`

### Componentes reutilizáveis

- `SearchableSelect` — dropdown com busca, highlight, fecha ao clicar fora, botão ✕ limpar. Props: `value, onChange, options, placeholder, searchPlaceholder, minWidth`
- `SeloValidacao` — badge shield SVG "Validado em ensaio técnico". Props: `descricao` (default "Ensaios técnicos LAMAT · SENAI"). Usado na hero de `/fixador-porcelanato`
- `WatermarkPdf` — modal para envio controlado de PDF com marca d'água diagonal CONFIDENCIAL + UUID; grava em `docs_enviados` (Supabase). Table: `docs_enviados` (id UUID, watermark_id UUID, tipo_doc, empresa, contato, email, observacao, enviado_por, criado_em). Migration: `20260415_docs_enviados.sql`

### Padrões de implementação

- **Vista pattern**: `type Vista` para alternar entre lista/form/detalhe dentro de uma página (sem nova rota)
- **Sequence pattern**: `CREATE SEQUENCE nome_seq` para numerações sem colisão (OP-XXXX, OM-XXXX, SC-XXXX, etc.)
- **RLS**: `USING (auth.role() = 'service_role')` em todas as tabelas admin
- **Trigger updated_at**: reusar `set_updated_at()` já existente no banco
- **CSS compartilhado**: `AdminCompras.module.css` (Compras), `AdminEstoqueIndustrial.module.css` (Estoque industrial)
- **Base compartilhada**: `AdminEstoqueBase.tsx` (prop `tipo`), `AdminFiscalDocBase.tsx` (prop `tipo`) — wrappers finos por rota
- **Vite 8 / rolldown**: não aceita IIFE `(() => {})()` dentro de JSX — extrair para componente nomeado antes do `export default`

### Módulos existentes

| Rota | Componente | Seção | Status |
|---|---|---|---|
| `/admin/cockpit` | `AdminCockpit` | Cockpit | ✅ tela unificada 8 etapas (Radar→Pós-venda), IA contextual, briefing, alertas, notícias, automações, insights, busca global CNPJ |
| `/admin` | `AdminDashboard` | — | ✅ |
| `/admin/prospeccao` | `AdminProspeccao` | Comercial | ✅ 800K CNPJs, mapa Leaflet, drawer de detalhe com histórico de compras e criação de deal |
| `/admin/pipeline` | `AdminPipeline` | Comercial | ✅ deals, estágios, recebível |
| `/admin/central-vendas` | `AdminCentralVendas` | Comercial | ✅ scoring on-the-fly, hot list, follow-ups, materiais, dashboard, WhatsApp por segmento, validação Z-API |
| `/admin/ia` | `AdminIA` | IA | ✅ multi-provider (Groq/Gemini/OpenRouter), busca web (Brave+Serper), consulta DB automática, roteamento inteligente |
| `/admin/orcamento` | `AdminOrcamento` | Comercial | ✅ hub 3 painéis (lista+editor+ações), envio email Brevo + WhatsApp Z-API, monitor acessos proposta/laudos |
| `/admin/vendas` | `AdminVendas` | Comercial | ✅ |
| `/admin/clientes` | `AdminClientes` | Comercial | ✅ importação NFSTok + RFM |
| `/admin/leads` | `AdminLeads` | Marketing | ✅ |
| `/admin/campanhas` | `AdminCampanhas` | Marketing | ✅ |
| `/admin/analytics` | `AdminAnalytics` | Marketing | ✅ GA4 |
| `/admin/conteudo` | `AdminConteudo` | Marketing | ✅ |
| `/admin/produtos` | `AdminProdutos` | Catálogo | ✅ |
| `/admin/outlet` | `AdminOutlet` | Catálogo | ✅ |
| `/admin/fornecedores` | `AdminFornecedores` | Compras | ✅ |
| `/admin/solicitacoes-compra` | `AdminSolicitacoesCompra` | Compras | ✅ SC-XXXX, fluxo aprovação |
| `/admin/cotacoes-compra` | `AdminCotacoesCompra` | Compras | ✅ CQ-XXXX, itens com preço |
| `/admin/pedidos-compra` | `AdminPedidosCompra` | Compras | ✅ PC-XXXX, qtd recebida por item |
| `/admin/recebimentos-compra` | `AdminRecebimentosCompra` | Compras | ✅ RC-XXXX, pré-preenche itens do pedido |
| `/admin/estoque` | `AdminEstoque` | Estoque | ✅ outlet/produtos (intacto) |
| `/admin/estoque-mp` | `AdminEstoqueMp` | Estoque | ✅ MP — custo médio ponderado, movimentações rastreáveis |
| `/admin/estoque-pa` | `AdminEstoquePa` | Estoque | ✅ PA — mesma base que MP |
| `/admin/inventario` | `AdminInventario` | Estoque | ✅ INV-XXXX, snapshot→contagem→ajuste automático |
| `/admin/projetos` | `AdminProjetos` | Operação | ✅ ERP completo (ver abaixo) |
| `/admin/producao` | `AdminProducao` | Operação | ✅ OP-XXXX, vínculo projeto |
| `/admin/qualidade` | `AdminQualidade` | Operação | ✅ inspeções + NCs inline |
| `/admin/manutencao` | `AdminManutencao` | Operação | ✅ ativos + OM-XXXX + `custo_realizado` (migration 20260415) |
| `/admin/docs-recebidos` | `AdminDocsRecebidos` | Fiscal | ✅ NF-e compra, gera entrada estoque |
| `/admin/docs-emitidos` | `AdminDocsEmitidos` | Fiscal | ✅ NF-e venda, gera saída estoque |
| `/admin/analise-nf` | `AdminAnaliseNF` | Fiscal | ✅ análise offline CSV NFSTok — import em massa com progresso %, botão remover arquivo |
| `/admin/financeiro` | `AdminFinanceiro` | Financeiro | ✅ Fase 1b — ver abaixo |
| `/admin/conciliacao` | `AdminConciliacao` | Financeiro | ✅ multi-critério, 9 categorias |
| `/admin/relatorios` | `AdminRelatorios` | Relatórios | ✅ |
| `/admin/usuarios` | `AdminUsuarios` | Configuração | ✅ |
| `/admin/estudo-mercado` | `AdminEstudoMercado` | Comercial | ✅ cruzamento interno×externo, import GKP, score por UF — ver abaixo |
| `/admin/fixadores` | `AdminFixadores` | Catálogo | ✅ CRUD modelos, regras de cálculo, consumíveis |
| `/admin/assistente` | `AdminAssistente` | IA | ✅ chat multi-modelo, knowledge base (Supabase), RAG anti-alucinação, busca automática knowledge_guias + DB, fontes por thread, feedback 👍👎, studio com contexto |
| `/admin/site` | `AdminSite` | Marketing | ✅ CMS páginas e seções do site |
| `/admin/frete` | `AdminFrete` | Operação | ✅ configuração de frete Correios + Braspress |
| `/admin/feature-flags` | `AdminFeatureFlags` | Configuração | ✅ flags públicas e internas |
| `/admin/dashboard-bi` | `AdminDashboardBI` | Relatórios | ✅ dashboard BI com filtros e gráficos |
| `/admin/pedidos-outlet` | `AdminPedidosOutlet` | Catálogo | ✅ pedidos do outlet/pronta-entrega |
| `/admin/uso` | `AdminUso` | Configuração | ✅ custos por provider, créditos API, recursos do sistema |

---

## Módulo Compras (Etapa 1)

Fluxo fechado: necessidade → solicitação → cotação → pedido → recebimento.

### Tabelas
- `solicitacoes_compra` + `itens_solicitacao` (SC-XXXX)
- `cotacoes_compra` + `itens_cotacao` (CQ-XXXX)
- `pedidos_compra` + `itens_pedido` (PC-XXXX) — `valor_total` recalculado ao salvar itens; `quantidade_recebida` por item
- `recebimentos_compra` + `itens_recebimento` (RC-XXXX) — pré-preenche itens do pedido; atualiza `quantidade_recebida`
- Migration: `supabase/migrations/20260414_compras_fix.sql`

### CSS compartilhado
`src/pages/AdminCompras.module.css` — usado por todos os 4 módulos de compras e pelos módulos fiscais.

---

## Módulo Estoque Industrial (Etapa 2)

Separado do `AdminEstoque` (outlet). Fonte de verdade: `estoque_movimentacoes`.

### Tabelas
- `estoque_itens` — cadastro MP/PA/semiacabado: código, nome, unidade, `saldo_atual` (cache), `estoque_minimo`, `custo_medio`, localização, lote_padrao, ativo
- `estoque_movimentacoes` — toda entrada/saída/ajuste: `tipo_movimentacao` (entrada|saida|ajuste_positivo|ajuste_negativo|transferencia_*), `quantidade`, `custo_unitario`, `valor_total`, `saldo_anterior`, `saldo_posterior`, `origem_tipo`, `origem_id`, `origem_label`
- `estoque_inventario` (INV-XXXX) + `estoque_inventario_itens` — snapshot→contagem→ajuste
- Migration: `supabase/migrations/20260414_estoque_industrial.sql`

### Componente base
`AdminEstoqueBase.tsx` — prop `tipo: 'mp'|'pa'`. Wrappers: `AdminEstoqueMp.tsx`, `AdminEstoquePa.tsx`.

### Custo médio
Recalculado em cada entrada: `(saldo_ant × custo_ant + qtd × custo_unit) / saldo_post`.

### Inventário
1. Criar sessão → Iniciar Contagem (snapshot de `saldo_atual` de todos os itens do escopo)
2. Preencher `saldo_contado` por item
3. Finalizar → gera movimentações `ajuste_positivo`/`ajuste_negativo` + atualiza `saldo_atual`

---

## Módulo Fiscal (Etapa 3)

### Documentos Recebidos (`docs_fiscais_recebidos` + `itens_doc_recebido`)
- NF-e de compra: emitente, datas, valor, status (pendente|autorizada|cancelada|denegada)
- Vínculo opcional com `recebimentos_compra` (`recebimento_id BIGINT`)
- Cada item pode ter `estoque_item_id FK → estoque_itens`
- Botão "Gerar movimentação de entrada" — aparece quando `status='autorizada'` e `estoque_movimentado=false`
- Ao gerar: cria linha em `estoque_movimentacoes` com `origem_tipo='nf_recebida'`, atualiza custo médio e saldo, seta `estoque_movimentado=true`

### Documentos Emitidos (`docs_fiscais_emitidos` + `itens_doc_emitido`)
- NF-e de venda: destinatário, data, valor, status (rascunho|autorizada|cancelada|denegada)
- Vínculo opcional com `vendas` (`venda_id UUID` — tabela vendas usa UUID)
- Mesma lógica de movimentação de saída com `origem_tipo='nf_emitida'`

### Componente base
`AdminFiscalDocBase.tsx` — prop `tipo: 'recebido'|'emitido'`. Wrappers: `AdminDocsRecebidos.tsx`, `AdminDocsEmitidos.tsx`.

### Migration
- `supabase/migrations/20260414_fiscal_docs.sql` — estrutura original
- `supabase/migrations/20260415_fiscal_unificado.sql` — drop de tabelas legadas, unificação em `docs_fiscais` + `itens_doc`

### Import CSV (AdminFiscalDocBase)
- `detectFormat` detecta formato por `h0 === 'nf'` (itens) ou `h0 === 'série'/'número'` (cabeçalho) + presença de coluna "Qtd"
- Aviso explícito se todos os valores importados forem R$ 0,00
- Botão ✕ por linha para excluir doc individual
- Botão "🗑 Excluir zerados" na toolbar (batch, só quando há zerados)
- Botão "🗑 Excluir todos" — visível só para perfil com permissão `usuarios`, exige digitar `EXCLUIR TUDO`

### AdminAnaliseNF
- Botão "✕ Remover arquivo" para limpar e recarregar outro CSV
- Progresso `%` exibido durante save (`salvarProgresso`)
- Estado `salvandoDocs: 'emitido'|'recebido'|null` — cada botão mostra loading só para si

### Regra importante
Movimentação de estoque **não é automática** — depende de ação explícita do usuário após vincular itens de estoque e autorizar o documento. Isso garante que o estoque só se move quando há confirmação operacional.

---

## Módulo AdminFinanceiro (src/pages/AdminFinanceiro.tsx)

Módulo financeiro automation-first — Fase 1b do ERP.

### Filosofia
- Receitas nascem em **Vendas** (botão "Registrar recebimento" — integração futura)
- Despesas nascem de **NFs importadas** e **Projetos** (integração futura)
- Lançamento manual é fallback: ajustes, taxas, sangrias, exceções
- A UI diferencia lançamentos automáticos (⚡ badge azul) de manuais (✍ badge cinza)

### Abas
- **Painel** — cards: receitas, despesas, saldo, vencidos a receber/pagar, pendentes + atalhos para origens automáticas
- **Lançamentos** — filtros por tipo/status/mês/origem + tabela + formulário manual colapsável (border dashed)
- **Fluxo de Caixa** — extrato real (`fin_movimentacoes`): só lançamentos baixados aparecem aqui
- **Configuração** — cadastro de categorias e centros de custo

### Tabelas Supabase
- `fin_categorias` — plano de contas (tipo: receita|despesa, grupo, cor)
- `fin_centros_custo` — centros de custo
- `fin_lancamentos` — documento financeiro principal (contas a pagar/receber)
  - `origem`: `manual | venda | nf | projeto | sistema | pipeline` — sempre `manual` quando criado pelo formulário
  - `status`: `pendente | pago | cancelado | parcial`
  - `nf_chave`: referência à chave NF-e (sem FK — idempotência)
  - `forma_pagamento`, `condicao_pagamento` — enums aprovados, não alterar sem migration
- `fin_parcelas` — parcelas de lançamentos parcelados
- `fin_movimentacoes` — **caixa real / extrato operacional** (criada ao baixar lançamento)

### Views
- `vw_fin_saldo_mes` — saldo por mês com receitas, despesas, pendentes e vencidos

### Regra de baixa
- Lançamento simples: `status = 'pago'` + `data_pagamento` + 1 linha em `fin_movimentacoes`
- Lançamento parcelado: cada `fin_parcelas` tem status próprio; `fin_lancamentos.status = 'parcial'` enquanto houver pendentes
- Sem trigger — lógica explícita no frontend

### Extensões em tabelas existentes
- `clientes` — colunas RFM: `rfm_score`, `rfm_recencia`, `rfm_frequencia`, `rfm_valor`, `rfm_segmento`, `rfm_calculado_em`
- `projetos` — `fin_lancamento_id` FK opcional para `fin_lancamentos`
- `vendas` — `fin_lancamento_id` FK opcional para `fin_lancamentos`

### Migrations
- `supabase/migrations/20260414_financeiro_fase1.sql`
- `supabase/migrations/20260414_financeiro_origem.sql`

### Integrações implementadas
- `AdminProjetos` → botão "💰 Gerar Recebível" → `fin_lancamentos` com `origem='projeto'`
- `AdminPipeline` → botão "💰 Gerar Recebível" (deal ganho) → `fin_lancamentos` com `origem='pipeline'`
- `AdminFiscalDocBase` → botão "💰 Gerar lançamento financeiro" em docs `status='autorizada'` e `fin_lancado=false`
  → NF emitida (venda) → `tipo='receita'`; NF recebida (compra) → `tipo='despesa'`
  → Consulta `fin_categoria_cnpj` para categorização automática por CNPJ
  → Se CNPJ desconhecido: cria com `aguarda_categorizacao=true` → aparece na fila do Financeiro
  → Migration: `supabase/migrations/20260415_fin_nf_integracao.sql`

### Tabela de memória CNPJ
- `fin_categoria_cnpj` — (cnpj, tipo) UNIQUE → `categoria_id`, `centro_custo_id`, `usos`
- `usos` incrementado a cada confirmação — CNPJs mais usados têm categorização mais confiável

### DRE (aba 📈 DRE)
- Regime de caixa: **Realizado** = `fin_movimentacoes` baixadas; **Previsto** = `fin_lancamentos` pendentes futuros; **Atrasado** = pendentes vencidos
- Agrupado por `fin_categorias.grupo` e `tipo` (receita/despesa)
- Linha "Resultado Líquido" = Receitas − Despesas por coluna
- Filtros: Ano + Período (mês específico ou ano todo)

### Categorização assistida
- Badge "⚠️ N aguardando categorização" no Painel
- Filtro "⚠️ Aguardando" na aba Lançamentos expande UI inline por linha
- `confirmarCategorizacao()` salva categoria/CC e faz upsert em `fin_categoria_cnpj` (aprendizado contínuo)

---

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
- **Precificação por peso** — painel no detalhe: `peso_kg × custo_por_kg × (1 + margem%)`, defaults em localStorage
- **Gerar Recebível** — botão no detalhe cria `fin_lancamentos` com `origem='projeto'`
- **Recorrências** — detecção automática de padrões repetidos em `recorrencias`
- **Produtos Padrão** — `produtos_padrao` vinculados a projetos
- **Catálogo de atributos** — vista interna (`🗂 Catálogo`) para gerenciar `atributos_catalogo`
- **Gerar Orçamento** — navega para `/admin/orcamento` pré-preenchido
- **Ficha Técnica Comercial** — PDF com logo, dados, atributos e componentes
- **Shadow Log** — vista `🔬 Shadow Log` com KPIs e tabela Jaccard vs vetorial

### Tabelas Supabase relevantes
- `projetos`, `projeto_atributos`, `projeto_anexos`, `projeto_componentes`
- `projeto_embeddings`, `similarity_shadow_log`, `feature_flags`
- `atributos_catalogo`, `recorrencias`, `recorrencia_projetos`, `produtos_padrao`

### Edge Functions
- `extrair-memorial` — extrai campos de PDF via Claude Haiku
- `gerar-embeddings` — gera embeddings via Gemini

### Componentes
- `src/components/UploadMemorial/` — upload e análise de PDF na aba Atributos

---

## Módulo AdminProspeccao — Drawer de Detalhe

Botão 🔍 (azul) na coluna Ações abre drawer lateral com:
- Nome completo, CNPJ, porte, segmento, cidade/UF, score
- Telefones com botões "Ligar" (`tel:`) e "WhatsApp" (verifica se número aceita WA)
- E-mail com copiar
- Links de busca: Google (`EMPRESA CIDADE telefone celular site`) + CNPJ.biz (dados Receita Federal)
- **Histórico de compras** (quando `cliente_ativo = true`): carrega `nf_cabecalho` por `cnpj` (destinatário), accordion por NF expande itens de `nf_itens` (descrição, quantidade × vlr unit). Itens ficam em cache.
- **➡ Criar deal no Pipeline**: insere em `pipeline_deals` com `estagio='entrada'` + `prospect_id`, exibe toast com link `/admin/pipeline`

---

## Módulo AdminPipeline (src/pages/AdminPipeline.tsx)

- Deals por prospect ou cliente; estágios: `entrada → qualificado → proposta → negociação → ganho | perdido`
- Gerar Recebível: deal ganho → `fin_lancamentos` com `origem='pipeline'`
- Vínculo com prospect via CNPJ normalizado
- Tabela: `pipeline_deals` — `prospect_id FK → prospeccao`, `cliente_id FK → clientes`, `fin_lancamento_id FK → fin_lancamentos`
- Migration: `supabase/migrations/20260414_pipeline_deals.sql`

---

## Módulo AdminCentralVendas (src/pages/AdminCentralVendas.tsx)

Central de vendas inteligente — hub comercial que prioriza prospects, gerencia follow-ups e materiais.

### Abas
- **Hot List** — top 50 prospects com scoring on-the-fly via RPC `fn_top_prospects(n, filtro_uf)`. Multi-select UF/Segmento/Demanda (Alta≥7, Média 3–7, Baixa<3). Round-robin intercala UFs sem filtro. Filtro "Só com WhatsApp". Botão "Validar WhatsApp" (lote via Z-API).
- **Follow-ups** — kanban 3 colunas: Atrasados (vermelho) | Hoje (amarelo) | Próximos 7d (verde). Ações: Feito (agenda próximo), Adiar, WhatsApp.
- **Materiais** — CRUD de materiais comerciais (apresentação, ficha técnica, laudo, cartão). Envio via WhatsApp com tracking.
- **Dashboard** — KPIs (contactados, deals, follow-ups atrasados, receita pipeline) + funil visual prospect→contactado→deal→proposta→ganho.
- **Radar** — placeholder para integrações futuras (GSC, ML API, Google Trends).

### Scoring (fn_top_prospects)
- Score total = demanda UF (35%) + segmento (25%) + porte (20%) + proximidade (20%)
- Demanda: `SUM(market_keywords.volume_mensal)` por UF / max
- Segmento: constru=9, revest=8, arquit/engenh=7, outros=4
- Porte: Médio/Grande=10, Pequeno Porte=5, Micro Empresa=3
- Proximidade: MG=10, SP=7, RJ/ES=6, PR/SC=5, RS/GO/DF=4, BA/MT/MS=3
- Calculado on-the-fly (sem pré-computar) — suporta 3.4M prospects

### Tabelas Supabase
- `prospect_scores` — tabela legada (criada mas não usada, scoring é on-the-fly)
- `followups` — follow-ups agendados (prospect_id, deal_id, tipo, data_prevista, status)
- `activity_log` — log de atividades comerciais (prospect_id, tipo, canal, detalhes)
- `materiais_comerciais` — materiais de venda (titulo, tipo, url, envios)
- `gsc_cache` — cache Google Search Console (futuro)

### WhatsApp
- Campo dedicado `prospeccao.whatsapp` + `whatsapp_validado` (boolean)
- Mensagens por segmento via `gerarMsgWpp(nome, segmento)`: açougue, restaurante, construção, hospital, hotel, supermercado, genérico
- Drawer: input WhatsApp + Salvar/Enviar/Validar, links "Buscar WhatsApp" (Google) e "Instagram"
- Hot List: prioriza 📱 WhatsApp sobre 📞 telefone1
- Validação individual e em lote via edge function `validar-whatsapp` (Z-API `phone-exists`)
- Secrets: `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN`

### Edge Functions
- `central-vendas-scores` — ações: `scores` (RPC fn_top_prospects), `followups` (listar pendentes), `dashboard` (agregar KPIs)
- `validar-whatsapp` — ações: `check` (individual), `batch` (até 50, rate limit 600ms)

### Migrations
- `supabase/migrations/20260428_fix_scoring_performance.sql`
- `supabase/migrations/20260428_prospeccao_whatsapp.sql`

---

## Módulo AdminIA (src/pages/AdminIA.tsx)

Hub de IA multi-provider com busca web e consulta ao banco de dados.

### Providers
- **Groq** (Llama 70B) — default para roteamento automático de perguntas rápidas
- **Gemini** (Google) — modelo alternativo
- **OpenRouter** — acesso a múltiplos modelos

### Busca Web
- **Brave Search API** + **Serper (Google)** com fallback automático
- Cache de 30 minutos por query
- Seletor de fonte: Auto / Brave / Google / Sem busca
- Roteamento inteligente: `shouldSearch()` pula web quando DB já responde

### Integração DB
- `fetchOverview()` — COUNTs de 9 tabelas (always-on, cache 5min)
- `fetchDetail(messages)` — queries detalhadas baseadas no contexto da conversa
- Keywords: produtos, clientes, prospects, pipeline, financeiro, estoque, etc.

### UI
- Badges: 🗄️ "Dados do sistema" (verde) e 🔍 "Busca web ativa" (amarelo)
- Chips de provider com destaque para busca ativa

### Edge Function
- `ai-hub` — roteamento de providers, busca web, consulta DB, contexto do site (fixadorporcelanato.com.br)
- Secrets: `BRAVE_API_KEY`, `SERPER_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`

---

## Módulo AdminProducao (src/pages/AdminProducao.tsx)

- Ordens OP-XXXX via `ordens_producao_numero_seq`
- Fluxo: `planejada → liberada → em_producao → concluida` (cancelada em qualquer ponto)
- `data_inicio` automática ao ir para `em_producao`; `data_conclusao` ao concluir
- Vínculo opcional com `projetos` via busca por nome (debounce 300ms)
- Migration: `supabase/migrations/20260414_ordens_producao.sql`

---

## Módulo AdminManutencao (src/pages/AdminManutencao.tsx)

- Aba Ativos: CRUD de equipamentos (código, nome, categoria, localização, fabricante, modelo, status)
- Aba Ordens: OM-XXXX via `ordens_manutencao_numero_seq`; tipos: corretiva|preventiva; prioridade: baixa|media|alta
- Fluxo: `aberta → em_execucao → concluida` (cancelada em qualquer ponto)
- Campo `custo_realizado NUMERIC(14,2)` adicionado em `ordens_manutencao` — exibido no detalhe formatado em BRL
- Migrations: `supabase/migrations/20260414_manutencao.sql` + `supabase/migrations/20260415_manutencao_custo.sql`

---

## Módulo AdminQualidade (src/pages/AdminQualidade.tsx)

- Inspeções: `tipo_origem` + `origem_label` sem FK rígida — flexibilidade MVP
- Se resultado `reprovado`, abre detalhe automaticamente para criar NC
- NC inline no detalhe da inspeção; lista global de NCs com status editável
- Severidade NC: `baixa | media | alta`; Status: `aberta → em_analise → tratada → fechada`
- Migration: `supabase/migrations/20260414_qualidade.sql`

---

## Módulo AdminClientes (src/pages/AdminClientes.tsx)

- Aba **Importar NFs**: CSVs NFSTok → upsert em `nf_cabecalho` + `nf_itens` → consolidação em `clientes` → cruzamento com `prospeccao`
- Aba **Clientes**: tabela com busca, ordenação, campos RFM
- Aba **RFM**: segmentação via RPC `fn_calcular_rfm()`. Cron diário às 3h. Migration: `supabase/migrations/20260414_rfm_cron.sql`

---

## Módulo AdminEstudoMercado (src/pages/AdminEstudoMercado.tsx)

Inteligência de mercado — cruzamento entre histórico interno (NFs + clientes) e demanda de busca regional.

### Abas
- **Visão Geral** — KPIs (faturamento, clientes, UFs atendidas, volume de busca), matriz de quadrantes (validado/oportunidade/relacionamento/baixa), resumo executivo dinâmico, gráficos por UF e segmento
- **Busca Regional** — tabela de keywords internas com busca, ordenação, badge de intenção, barra de volume; formulário inline para cadastro manual
- **Oportunidades Externas** — import de Google Keyword Planner (CSV tab-separated) ou CSV estendido; score por UF (volume × tendência × gap de presença); tabela de termos com ordenação em todas as colunas
- **Cruzamento** — matriz UF×segmento cruzando vendas internas e volume de busca externo; quadrante por threshold 0.5
- **Recomendações** — lista priorizada por quadrante com keywords e ações sugeridas

### Tabelas Supabase
- `market_keywords` — camada: `interna|externa`, campos: uf, mesorregiao, cluster, segmento, familia_produto, volume_mensal, intencao, fonte, trend_score, variacao_3m, variacao_yoy, competicao, cpc_max, ativo
- Migrations: `20260415_market_keywords.sql` + `20260415_market_keywords_externa.sql`

### Import Google KP
- Detecta delimitador automaticamente: `\t` (GKP), `;` (PT-BR) ou `,` (padrão)
- Header GKP buscado até linha 20 (ignora metadados); header estendido detectado por `termo` + `volume_mensal` na linha 0
- Colunas GKP mapeadas: Keyword→termo, Avg. monthly searches→volume, Mudança em três meses→var_3m, Mudança YoY→var_yoy, Competition→competicao, Competition (indexed value)→trend_score
- Competition PT-BR: "Alto/Alta"→alta, "Baixo/Baixa"→baixa, "Médio/Média"→media
- **UF do import**: dropdown obrigatório antes de importar — todos os termos recebem a UF selecionada (reimportar por UF para cobrir múltiplos estados)

### Componente reutilizável
`src/components/SearchableSelect/SearchableSelect.tsx` — dropdown com busca, highlight na seleção, fecha ao clicar fora, botão ✕ para limpar. Usado em todos os filtros do módulo e disponível para outros módulos.

### Dados de exemplo
`public/keywords-externas-pousinox.csv` — 60 keywords no formato estendido cobrindo MG/SP/RJ/PR/SC/RS.

---

## Páginas Públicas

| Rota | Componente | Descrição |
|---|---|---|
| `/` | `Home` | Página inicial |
| `/produtos` | `Produtos` | Catálogo de produtos |
| `/segmentos/:slug` | `Segmento` | Páginas por segmento |
| `/sobre` | `Sobre` | Institucional |
| `/contato` | `Contato` | Formulário de contato |
| `/blog` | `Blog` | Blog (lista e post) |
| `/servicos/corte-laser` | `CorteLaser` | Serviço de corte a laser |
| `/pronta-entrega` | `Outlet` | Produtos pronta entrega |
| `/obrigado` | `Obrigado` | Pós-conversão |
| `/fixador-porcelanato/calculadora` | `CalculadoraFixador` | Calculadora pública de materiais (OTP WhatsApp) |
| `/checkout` | `Checkout` | Checkout outlet com Pix QR |
| `/pedido/:id` | `PedidoStatus` | Status do pedido |
| `/produto/:id` | `ProdutoDetalhe` | Detalhe de produto |
| `/privacidade` | `Privacidade` | Política de privacidade (LGPD) |
| `/laudo/:id` | `LaudoAcesso` | Acesso protegido a laudo técnico |
| `/proposta/:id` | `PropostaAcesso` | Acesso público a proposta comercial |
| `/print/especificacao/:id` | `PrintEspecificacao` | PDF especificação de materiais |
| `/print/orcamento/:id` | `PrintOrcamento` | PDF orçamento com especificação técnica, preços estimados, DiagramaFixador e QR code |

## Componentes Reutilizáveis

| Componente | Localização | Descrição |
|---|---|---|
| `DiagramaFixador` | `src/components/DiagramaFixador/DiagramaFixador.tsx` | SVG posicionamento dos grampos. Props: `fixadoresPorPeca`, `larguraCm`, `alturaCm`, `larguraFixadorMm?`, `label?` |
| `LaudoProtegido` | `src/components/LaudoProtegido/LaudoProtegido.tsx` | Gerador de laudo protegido com watermark. Suporta multi-select e merge de PDFs. Props: `multi?`, `onGerado` |

## Especificação Técnica de Materiais

- **Cálculo:** `src/lib/calcularEspecificacao.ts` — fórmula dinâmica de consumíveis calibrada com dados de campo
- **Hook:** `src/components/Orcamento/hooks/useEspecificacao.ts` — suporta múltiplas medidas por orçamento
- **Tipos:** `src/components/Orcamento/especificacaoTypes.ts`
- **Tabelas:** `orcamento_especificacoes` + `orcamento_especificacao_itens`
- **Preços:** `fixador_modelos.preco_unitario` e `fixador_consumiveis.preco_unitario`
- **Obs:** coluna `ordem` NÃO existe em `orcamento_especificacao_itens` — usar `order('id')`

## SEO

- **Componente:** `src/components/SEO/SEO.tsx` — Helmet wrapper com LocalBusiness schema, OG, Twitter Cards
- **FAQ Schema:** Home (5), Sobre (3), Segmentos (2 dinâmicas), Calculadora (10) — via prop `extraSchema`
- **Product Schema:** Calculadora — fixador como produto com rating e preço
- **WebApplication Schema:** Calculadora
- **Sitemap:** `public/sitemap.xml` (25 URLs)
- **Robots:** `public/robots.txt` (bloqueia `/admin/`)
- **Skill:** `/radar-seo` — análise automática GSC com classificação de queries e recomendações

## Email e WhatsApp (Orçamento)

- **Edge function:** `enviar-email` — Brevo (email) + Z-API (WhatsApp)
- **Rate limit:** 15 WhatsApps/dia via `activity_log`
- **QR calculadora:** incluído automaticamente para segmentos de construção civil
- **Links:** hardcoded `https://www.pousinox.com.br` (não depende de `window.location.origin`)
- **DNS Brevo:** SPF + DKIM + DMARC configurados no Wix

## Comandos

```bash
npm run dev       # Servidor de desenvolvimento (Vite)
npm run build     # Build de produção (vite build)
npm run typecheck # Verificação de tipos (tsc -b) — separado do build
npm run preview   # Preview do build local
npm run deploy    # Deploy via script ../scripts/deploy.sh
```

## Convenções

- Todo texto em português (pt-BR).
- CSS Modules por componente (`.module.css` ao lado do `.tsx`).
- Dados do Supabase via `src/lib/supabase.ts` — `supabase` (anon) e `supabaseAdmin` (service_role).
- Ao adicionar módulo admin: (1) criar página + CSS, (2) rota em `App.tsx`, (3) `ROTA_PERMISSAO` + `TODAS_PERMISSOES` + `NAV_ITEMS` em `AdminLayout.tsx`, (4) `UPDATE admin_perfis SET permissoes = permissoes || '{nova-permissao}';`
- Atualizar este CLAUDE.md ao final de cada sessão com implementações relevantes.
