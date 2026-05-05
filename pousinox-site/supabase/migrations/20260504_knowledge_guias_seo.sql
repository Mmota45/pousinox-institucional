-- Migration: INSERT estudo SEO completo na base de conhecimento
-- Data: 2026-05-04

INSERT INTO knowledge_guias (titulo, categoria, nivel, o_que_e, quando_usar, como_fazer, onde_fazer, por_que, ativo)
VALUES (
  'Auditoria SEO — Páginas Públicas pousinox.com.br (Mai/2026)',
  'comercial',
  'avancado',

  -- o_que_e
  'Revisão completa de SEO on-page de todas as páginas públicas do site pousinox.com.br, cobrindo 15+ páginas indexáveis. Analisa: títulos, meta descriptions, hierarquia de headings (H1→H2→H3), keywords customizadas, schemas estruturados (LocalBusiness, Product, FAQ, BlogPosting, BreadcrumbList), Open Graph, Twitter Cards, geo tags, alt text de imagens, CTAs (WhatsApp/formulário), links internos, sitemap.xml e robots.txt.

Score geral do site: 8/10 — fundação sólida com lacunas em schemas de detalhe e keywords por página.

Componente SEO global (src/components/SEO/SEO.tsx): title dinâmico com sufixo "| POUSINOX® Pouso Alegre", meta description obrigatória, keywords default com 12 termos, canonical automático, OG completo, Twitter Cards, geo tags BR-MG, LocalBusiness schema com AggregateRating 4.9 e OfferCatalog, suporte a extraSchema por página.',

  -- quando_usar
  'Consultar este guia quando:
- Criar nova página pública — seguir checklist SEO
- Otimizar página existente — verificar score e lacunas
- Adicionar schema estruturado — saber quais páginas já têm e quais faltam
- Planejar conteúdo — entender quais keywords estão cobertas
- Responder perguntas sobre SEO do site
- Priorizar melhorias de SEO por impacto',

  -- como_fazer
  'SCORES POR PÁGINA:

/ (Home) — 9/10
✓ H1 keyword, meta desc, headings H1>H2>H3 (8 H2s), FAQ schema (5 FAQs), links internos, 2 CTAs WhatsApp, alt text
✗ Keywords default (deveria ter customizadas)

/produtos — 7/10
✓ H1, meta desc, alt dinamico
✗ Sem Product/ItemList schema, keywords default, sem BreadcrumbList

/sobre — 8/10
✓ H1 dinamico CMS, title 63 chars, meta 160 chars, headings corretos, alt imagem fachada
✗ Sem FAQ schema (poderia ter 3), keywords default

/contato — 7/10
✓ H1, title, meta desc, CTAs WhatsApp + formulario
✗ Sem ContactPage schema, keywords default

/blog — 8/10
✓ H1, meta desc, title/desc dinamicos por post
⚠ H1 aparece em 3 lugares (garantir 1 por vez)
✗ Sem BlogPosting schema em posts, keywords default

/servicos/corte-laser — 8/10
✓ H1, title 60 chars, meta desc, headings corretos
✗ Sem Service schema, keywords default

/segmentos/:slug — 8/10
✓ H1/title/desc dinamicos, FAQ schema (2 dinamicas), CTA WhatsApp
✗ Keywords default, sem BreadcrumbList

/pronta-entrega — 8/10
✓ H1 longo com keywords, title com localizacao, alt dinamico
⚠ Meta desc ~200 chars (cortar para 160)
✗ Sem Product/ItemList schema

/fixador-porcelanato — 9/10 ★
✓ H1 dinamico, Product schema com AggregateOffer, FAQ, headings perfeitos, alt, CTA

/fixador-porcelanato/calculadora — 10/10 ★★
✓ H1, title com keyword "Quantos Fixadores por m2", FAQ schema (10), Product schema, WebApplication schema, keywords customizadas, alt dinamico

/fixador-porcelanato/ensaios — 8/10
✓ H1, title, headings H1>H2>H3
✗ Keywords default

/fixador-porcelanato/normas — 8/10
✓ H1, title, links internos
✗ Keywords default

/fixador-porcelanato/orcamento — 7/10
✓ H1, CTA WhatsApp + form, links uteis
✗ Keywords default, sem schema

/produto/:id — 7/10
✓ H1/title/desc dinamicos, alt, produtos relacionados
✗ Sem Product schema (ALTO IMPACTO), sem BreadcrumbList

/privacidade — 6/10
✓ H1, title
⚠ Inline styles nos headings
✗ Keywords default (ok para privacidade)

SITEMAP (25 URLs):
✓ Prioridades corretas (home=1.0, calculadora=0.95)
⚠ lastmod maioria 2026-03-25 — atualizar
✗ /produto/:id nao esta no sitemap
✗ /fixador-porcelanato redireciona mas esta no sitemap

TOP 10 MELHORIAS POR IMPACTO:
1. ▲ Product schema em /produto/:id
2. ▲ BlogPosting schema em posts do blog
3. ▲ BreadcrumbList em paginas de detalhe (produto, segmento, blog)
4. ◆ Keywords customizadas por pagina (11 paginas usam default)
5. ◆ Sitemap dinamico com /produto/:id e /blog/:slug
6. ◆ Service schema em Corte a Laser
7. ◆ ItemList schema em listagens (Produtos, Outlet)
8. ◆ Meta description Outlet — cortar para 160 chars
9. ▼ Garantir 1 H1 unico no Blog
10. ▼ Atualizar lastmod do sitemap',

  -- onde_fazer
  'Arquivos-chave:
- src/components/SEO/SEO.tsx — componente global SEO (editar keywords default, schemas)
- src/pages/*.tsx — cada página pública (adicionar extraSchema, keywords custom)
- public/sitemap.xml — adicionar URLs dinâmicas
- public/robots.txt — ok, sem mudanças necessárias

Para adicionar schema em uma página:
<SEO title="..." description="..." path="/rota" keywords="termo1, termo2" extraSchema={[{ "@context": "https://schema.org", "@type": "Product", ... }]} />',

  -- por_que
  'SEO bem estruturado aumenta a visibilidade orgânica no Google. As maiores lacunas (schemas de Product e BlogPosting) são sinais ricos que o Google usa para rich snippets — estrelas, preços, FAQ expandível nos resultados de busca. Keywords customizadas por página evitam canibalização e melhoram a relevância. Sitemap dinâmico garante que novos produtos e posts sejam indexados automaticamente. O site já tem uma base sólida (8/10) — implementar as 10 melhorias pode elevar para 9.5/10.',

  true
)
ON CONFLICT DO NOTHING;
