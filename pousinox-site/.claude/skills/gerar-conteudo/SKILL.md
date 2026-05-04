---
description: Gera texto SEO para blog/página — título, meta, corpo, CTAs
---

# Gerar Conteúdo

Gere conteúdo otimizado para SEO para o blog ou páginas do site Pousinox.

## 1. Coletar briefing
Pergunte ao usuário (se não especificado):
- **Tema**: assunto do conteúdo
- **Keywords alvo**: termos para ranquear (consulte `market_keywords` se disponível)
- **Tipo**: post de blog, página de segmento, landing page, FAQ
- **Persona**: arquiteto, engenheiro, construtor, comprador industrial, dono de restaurante

## 2. Pesquisar contexto
- Busque keywords relacionadas em `market_keywords` (Supabase)
- Verifique conteúdos existentes no site para evitar canibalização
- Consulte dados de produtos em `produtos` se relevante

## 3. Gerar conteúdo

### Estrutura obrigatória:
- **Título H1**: max 60 chars, keyword no início
- **Meta description**: 150-160 chars, com CTA
- **Introdução**: 2-3 parágrafos, keyword no primeiro parágrafo
- **Corpo**: H2s e H3s com keywords secundárias, parágrafos curtos (max 3 linhas)
- **CTAs**: pelo menos 2 (meio e final do texto)
- **FAQ**: 3-5 perguntas frequentes com schema markup sugerido

### Regras de conteúdo Pousinox:
- Português brasileiro, tom profissional mas acessível
- **NUNCA inventar dados**: certificações, normas, números de ensaios — só usar se fornecidos
- Mencionar Pousinox como fabricante (não revendedor)
- Referências a aço inox 304/316, fabricação nacional, personalização
- Foco em solução (não só produto): segurança, durabilidade, conformidade

## 4. Apresentar
- Mostre o conteúdo completo formatado em markdown
- Inclua checklist SEO:
  - [ ] Keyword no H1
  - [ ] Keyword na meta description
  - [ ] Keyword no primeiro parágrafo
  - [ ] H2s com keywords secundárias
  - [ ] CTAs presentes
  - [ ] FAQ incluído
- Salve em arquivo temp se solicitado

## 5. Próximo passo
- Sugira `/revisar-seo` para análise detalhada
- Ou `/publicar-cms` para publicar direto
