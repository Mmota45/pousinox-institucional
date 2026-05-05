---
description: Gerar FAQ coerente com posicionamento — cria perguntas e insere no banco site_faq
---

# Gerar FAQ

Cria perguntas frequentes coerentes com o posicionamento atual da Pousinox e insere na tabela `site_faq` do Supabase.

## Quando usar

- Após desativar FAQs incoerentes
- Ao lançar nova página ou segmento
- Para reforçar SEO com perguntas de cauda longa

## Contexto obrigatório antes de gerar

1. Consultar portfólio real (`/consultar-portfolio` ou `segmentos.ts`)
2. Verificar FAQs já ativas no banco para evitar duplicidade
3. Identificar o **destino**: Home (fábrica geral), fixador (landing page), segmento específico

## Regras de geração

### Posicionamento (respeitar hierarquia)
- **Home**: fábrica sob medida > segmentos > materiais > processo > atendimento
- **Fixador**: funcionamento > norma > instalação > preço > comparação
- **Segmento**: produtos específicos > benefícios > processo > prazo

### Qualidade
- Perguntas em linguagem natural (como o usuário pesquisaria no Google)
- Respostas entre 40-150 palavras
- Tom profissional, 1ª pessoa do plural ("fabricamos", "atendemos")
- Sem jargão inexplicado
- Sem keyword stuffing
- Cada resposta deve conter pelo menos 1 keyword relevante

### Proibições
- Não criar perguntas que ninguém faria ("FAQ forçado")
- Não misturar temas (fixador na Home, fábrica no fixador)
- Não duplicar perguntas já existentes no banco
- Não prometer algo que a empresa não faz

## Estrutura da tabela `site_faq`

```sql
site_faq (
  id BIGINT PRIMARY KEY,
  pergunta TEXT NOT NULL,
  resposta TEXT NOT NULL,
  ordem INT DEFAULT 99,
  ativo BOOLEAN DEFAULT true,
  pagina TEXT DEFAULT 'home',  -- 'home' | 'fixador' | 'segmento:slug'
  created_at TIMESTAMPTZ
)
```

## Fluxo de execução

1. Perguntar ao usuário: **destino** (home/fixador/segmento) e **quantidade** (default: 5)
2. Consultar FAQs ativas no destino para evitar duplicidade
3. Gerar as perguntas + respostas seguindo as regras acima
4. Apresentar ao usuário para aprovação (tabela com pergunta, resposta, ordem)
5. Após aprovação, inserir no banco via `supabaseAdmin`
6. Confirmar inserção com IDs criados

## Formato de apresentação (antes de inserir)

```
| # | Pergunta | Resposta (resumo) | Ordem |
|---|----------|-------------------|-------|
| 1 | ...      | ...               | 1     |
```

**Aguardar confirmação do usuário antes de inserir no banco.**

## Exemplo de uso

```
/gerar-faq home 4
→ Gera 4 perguntas para a Home, apresenta, aguarda OK, insere no banco
```
