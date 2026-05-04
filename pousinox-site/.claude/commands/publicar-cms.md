---
description: Publica conteúdo no AdminConteudo via Supabase
---

# Publicar CMS

Publique conteúdo gerado no sistema de conteúdo do site.

## 1. Receber conteúdo
- Use o conteúdo da conversa atual (de `/gerar-conteudo` ou `/revisar-seo`)
- Ou peça o conteúdo ao usuário

## 2. Preparar dados
- Extraia: título, slug (gerado do título), meta description, corpo, categoria, tags
- Gere slug: lowercase, sem acentos, hífens no lugar de espaços
- Valide campos obrigatórios

## 3. Confirmar com o usuário
Mostre preview:
```
📝 Publicar no CMS

Título: [título]
Slug: /blog/[slug]
Meta: [meta description]
Categoria: [categoria]
Tags: [tag1, tag2, ...]
Status: rascunho

Corpo: [primeiras 3 linhas...]

Confirmar publicação?
```

## 4. Inserir no Supabase
- Tabela: verificar a tabela de conteúdo existente (consultar AdminConteudo)
- Inserir com `status: 'rascunho'` (segurança — não publica direto)
- Reportar ID e URL de preview

## 5. Resultado
```
✅ Conteúdo salvo como rascunho

ID: [id]
URL: pousinox.com.br/blog/[slug]
Status: Rascunho — acesse /admin/conteudo para revisar e publicar
```
