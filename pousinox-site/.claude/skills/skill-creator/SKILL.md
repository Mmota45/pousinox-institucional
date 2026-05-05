---
description: Meta-skill que cria novas skills a partir de uma descrição
---

# Skill Creator

Crie novas skills (habilidades) para o Claude Code a partir de uma descrição do usuário.

## 1. Entender a necessidade
Pergunte ao usuário:
- O que a skill deve fazer? (tarefa principal)
- Quando será usada? (trigger/contexto)
- Qual o output esperado? (relatório, código, texto, ação)
- Precisa de acesso a: banco Supabase / APIs externas / arquivos locais / git?
- Frequência: diária / semanal / sob demanda?

## 2. Classificar a skill
| Categoria | Exemplos |
|---|---|
| DevOps | Deploy, teste, monitoramento |
| Comercial | Vendas, pipeline, follow-up |
| Marketing | Conteúdo, SEO, ads, social |
| Operacional | Produção, estoque, qualidade |
| Análise | Relatórios, métricas, BI |
| IA/Prompt | Prompts, templates, chains |

## 3. Gerar o arquivo SKILL.md

Estrutura obrigatória:
```markdown
---
description: [descrição curta — usada pelo Claude para identificar quando usar]
---

# [Nome da Skill]

[1 linha explicando o que faz]

## 1. [Primeiro passo]
- ...

## 2. [Segundo passo]
- ...

## N. Formato de entrega
[template do output]
```

### Regras de criação
- Frontmatter `description` é OBRIGATÓRIO (sem isso o Claude não reconhece)
- Nome do arquivo: sempre `SKILL.md` (maiúsculo)
- Pasta: `.claude/skills/nome-da-skill/SKILL.md`
- Nome da pasta = comando slash (ex: pasta `meta-ads` → `/meta-ads`)
- Máximo 200 linhas (skills longas demais perdem foco)
- Incluir contexto Pousinox quando relevante
- Sempre ter seção de formato de entrega (output previsível)
- Steps numerados e claros
- Incluir integrações com outras skills quando fizer sentido

## 4. Validar
Checklist antes de salvar:
- [ ] Tem frontmatter com `description`?
- [ ] Nome da pasta é kebab-case sem acentos?
- [ ] Steps são claros e sequenciais?
- [ ] Output tem formato definido?
- [ ] Não duplica skill existente?
- [ ] Tamanho razoável (50-150 linhas ideal)?

## 5. Salvar e registrar
- Criar pasta em `.claude/skills/[nome]/`
- Salvar como `SKILL.md`
- Commitar com mensagem: `feat: skill /[nome] — [descrição curta]`
- Informar ao usuário: "Reinicie o Claude Code para ativar a skill"

## 6. Skills existentes (não duplicar)
Consultar lista em CLAUDE.md ou rodar:
```
ls .claude/skills/
```

Categorias atuais: DevOps, Segurança, Performance, Código, SEO/Marketing, Comercial, Prompt Engineering, Relatórios
