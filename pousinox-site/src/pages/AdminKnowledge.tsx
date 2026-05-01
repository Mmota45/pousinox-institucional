import { useState, useCallback, useEffect } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminKnowledge.module.css'

type Categoria = 'sql' | 'frontend' | 'backend' | 'deploy' | 'git' | 'sites' | 'apps' | 'lgpd'
type Nivel = 'iniciante' | 'intermediario' | 'avancado'

interface Guia {
  id: string
  titulo: string
  categoria: Categoria
  nivel: Nivel
  tags: string[]
  oQueE: string
  quandoUsar: string
  comoFazer: string
  ondeFazer: string
  porQue: string
  rascunho?: boolean
}

interface GuiaDinamico extends Guia {
  rascunho: boolean
  criadoEm: string
}

const CATEGORIAS: { value: Categoria | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'sql', label: 'SQL/Banco' },
  { value: 'frontend', label: 'Frontend' },
  { value: 'backend', label: 'Backend/API' },
  { value: 'deploy', label: 'Deploy' },
  { value: 'git', label: 'Git' },
  { value: 'sites', label: 'Criação de Sites' },
  { value: 'apps', label: 'Apps' },
  { value: 'lgpd', label: 'LGPD/Compliance' },
]

const NIVEL_LABEL: Record<Nivel, string> = {
  iniciante: '\uD83D\uDFE2 Iniciante',
  intermediario: '\uD83D\uDFE1 Intermediário',
  avancado: '\uD83D\uDD34 Avançado',
}

const NIVEL_CLASS: Record<Nivel, string> = {
  iniciante: 'badgeIniciante',
  intermediario: 'badgeIntermediario',
  avancado: 'badgeAvancado',
}

const GUIAS: Guia[] = [
  // SQL/Banco
  {
    id: 'criar-tabela',
    titulo: 'Como criar uma tabela no Supabase',
    categoria: 'sql',
    nivel: 'iniciante',
    tags: ['supabase', 'sql', 'tabela', 'create table', 'rls'],
    oQueE: 'Uma tabela é a estrutura básica de armazenamento de dados no banco PostgreSQL do Supabase. Cada tabela tem colunas (campos) e linhas (registros).',
    quandoUsar: 'Sempre que você precisa armazenar um novo tipo de dado no sistema. Ex: cadastrar fornecedores, ordens de produção, logs de atividade.',
    comoFazer: `-- Exemplo: tabela de fornecedores
CREATE TABLE fornecedores (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome TEXT NOT NULL,
  cnpj TEXT UNIQUE,
  email TEXT,
  telefone TEXT,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

-- Sempre adicionar RLS para tabelas admin
ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only"
  ON fornecedores
  USING (auth.role() = 'service_role');

-- Trigger para atualizar atualizado_em automaticamente
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON fornecedores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();`,
    ondeFazer: 'Supabase Dashboard > SQL Editor. Cole o SQL e execute. Ou crie um arquivo em supabase/migrations/ para versionar.',
    porQue: 'O banco de dados é a fundação do sistema. Sem tabelas bem definidas, o frontend não consegue salvar nem consultar dados. RLS garante segurança.',
  },
  {
    id: 'cron-job',
    titulo: 'Como criar um cron job (tarefa agendada)',
    categoria: 'sql',
    nivel: 'intermediario',
    tags: ['cron', 'pg_cron', 'pg_net', 'agendamento', 'automatização'],
    oQueE: 'Um cron job é uma tarefa que roda automaticamente em intervalos regulares no banco de dados, usando a extensão pg_cron do Supabase.',
    quandoUsar: 'Para tarefas periódicas como: recalcular scores RFM diariamente, limpar registros antigos, enviar notificações agendadas.',
    comoFazer: `-- Habilitar extensão (se ainda não estiver)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Exemplo: recalcular RFM todo dia às 3h
SELECT cron.schedule(
  'rfm-diario',           -- nome do job
  '0 3 * * *',            -- cron expression: 3h todo dia
  $$SELECT fn_calcular_rfm()$$  -- comando SQL
);

-- Ver jobs agendados
SELECT * FROM cron.job;

-- Remover um job
SELECT cron.unschedule('rfm-diario');

-- Ver histórico de execuções
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC LIMIT 20;`,
    ondeFazer: 'Supabase Dashboard > SQL Editor. Precisa que pg_cron esteja habilitado em Database > Extensions.',
    porQue: 'Automatiza tarefas repetitivas sem precisar de servidor externo. O banco faz tudo sozinho no horário certo.',
  },
  {
    id: 'rpc-function',
    titulo: 'Como criar uma RPC/Function no banco',
    categoria: 'sql',
    nivel: 'intermediario',
    tags: ['function', 'rpc', 'plpgsql', 'supabase', 'stored procedure'],
    oQueE: 'Uma function (ou RPC) é um bloco de código SQL que roda dentro do banco. Você chama pelo frontend com supabaseAdmin.rpc("nome_funcao").',
    quandoUsar: 'Quando precisa de lógica complexa que seria lenta ou insegura no frontend. Ex: calcular scores, buscar dados agregados, operações em lote.',
    comoFazer: `-- Exemplo: função que retorna top prospects por score
CREATE OR REPLACE FUNCTION fn_top_prospects(
  n INTEGER DEFAULT 50,
  filtro_uf TEXT DEFAULT NULL
)
RETURNS TABLE (
  id BIGINT,
  nome TEXT,
  cnpj TEXT,
  uf TEXT,
  score NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER  -- roda com permissões do owner
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.nome, p.cnpj, p.uf,
    COALESCE(p.score_total, 0) AS score
  FROM prospeccao p
  WHERE (filtro_uf IS NULL OR p.uf = filtro_uf)
    AND p.ativo = true
  ORDER BY score DESC
  LIMIT n;
END;
$$;

-- Dar permissão para o service_role chamar
GRANT EXECUTE ON FUNCTION fn_top_prospects TO service_role;

-- Chamar no frontend:
-- const { data } = await supabaseAdmin.rpc('fn_top_prospects', { n: 50, filtro_uf: 'MG' })`,
    ondeFazer: 'Supabase Dashboard > SQL Editor. Ou em arquivo de migration.',
    porQue: 'Functions rodam direto no banco, muito mais rápidas que buscar tudo no frontend e processar. SECURITY DEFINER garante que a lógica tem as permissões certas.',
  },
  {
    id: 'criar-indice',
    titulo: 'Como criar um índice no banco',
    categoria: 'sql',
    nivel: 'intermediario',
    tags: ['índice', 'performance', 'consulta', 'otimização'],
    oQueE: 'Um índice é como um "sumário" que o banco cria para encontrar dados mais rápido. Sem índice, o banco precisa ler TODAS as linhas da tabela.',
    quandoUsar: 'Quando uma consulta está lenta, especialmente em tabelas grandes (>10K linhas). Consultas com WHERE, JOIN ou ORDER BY se beneficiam de índices.',
    comoFazer: `-- Criar índice SEM travar a tabela (sempre usar CONCURRENTLY)
CREATE INDEX CONCURRENTLY idx_prospeccao_uf
  ON prospeccao (uf);

-- Índice composto (2+ colunas)
CREATE INDEX CONCURRENTLY idx_prospeccao_uf_segmento
  ON prospeccao (uf, segmento);

-- Índice parcial (só para registros ativos)
CREATE INDEX CONCURRENTLY idx_prospeccao_ativo
  ON prospeccao (uf) WHERE ativo = true;

-- Ver índices existentes de uma tabela
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'prospeccao';

-- Remover índice desnecessário
DROP INDEX IF EXISTS idx_prospeccao_uf;`,
    ondeFazer: 'Supabase Dashboard > SQL Editor. Usar CONCURRENTLY para não travar o banco durante a criação.',
    porQue: 'Sem índice, consultas em tabelas com 800K+ registros (como prospecção) podem levar segundos. Com índice, caem para milissegundos.',
  },
  {
    id: 'migration',
    titulo: 'Como fazer uma migration',
    categoria: 'sql',
    nivel: 'iniciante',
    tags: ['migration', 'versionamento', 'sql', 'supabase'],
    oQueE: 'Uma migration é um arquivo SQL versionado que documenta mudanças no banco. Fica em supabase/migrations/ com timestamp no nome.',
    quandoUsar: 'Sempre que você muda a estrutura do banco: criar tabela, adicionar coluna, criar function. Isso garante que as mudanças são rastreadas e reproduzíveis.',
    comoFazer: `-- 1. Criar arquivo com timestamp
-- Nome: supabase/migrations/20260501_nova_feature.sql

-- 2. Escrever o SQL da mudança
CREATE TABLE minha_tabela (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome TEXT NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE minha_tabela ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only"
  ON minha_tabela USING (auth.role() = 'service_role');

-- 3. Executar no SQL Editor do Supabase
-- 4. Commitar o arquivo no Git`,
    ondeFazer: 'Crie o arquivo .sql na pasta supabase/migrations/. Execute o conteúdo no SQL Editor. Depois faça commit no Git.',
    porQue: 'Sem migrations, você perde o histórico de mudanças do banco. Se precisar recriar o banco ou revisar o que mudou, as migrations são essenciais.',
  },

  // Frontend
  {
    id: 'componente-react',
    titulo: 'Como criar um componente React',
    categoria: 'frontend',
    nivel: 'iniciante',
    tags: ['react', 'componente', 'typescript', 'props', 'estado'],
    oQueE: 'Um componente React é uma função TypeScript que retorna HTML (JSX). É a unidade básica de construção da interface.',
    quandoUsar: 'Sempre que você precisa de um pedaço reutilizável de interface. Ex: um botão customizado, um card de produto, um formulário.',
    comoFazer: `// src/components/MeuComponente/MeuComponente.tsx

import { useState } from 'react'
import styles from './MeuComponente.module.css'

interface MeuComponenteProps {
  titulo: string
  valor?: number
  onChange?: (novoValor: number) => void
}

export default function MeuComponente({ titulo, valor = 0, onChange }: MeuComponenteProps) {
  const [count, setCount] = useState(valor)

  function incrementar() {
    const novo = count + 1
    setCount(novo)
    onChange?.(novo)
  }

  return (
    <div className={styles.card}>
      <h3>{titulo}</h3>
      <p>Contagem: {count}</p>
      <button onClick={incrementar}>+1</button>
    </div>
  )
}`,
    ondeFazer: 'Crie o arquivo .tsx dentro de src/components/ (se reutilizável) ou src/pages/ (se for página). Sempre acompanhado do .module.css.',
    porQue: 'Componentes permitem reutilizar interface e lógica. Em vez de copiar HTML, você importa o componente onde precisar.',
  },
  {
    id: 'pagina-admin',
    titulo: 'Como criar uma página admin (módulo completo)',
    categoria: 'frontend',
    nivel: 'intermediario',
    tags: ['admin', 'módulo', 'rota', 'permissão', 'nav'],
    oQueE: 'Um módulo admin é uma página completa dentro do painel administrativo, com rota própria, permissão de acesso e item no menu lateral.',
    quandoUsar: 'Quando você precisa de uma nova área no admin. Ex: gestão de fornecedores, controle de qualidade, novo relatório.',
    comoFazer: `// 1. Criar o componente: src/pages/AdminNovo.tsx
import styles from './AdminNovo.module.css'

export default function AdminNovo() {
  return (
    <div className={styles.container}>
      <h2>Novo Módulo</h2>
    </div>
  )
}

// 2. Criar o CSS: src/pages/AdminNovo.module.css

// 3. Adicionar rota em App.tsx:
// import AdminNovo from './pages/AdminNovo'
// <Route path="novo" element={<AdminNovo />} />

// 4. Em AdminLayout.tsx:
// - Adicionar em ROTA_PERMISSAO: novo: 'novo'
// - Adicionar 'novo' em TODAS_PERMISSOES
// - Adicionar item em NAV_ITEMS com ícone SVG

// 5. Dar permissão no banco:
// UPDATE admin_perfis SET permissoes = permissoes || '{novo}';`,
    ondeFazer: 'Arquivo .tsx em src/pages/, rota em App.tsx, permissões em AdminLayout.tsx, SQL no Supabase.',
    porQue: 'Seguir esse padrão garante que o módulo terá controle de acesso, aparecerá no menu e será consistente com os outros módulos.',
  },
  {
    id: 'css-modules',
    titulo: 'CSS Modules - como funciona',
    categoria: 'frontend',
    nivel: 'iniciante',
    tags: ['css', 'módulos', 'estilos', 'classes'],
    oQueE: 'CSS Modules é um sistema onde cada arquivo .module.css gera classes únicas automaticamente. Isso evita conflito de nomes entre componentes.',
    quandoUsar: 'Sempre que criar um componente ou página. É o padrão do projeto Pousinox.',
    comoFazer: `/* MeuComponente.module.css */
.container {
  padding: 24px;
  max-width: 800px;
}

.titulo {
  color: #1a3a5c;
  font-size: 1.4rem;
}

.card {
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  padding: 16px;
}

/* No componente: */
// import styles from './MeuComponente.module.css'
// <div className={styles.container}>
// <h2 className={styles.titulo}>Titulo</h2>
// <div className={styles.card}>conteúdo</div>

/* Para classes adicionadas via JS puro (body.classList.add): */
/* usar :global(.minhaClasse) { ... } */`,
    ondeFazer: 'Crie o arquivo .module.css ao lado do .tsx. Importe como "styles" no componente.',
    porQue: 'Sem CSS Modules, classes como .container ou .card de componentes diferentes podem conflitar. Com Modules, cada classe é única.',
  },
  {
    id: 'searchable-select',
    titulo: 'Como usar o SearchableSelect',
    categoria: 'frontend',
    nivel: 'iniciante',
    tags: ['select', 'dropdown', 'busca', 'componente', 'filtro'],
    oQueE: 'SearchableSelect é um componente dropdown com campo de busca integrado. Substitui o <select> nativo com melhor UX.',
    quandoUsar: 'Em formulários onde há muitas opções (UFs, segmentos, fornecedores). Permite digitar para filtrar.',
    comoFazer: `import SearchableSelect from '../components/SearchableSelect/SearchableSelect'

// Opções no formato { value, label }
const opcoes = [
  { value: 'MG', label: 'Minas Gerais' },
  { value: 'SP', label: 'São Paulo' },
  { value: 'RJ', label: 'Rio de Janeiro' },
]

// Uso básico
<SearchableSelect
  value={ufSelecionada}
  onChange={setUfSelecionada}
  options={opcoes}
  placeholder="Selecione a UF"
  searchPlaceholder="Buscar estado..."
  minWidth={200}
/>

// O componente:
// - Filtra opções conforme digita
// - Highlight na opção selecionada
// - Botão X para limpar seleção
// - Fecha ao clicar fora`,
    ondeFazer: 'Importe de src/components/SearchableSelect/SearchableSelect.tsx e passe as props necessárias.',
    porQue: 'O select nativo do HTML é limitado: não tem busca, não tem estilo customizável. SearchableSelect resolve isso com uma UX moderna.',
  },

  // Backend/API
  {
    id: 'edge-function',
    titulo: 'Como criar uma Edge Function',
    categoria: 'backend',
    nivel: 'intermediario',
    tags: ['deno', 'edge function', 'supabase', 'api', 'serverless'],
    oQueE: 'Uma Edge Function é um pedaço de código que roda no servidor do Supabase (Deno). Usado para lógica que não pode ficar no frontend (chaves secretas, processamento pesado).',
    quandoUsar: 'Para integrações com APIs externas (Z-API, Brave, Gemini), processamento de PDF, validações server-side.',
    comoFazer: `// supabase/supabase/functions/minha-funcao/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req: Request) => {
  // Tratar preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { acao, dados } = await req.json()

    if (acao === 'processar') {
      // Acessar secrets do Supabase
      const apiKey = Deno.env.get('MINHA_API_KEY')

      // Sua lógica aqui
      const resultado = { ok: true, processado: dados }

      return new Response(JSON.stringify(resultado), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Ação inválida' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// Chamar no frontend:
// const { data } = await supabaseAdmin.functions.invoke('minha-funcao', {
//   body: { acao: 'processar', dados: { nome: 'teste' } }
// })`,
    ondeFazer: 'Criar pasta em supabase/supabase/functions/nome-funcao/ com index.ts. Deploy com: supabase functions deploy nome-funcao.',
    porQue: 'O frontend é público - qualquer pessoa pode ver o código. Chaves de API, lógica de segurança e processamento pesado devem ficar no servidor.',
  },
  {
    id: 'supabase-api',
    titulo: 'Como chamar a API do Supabase (CRUD)',
    categoria: 'backend',
    nivel: 'iniciante',
    tags: ['supabase', 'select', 'insert', 'update', 'delete', 'rpc', 'api'],
    oQueE: 'O cliente Supabase (@supabase/supabase-js) permite fazer operações no banco diretamente do frontend: buscar, inserir, atualizar e deletar dados.',
    quandoUsar: 'Sempre que precisar ler ou escrever dados no banco. É a forma padrão de interagir com o Supabase no projeto.',
    comoFazer: `import { supabaseAdmin } from '../lib/supabase'

// SELECT - buscar dados
const { data, error } = await supabaseAdmin
  .from('fornecedores')
  .select('id, nome, cnpj, ativo')
  .eq('ativo', true)
  .order('nome')

// SELECT com filtros
const { data } = await supabaseAdmin
  .from('prospeccao')
  .select('*')
  .eq('uf', 'MG')
  .gte('score_total', 7)
  .limit(50)

// INSERT - inserir registro
const { data, error } = await supabaseAdmin
  .from('fornecedores')
  .insert({ nome: 'Aços Silva', cnpj: '12345678000100' })
  .select()
  .single()

// UPDATE - atualizar registro
const { error } = await supabaseAdmin
  .from('fornecedores')
  .update({ ativo: false })
  .eq('id', 42)

// DELETE - remover registro
const { error } = await supabaseAdmin
  .from('fornecedores')
  .delete()
  .eq('id', 42)

// RPC - chamar function do banco
const { data } = await supabaseAdmin
  .rpc('fn_top_prospects', { n: 50 })`,
    ondeFazer: 'Em qualquer componente React. Importe supabaseAdmin de src/lib/supabase.ts. Para tabelas públicas, use supabase (sem Admin).',
    porQue: 'O Supabase gera uma API REST automaticamente para cada tabela. O cliente JS facilita as chamadas com tipagem e filtros encadeados.',
  },
  {
    id: 'zapi-whatsapp',
    titulo: 'Como usar a Z-API (WhatsApp)',
    categoria: 'backend',
    nivel: 'avancado',
    tags: ['zapi', 'whatsapp', 'mensagem', 'validação', 'api'],
    oQueE: 'A Z-API é o serviço usado para integrar WhatsApp no sistema. Permite verificar se um número tem WhatsApp e enviar mensagens.',
    quandoUsar: 'Para validar números de telefone de prospects (verificar se aceitam WhatsApp) e para envio de mensagens automatizadas.',
    comoFazer: `// Edge function: supabase/supabase/functions/validar-whatsapp/index.ts

// Verificar se número tem WhatsApp
const response = await fetch(
  \`https://api.z-api.io/instances/\${INSTANCE_ID}/token/\${TOKEN}/phone-exists/\${telefone}\`,
  {
    method: 'GET',
    headers: { 'Client-Token': CLIENT_TOKEN }
  }
)
const result = await response.json()
// result.exists = true/false

// IMPORTANTE: Rate limit de 600ms entre chamadas
// Em lote, processar no máximo 50 por vez com delay

// Secrets necessárias no Supabase:
// ZAPI_INSTANCE_ID
// ZAPI_TOKEN
// ZAPI_CLIENT_TOKEN

// Chamar do frontend:
// await supabaseAdmin.functions.invoke('validar-whatsapp', {
//   body: { acao: 'check', telefone: '5535999998888' }
// })`,
    ondeFazer: 'Toda integração Z-API deve ficar em Edge Functions (nunca no frontend). As chaves ficam como secrets do Supabase.',
    porQue: 'As chaves da Z-API dão acesso total à sua conta WhatsApp Business. Se ficarem no frontend, qualquer pessoa pode usá-las.',
  },

  // Deploy
  {
    id: 'deploy-cloudflare',
    titulo: 'Como fazer deploy no Cloudflare Pages',
    categoria: 'deploy',
    nivel: 'iniciante',
    tags: ['cloudflare', 'deploy', 'build', 'wrangler', 'produção'],
    oQueE: 'Cloudflare Pages hospeda o site estático (HTML/CSS/JS) gerado pelo Vite. O deploy envia os arquivos da pasta dist/ para os servidores da Cloudflare.',
    quandoUsar: 'Após finalizar alterações e testar localmente. O deploy publica as mudanças no site pousinox.com.br.',
    comoFazer: `# 1. Build do projeto
npm run build

# 2. Deploy via script (recomendado)
npm run deploy
# Isso roda: ../scripts/deploy.sh

# 3. Ou deploy manual via wrangler
npx wrangler pages deploy dist/ --project-name pousinox-institucional

# 4. Verificar no Cloudflare Dashboard
# https://dash.cloudflare.com > Pages > pousinox-institucional

# Deploy automático (configurado):
# Push para branch main > Cloudflare auto-build > deploy`,
    ondeFazer: 'No terminal, na pasta pousinox-site/. Certifique-se de que o build não tem erros antes de fazer deploy.',
    porQue: 'O deploy é o que leva suas mudanças do computador local para o site acessível publicamente. Sem deploy, as alterações ficam só no seu PC.',
  },
  {
    id: 'deploy-edge-functions',
    titulo: 'Como fazer deploy de Edge Functions',
    categoria: 'deploy',
    nivel: 'iniciante',
    tags: ['supabase', 'edge function', 'deploy', 'deno'],
    oQueE: 'Deploy de Edge Functions envia o código Deno para os servidores do Supabase, tornando a função acessível via API.',
    quandoUsar: 'Após criar ou alterar uma Edge Function. Precisa fazer deploy para que as mudanças tenham efeito.',
    comoFazer: `# Deploy de uma função específica
cd ../supabase
supabase functions deploy minha-funcao --project-ref SEU_PROJECT_REF

# Deploy de todas as funções
supabase functions deploy --project-ref SEU_PROJECT_REF

# Adicionar secret (chave de API)
supabase secrets set MINHA_API_KEY=valor_da_chave --project-ref SEU_PROJECT_REF

# Listar secrets
supabase secrets list --project-ref SEU_PROJECT_REF

# Ver logs da função
supabase functions logs minha-funcao --project-ref SEU_PROJECT_REF`,
    ondeFazer: 'No terminal, na pasta supabase/. Precisa do CLI do Supabase instalado e estar logado (supabase login).',
    porQue: 'Edge Functions rodam no servidor. Se você não fizer deploy, o Supabase continua rodando a versão antiga do código.',
  },

  // Git
  {
    id: 'fluxo-git',
    titulo: 'Fluxo Git básico',
    categoria: 'git',
    nivel: 'iniciante',
    tags: ['git', 'commit', 'push', 'branch', 'merge', 'versionamento'],
    oQueE: 'Git é o sistema de versionamento que rastreia todas as mudanças no código. Cada "commit" é uma fotografia do estado do projeto naquele momento.',
    quandoUsar: 'Sempre. Todo trabalho deve ser commitado no Git. Antes de desligar o computador, antes de mudar de assunto, antes de fazer deploy.',
    comoFazer: `# Ver o que mudou
git status

# Ver diferença nos arquivos
git diff

# Adicionar arquivos para commit (específicos)
git add src/pages/AdminNovo.tsx src/pages/AdminNovo.module.css

# Criar commit com mensagem descritiva
git commit -m "feat: adicionar módulo AdminNovo com CRUD"

# Enviar para o GitHub
git push

# --- Branches ---

# Criar branch para feature nova
git checkout -b minha-feature

# Voltar para main
git checkout main

# Trazer mudanças da branch para main
git merge minha-feature

# --- Boas práticas ---
# Prefixos de commit:
# feat:  nova funcionalidade
# fix:   correção de bug
# chore: tarefas de manutenção
# docs:  documentação
# refactor: refatoração (sem mudar comportamento)`,
    ondeFazer: 'No terminal (Git Bash, VS Code terminal, Claude Code). Sempre na pasta raiz do projeto.',
    porQue: 'Sem Git você perde o histórico de mudanças. Se algo quebrar, você pode voltar para uma versão anterior. Além disso, o deploy depende do Git.',
  },
  {
    id: 'badge-dinamica',
    titulo: 'Como criar badges dinâmicas com dados do estado',
    categoria: 'frontend',
    nivel: 'iniciante',
    tags: ['badge', 'jsx', 'array', 'join', 'filter', 'estado', 'react'],
    oQueE: 'Badge é uma etiqueta visual que mostra informação resumida (ex: "MG · Sul/Sudoeste de Minas · POUSO ALEGRE"). Ela reflete o estado atual dos filtros ou dados selecionados.',
    quandoUsar: 'Sempre que tiver uma seção colapsável ou card onde o usuário precisa ver o resumo sem abrir. Exemplos: filtros salvos, status, contadores.',
    comoFazer: `// Exemplo real: badge do cron de prospecção
// cronConfig tem arrays: { uf: ['MG'], mesorregiao: ['Sul/Sudoeste de Minas'], cidade: ['POUSO ALEGRE'], segmento: [] }

// ERRADO - esquecendo um campo (cidade não aparece):
{[cronConfig.uf.join(','), cronConfig.mesorregiao.join(',')].filter(Boolean).join(' . ')}

// CERTO - incluir TODOS os campos relevantes:
{[
  cronConfig.uf.join(','),
  cronConfig.mesorregiao.join(','),
  cronConfig.cidade.join(','),       // <-- não esquecer!
  cronConfig.segmento.join(',')
].filter(Boolean).join(' . ')}
// Resultado: "MG . Sul/Sudoeste de Minas . POUSO ALEGRE"

// --- Como funciona ---
// 1. .join(',') converte array em string: ['MG','SP'] -> "MG,SP"
// 2. Se array vazio, .join(',') retorna "" (string vazia)
// 3. .filter(Boolean) remove strings vazias do array
// 4. .join(' . ') junta tudo com separador bonito

// --- Onde fica no JSX ---
<span className={styles.badge}>
  {temFiltro ? textoResumido : 'Todos'}
</span>

// --- Verificar se tem filtro ---
// Para arrays: verificar .length
{cronConfig.uf.length || cronConfig.cidade.length ? 'tem filtro' : 'Todos'}

// Para strings: verificar se nao e vazio
{filtro ? filtro : 'Todos'}`,
    ondeFazer: 'No arquivo .tsx do módulo, dentro do JSX. Geralmente no <summary> de um <details> (seção colapsável).',
    porQue: 'Sem a badge, o usuário precisa abrir a seção para ver o que está selecionado. Com a badge, a informação fica visível mesmo com a seção fechada.',
  },
  {
    id: 'admin-loading',
    titulo: 'Como usar o AdminLoading (spinner e progresso)',
    categoria: 'frontend',
    nivel: 'iniciante',
    tags: ['loading', 'spinner', 'progresso', 'componente', 'AdminLoading', 'useLoadingProgress'],
    oQueE: 'AdminLoading é o componente padrão para estados de carregamento no admin. Tem dois modos: spinner animado (sem %) e anel de progresso (com %).',
    quandoUsar: 'Sempre que o sistema estiver carregando dados, validando, fazendo upload/download. NUNCA usar texto "Carregando..." puro.',
    comoFazer: `// 1. Importar o componente
import AdminLoading from '../components/AdminLoading/AdminLoading'

// 2a. MODO SPINNER (sem progresso definido)
// Usa quando não sabe quantos passos faltam
{loading ? <AdminLoading /> : <ConteudoReal />}

// 2b. MODO PROGRESSO (com %)
// Usa quando sabe o total de passos
{loading ? <AdminLoading total={10} current={3} /> : <ConteudoReal />}
// Mostra: anel com "30%" no centro

// 2c. COM LABEL
<AdminLoading label="Validando números..." />
<AdminLoading total={50} current={25} label="Validando WhatsApp..." />

// --- Hook useLoadingProgress (para progresso automático) ---
import { useLoadingProgress } from '../hooks/useLoadingProgress'

// No componente:
const prog = useLoadingProgress()

// Ao carregar dados:
async function carregarDados() {
  prog.reset(3) // 3 passos no total

  const { data: clientes } = await supabaseAdmin.from('clientes').select('*')
  prog.step() // passo 1 concluído

  const { data: vendas } = await supabaseAdmin.from('vendas').select('*')
  prog.step() // passo 2 concluído

  const { data: pipeline } = await supabaseAdmin.from('pipeline_deals').select('*')
  prog.step() // passo 3 concluído (100%)
}

// No JSX:
{loading
  ? <AdminLoading total={prog.total} current={prog.current} label="Carregando dados..." />
  : <ConteudoReal />
}`,
    ondeFazer: 'Em qualquer arquivo .tsx de modulo admin. Importar de ../components/AdminLoading/AdminLoading.',
    porQue: 'O spinner animado dá feedback visual profissional ao usuário. O modo com % mostra exatamente quanto falta, evitando a sensação de "travou". É padrão do sistema - usar texto simples é proibido.',
  },
  // LGPD/Compliance
  {
    id: 'lgpd-prospeccao-b2b',
    titulo: 'LGPD: Como prospectar clientes B2B sem violar a lei',
    categoria: 'lgpd',
    nivel: 'intermediario',
    tags: ['lgpd', 'prospecção', 'whatsapp', 'b2b', 'opt-out', 'legítimo interesse', 'compliance'],
    oQueE: 'A LGPD (Lei 13.709/2018) regula o tratamento de dados pessoais no Brasil. Para prospecção B2B, a base legal mais adequada é o Legítimo Interesse (Art. 7º, IX). Dados públicos de CNPJ (Receita Federal) podem ser usados, mas telefone e e-mail de responsáveis são dados pessoais e precisam de tratamento adequado.',
    quandoUsar: 'Sempre que for enviar mensagens comerciais (WhatsApp, e-mail, ligação) para empresas que NÃO solicitaram contato. Isso inclui prospecção manual e qualquer automação.',
    comoFazer: `REGRAS OBRIGATÓRIAS:

1. OPT-OUT em toda mensagem:
   "Se não deseja receber comunicações, responda SAIR"

2. RESPEITAR quem pedir para sair:
   - Manter lista de bloqueio permanente no sistema
   - Nunca mais enviar para quem pediu opt-out

3. VOLUME CONTROLADO:
   - Máximo 10-20 contatos novos por dia
   - Nunca disparo em massa automatizado
   - Warm-up gradual: começar com 5/dia

4. DADOS PERMITIDOS (públicos):
   ✅ Razão social, CNPJ, endereço comercial
   ✅ Telefone comercial público
   ✅ Segmento de atuação

5. DADOS QUE EXIGEM CUIDADO:
   ⚠️ Telefone celular de sócio/responsável
   ⚠️ E-mail pessoal
   ⚠️ CPF de sócio

6. REGISTRO DO LEGÍTIMO INTERESSE:
   Documento interno justificando:
   - Por que o contato é relevante (segmento compatível)
   - Como os dados foram obtidos (fonte pública)
   - Medidas de mitigação (opt-out, volume limitado)

RISCOS DE DESCUMPRIMENTO:
⛔ Ban de WhatsApp (aconteceu conosco!)
⛔ Multa ANPD: até 2% do faturamento
⛔ Dano reputacional
⛔ Processo judicial do titular`,
    ondeFazer: 'A política de privacidade do site (/privacidade) já inclui seção 4.1 sobre prospecção B2B. O sistema deve respeitar a lista de bloqueio em prospect_bloqueio (futuro).',
    porQue: 'A Pousinox foi banida do WhatsApp por envio em massa automatizado. Prospecção B2B é legal e necessária, mas precisa ser feita com volume controlado, opt-out claro e respeito ao titular. Transparência e integridade são valores da empresa.',
  },
  {
    id: 'lgpd-whatsapp-limites',
    titulo: 'WhatsApp API: limites seguros para não ser banido',
    categoria: 'lgpd',
    nivel: 'iniciante',
    tags: ['whatsapp', 'z-api', 'ban', 'limites', 'rate limit', 'automação'],
    oQueE: 'O WhatsApp (Meta) monitora o comportamento de envio de mensagens. Contas que enviam muitas mensagens para números que não interagiram antes são classificadas como spam e banidas temporária ou permanentemente.',
    quandoUsar: 'Antes de configurar qualquer automação de WhatsApp: validação de números, envio de mensagens, cron jobs.',
    comoFazer: `LIMITES SEGUROS (baseados em experiência real):

VALIDAÇÃO DE NÚMEROS (phone-exists):
  ✅ Máximo 50 por dia (1 execução diária)
  ⛔ NÃO fazer a cada 5 minutos (causou ban!)
  ⛔ NÃO validar centenas de uma vez

ENVIO DE MENSAGENS (prospecção):
  ✅ Máximo 10-15 mensagens novas por dia
  ✅ Intervalo mínimo de 2-3 minutos entre envios
  ✅ Warm-up: começar com 5/dia, aumentar 5 por semana
  ⛔ NÃO enviar mais de 20/dia para contatos novos

CRON JOBS RECOMENDADOS:
  Validação: 1x/dia, lote de 50
    '0 3 * * 1-5' (3h da manhã, seg-sex)

  Prospecção: 1x/dia, lote de 10-15
    '0 9 * * 1-5' (9h da manhã, seg-sex)

BOAS PRÁTICAS OFICIAIS Z-API:
  ✅ Usar o número no celular de vez em quando (conversas reais)
  ✅ Participar de grupos no WhatsApp
  ✅ Variar o texto das mensagens (não copiar/colar igual)
  ✅ Simular digitação (delay antes de enviar)
  ✅ Incentivar respostas (fazer perguntas, usar botões)
  ✅ Manter proporção saudável entre envios e recebimentos
  ✅ Usar número SEPARADO para disparos (protege o principal)
  ✅ Oferecer opt-out em toda mensagem ("responda SAIR")

O QUE CAUSA BAN:
  ⛔ Muitas mensagens para números novos em curto período
  ⛔ Validação em massa (centenas por hora)
  ⛔ Mensagens não respondidas em alta taxa (envio unidirecional)
  ⛔ Denúncias de spam por destinatários
  ⛔ Texto idêntico repetido para múltiplos contatos
  ⛔ Envios muito rápidos e contínuos sem intervalo
  ⛔ Comportamento identificado como automação pura

WARM-UP APÓS DESBAN (documentação Z-API):
  1. NÃO reconecte a Z-API imediatamente
  2. Aguarde análise do WhatsApp (24-72h)
  3. Solicite revisão no app
  4. Após liberado: 3-5 dias de maturação manual
  5. Simule uso humano: grupos, mensagens, contatos
  6. Só depois reative automação gradualmente (5/dia)`,
    ondeFazer: 'Cron jobs no SQL Editor do Supabase (pg_cron). Edge functions em supabase/supabase/functions/. Config no feature_flags (flag prospectar_whatsapp_config).',
    porQue: 'A Pousinox foi banida do WhatsApp em 01/05/2026 por validação a cada 5 minutos (~288/dia) + prospecção automática. O número ficou em análise. Recuperação levou dias e causou perda de comunicação com clientes reais.',
  },
  {
    id: 'lgpd-dados-pessoais',
    titulo: 'LGPD: O que são dados pessoais e como tratar',
    categoria: 'lgpd',
    nivel: 'iniciante',
    tags: ['lgpd', 'dados pessoais', 'tratamento', 'base legal', 'consentimento'],
    oQueE: 'Dado pessoal é qualquer informação que identifique ou possa identificar uma pessoa natural (física). CNPJ não é dado pessoal, mas o telefone celular do sócio é. A LGPD exige uma base legal para cada tipo de tratamento.',
    quandoUsar: 'Sempre que for coletar, armazenar, usar ou compartilhar qualquer dado que possa identificar uma pessoa.',
    comoFazer: `TIPOS DE DADOS NO SISTEMA POUSINOX:

DADOS EMPRESARIAIS (não pessoais):
  ✅ CNPJ, razão social, nome fantasia
  ✅ Endereço comercial
  ✅ Telefone fixo comercial
  ✅ Segmento, porte, faturamento

DADOS PESSOAIS (exigem base legal):
  ⚠️ Nome do sócio/responsável
  ⚠️ CPF do sócio
  ⚠️ Telefone celular pessoal
  ⚠️ E-mail pessoal
  ⚠️ WhatsApp (vinculado a pessoa)

BASES LEGAIS MAIS USADAS:
  1. Consentimento (Art. 7º, I):
     Formulário de contato, cadastro, newsletter
     → Precisa: checkbox "Li e aceito a política de privacidade"

  2. Execução de contrato (Art. 7º, V):
     Pedidos, entregas, checkout
     → Não precisa consentimento extra

  3. Legítimo interesse (Art. 7º, IX):
     Prospecção B2B, análise de mercado
     → Precisa: documentar justificativa + opt-out

  4. Obrigação legal (Art. 7º, II):
     NFs, dados fiscais
     → Retenção obrigatória de 5 anos

DIREITOS DO TITULAR (o que a pessoa pode pedir):
  - Acessar seus dados
  - Corrigir dados incorretos
  - Excluir dados (quando não há obrigação legal)
  - Revogar consentimento
  - Portabilidade

PÁGINA DE PRIVACIDADE:
  /privacidade — já cobre todos esses pontos
  Atualizar sempre que adicionar nova coleta de dados`,
    ondeFazer: 'Política em src/pages/Privacidade.tsx. Canal de contato: adm@pousinox.com.br. Supabase: dados criptografados em trânsito (HTTPS/TLS).',
    porQue: 'Conformidade com a LGPD evita multas (até 2% do faturamento), processos judiciais e danos à reputação. Transparência e integridade são valores fundamentais da Pousinox.',
  },
  {
    id: 'lgpd-api-oficial-vs-nao-oficial',
    titulo: 'WhatsApp: API Oficial vs Não Oficial — comparativo e migração',
    categoria: 'lgpd',
    nivel: 'intermediario',
    tags: ['whatsapp', 'api oficial', 'interakt', 'z-api', 'meta', 'bsp', 'migração'],
    oQueE: 'Existem duas formas de enviar WhatsApp por API: oficial (via BSP parceiro da Meta) e não oficial (via ferramentas como Z-API que simulam o WhatsApp Web). A API oficial elimina o risco de ban, mas tem custo por mensagem.',
    quandoUsar: 'Ao decidir qual solução usar para prospecção, atendimento ou campanhas por WhatsApp. Especialmente após experiência de ban com API não oficial.',
    comoFazer: `COMPARATIVO:

API NÃO OFICIAL (Z-API):
  Custo: R$99/mês (mensagens ilimitadas)
  Risco de ban: ALTO
  Setup: Simples (QR code)
  Templates: Não precisa aprovação
  Volume seguro: 10-15/dia para prospecção
  Webhook: Sim
  ⚠️ Viola termos do WhatsApp/Meta

API OFICIAL (BSP — ex: Interakt):
  Custo: ~R$63/mês + R$0,35/msg marketing
  Risco de ban: ZERO
  Setup: Verificação CNPJ + aprovação Meta (24-48h)
  Templates: Precisa aprovação Meta (minutos)
  Volume: Milhares/dia
  Webhook: Sim
  ✅ 100% dentro dos termos

SIMULAÇÃO DE CUSTO MENSAL (330 msgs):
  Z-API:     R$99  (risco médio-alto)
  Interakt:  R$178 (risco zero)
  Diferença: R$79/mês pela segurança total

BSPs MAIS ACESSÍVEIS NO BRASIL:
  1. Interakt — ~R$63/mês, sem taxa setup, 14 dias grátis
  2. WATI — ~R$199/mês, +20% markup
  3. Gupshup — variável, para grandes volumes
  4. Twilio — pay-as-you-go, para devs

COMO MIGRAR (Z-API → Interakt):
  1. Criar conta na Interakt (interakt.shop)
  2. Verificar empresa com CNPJ
  3. Vincular chip NOVO (dedicado para prospecção)
  4. Criar templates de mensagem → Meta aprova
  5. Pegar API key da Interakt
  6. Adicionar como secret no Supabase
  7. Adaptar edge functions para nova API
  8. Testar envio individual antes de automação

TEMPLATES (exemplos para aprovação Meta):
  Marketing/prospecção:
    "Olá {{1}}! Sou da Pousinox, fabricante de fixadores
     de porcelanato em aço inox. Temos soluções para
     {{2}}. Posso enviar nosso catálogo?
     Responda SAIR para não receber mais mensagens."

  Utilidade (status pedido):
    "Olá {{1}}, seu pedido {{2}} foi enviado!
     Código de rastreio: {{3}}"

O QUE O CLAUDE FAZ NA INTEGRAÇÃO:
  ✅ Criar edge function nova (enviar-whatsapp-oficial)
  ✅ Adaptar prospectar-whatsapp para Interakt
  ✅ Adaptar validar-whatsapp
  ✅ Integrar no admin (botões, drawer, hot list)
  ✅ Configurar webhooks de resposta
  ✅ Dashboard de custos no AdminUso

O QUE VOCÊ FAZ:
  ✅ Criar conta na Interakt
  ✅ Verificar CNPJ
  ✅ Vincular chip novo
  ✅ Passar API key para o Claude
  ✅ Adicionar secret no Supabase`,
    ondeFazer: 'Edge functions em supabase/supabase/functions/. Secrets no Supabase Dashboard > Edge Functions > Secrets. Admin em src/pages/AdminCentralVendas.tsx.',
    porQue: 'A Pousinox foi banida do WhatsApp usando Z-API (API não oficial). A migração para API oficial (Interakt) custa ~R$79/mês a mais, mas elimina 100% o risco de ban e garante conformidade com termos do WhatsApp e LGPD. Decisão tomada em 01/05/2026.',
  },
]

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [code])

  return (
    <div className={styles.codeWrapper}>
      <button className={styles.copyBtn} onClick={handleCopy}>
        {copied ? 'Copiado!' : 'Copiar'}
      </button>
      <pre className={styles.codeBlock}>{code}</pre>
    </div>
  )
}

function parseContent(text: string) {
  const parts = text.split(/(```[\s\S]*?```|`[^`]+`)/)
  return parts.map((part, i) => {
    if (part.startsWith('```')) {
      const code = part.replace(/^```\w*\n?/, '').replace(/\n?```$/, '')
      return <CodeBlock key={i} code={code} />
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 4, fontSize: '0.85em' }}>{part.slice(1, -1)}</code>
    }
    return <span key={i}>{part}</span>
  })
}

function GuiaSection({ titulo, conteudo }: { titulo: string; conteudo: string }) {
  if (!conteudo) return null
  const hasCode = conteudo.includes('```') || conteudo.includes('\n--') || conteudo.includes('\n//')
  return (
    <div className={styles.section}>
      <h4>{titulo}</h4>
      {hasCode && !conteudo.includes('```') ? (
        <CodeBlock code={conteudo} />
      ) : (
        <div>{parseContent(conteudo)}</div>
      )}
    </div>
  )
}

function SugerirGuiaModal({ onClose, onSave }: { onClose: () => void; onSave: (g: GuiaDinamico) => void }) {
  const [tema, setTema] = useState('')
  const [categoria, setCategoria] = useState<Categoria>('frontend')
  const [nivel, setNivel] = useState<Nivel>('iniciante')
  const [gerando, setGerando] = useState(false)
  const [rascunho, setRascunho] = useState<GuiaDinamico | null>(null)
  const [erro, setErro] = useState('')

  const gerarRascunho = async () => {
    if (!tema.trim()) return
    setGerando(true)
    setErro('')
    try {
      const prompt = `Gere um guia técnico prático em português brasileiro sobre: "${tema}".
Categoria: ${categoria}. Nível: ${nivel}.
Responda EXATAMENTE neste formato JSON (sem markdown, só JSON puro):
{"titulo":"...","oQueE":"...","quandoUsar":"...","comoFazer":"...","ondeFazer":"...","porQue":"...","tags":["tag1","tag2","tag3"]}
O campo comoFazer deve ter exemplos de código quando aplicável.
Inclua seções de CUIDADO (o que pode quebrar) e COMO REVERTER no comoFazer.
Nunca invente nomes de funções, APIs ou comandos que não existam.`

      const { data } = await supabaseAdmin.functions.invoke('ai-hub', {
        body: { messages: [{ role: 'user', content: prompt }], provider: 'gemini' },
      })

      const text = data?.reply || data?.content || ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('IA não retornou formato válido')

      const parsed = JSON.parse(jsonMatch[0])
      const guia: GuiaDinamico = {
        id: 'user-' + Date.now(),
        titulo: parsed.titulo || tema,
        categoria,
        nivel,
        tags: parsed.tags || [tema.toLowerCase()],
        oQueE: parsed.oQueE || '',
        quandoUsar: parsed.quandoUsar || '',
        comoFazer: parsed.comoFazer || '',
        ondeFazer: parsed.ondeFazer || '',
        porQue: parsed.porQue || '',
        rascunho: true,
        criadoEm: new Date().toISOString(),
      }
      setRascunho(guia)
    } catch (e) {
      setErro('Erro ao gerar: ' + (e as Error).message)
    } finally {
      setGerando(false)
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>Sugerir novo guia</h3>
          <button className={styles.modalClose} onClick={onClose}>x</button>
        </div>

        {!rascunho ? (
          <div className={styles.modalBody}>
            <label className={styles.modalLabel}>
              Tema do guia
              <input
                className={styles.searchBox}
                placeholder="Ex: como criar webhooks, como usar CSS Grid..."
                value={tema}
                onChange={e => setTema(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && gerarRascunho()}
              />
            </label>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <label className={styles.modalLabel} style={{ flex: 1 }}>
                Categoria
                <select className={styles.searchBox} value={categoria} onChange={e => setCategoria(e.target.value as Categoria)}>
                  {CATEGORIAS.filter(c => c.value !== 'todos').map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </label>
              <label className={styles.modalLabel} style={{ flex: 1 }}>
                Nível
                <select className={styles.searchBox} value={nivel} onChange={e => setNivel(e.target.value as Nivel)}>
                  <option value="iniciante">Iniciante</option>
                  <option value="intermediario">Intermediário</option>
                  <option value="avancado">Avançado</option>
                </select>
              </label>
            </div>
            {erro && <p style={{ color: '#dc2626', fontSize: '0.85rem' }}>{erro}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className={styles.btnPrimary} onClick={gerarRascunho} disabled={gerando || !tema.trim()}>
                {gerando ? 'Gerando...' : 'Gerar rascunho com IA'}
              </button>
              <a
                className={styles.btnPerplexity}
                href={`https://www.perplexity.ai/search?q=${encodeURIComponent(tema + ' tutorial prático')}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Pesquisar no Perplexity
              </a>
            </div>
          </div>
        ) : (
          <div className={styles.modalBody}>
            <div style={{ background: '#fef3c7', padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: '0.82rem', color: '#92400e' }}>
              Rascunho gerado por IA — revise antes de aprovar. Informações podem conter erros.
            </div>
            <div className={styles.cardBody}>
              <GuiaSection titulo="Título" conteudo={rascunho.titulo} />
              <GuiaSection titulo="O que é" conteudo={rascunho.oQueE} />
              <GuiaSection titulo="Quando usar" conteudo={rascunho.quandoUsar} />
              <GuiaSection titulo="Como fazer" conteudo={rascunho.comoFazer} />
              <GuiaSection titulo="Onde fazer" conteudo={rascunho.ondeFazer} />
              <GuiaSection titulo="Por quê" conteudo={rascunho.porQue} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className={styles.btnPrimary} onClick={() => { onSave(rascunho); onClose() }}>
                Aprovar e publicar
              </button>
              <button className={styles.btnDraft} onClick={() => { onSave({ ...rascunho, rascunho: true }); onClose() }}>
                Salvar como rascunho
              </button>
              <button className={styles.btnSecondary} onClick={() => setRascunho(null)}>
                Descartar
              </button>
              <a
                className={styles.btnPerplexity}
                href={`https://www.perplexity.ai/search?q=${encodeURIComponent(rascunho.titulo)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Verificar no Perplexity
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const STORAGE_KEY = 'pousinox_knowledge_guias'

function loadGuiasDinamicos(): GuiaDinamico[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch { return [] }
}

function saveGuiasDinamicos(guias: GuiaDinamico[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(guias))
}

export default function AdminKnowledge() {
  const [busca, setBusca] = useState('')
  const [catAtiva, setCatAtiva] = useState<Categoria | 'todos'>('todos')
  const [modalAberto, setModalAberto] = useState(false)
  const [guiasDinamicos, setGuiasDinamicos] = useState<GuiaDinamico[]>([])

  useEffect(() => { setGuiasDinamicos(loadGuiasDinamicos()) }, [])

  const todasGuias: Guia[] = [...GUIAS, ...guiasDinamicos]

  const salvarGuia = (g: GuiaDinamico) => {
    const atualizados = [...guiasDinamicos, g]
    setGuiasDinamicos(atualizados)
    saveGuiasDinamicos(atualizados)
  }

  const aprovarGuia = (id: string) => {
    const atualizados = guiasDinamicos.map(g => g.id === id ? { ...g, rascunho: false } : g)
    setGuiasDinamicos(atualizados)
    saveGuiasDinamicos(atualizados)
  }

  const excluirGuia = (id: string) => {
    const atualizados = guiasDinamicos.filter(g => g.id !== id)
    setGuiasDinamicos(atualizados)
    saveGuiasDinamicos(atualizados)
  }

  const buscaLower = busca.toLowerCase()

  const filtradas = todasGuias.filter(g => {
    if (catAtiva !== 'todos' && g.categoria !== catAtiva) return false
    if (!busca) return true
    return (
      g.titulo.toLowerCase().includes(buscaLower) ||
      g.tags.some(t => t.includes(buscaLower)) ||
      g.oQueE.toLowerCase().includes(buscaLower) ||
      g.comoFazer.toLowerCase().includes(buscaLower)
    )
  })

  const contagemPorCat = CATEGORIAS.reduce<Record<string, number>>((acc, c) => {
    acc[c.value] = c.value === 'todos'
      ? todasGuias.length
      : todasGuias.filter(g => g.categoria === c.value).length
    return acc
  }, {})

  const perplexityUrl = (titulo: string) =>
    `https://www.perplexity.ai/search?q=${encodeURIComponent(titulo + ' tutorial prático')}`

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h2>Base de Conhecimento</h2>
            <p>Guias práticos para desenvolvimento — busque por tema ou filtre por categoria.</p>
          </div>
          <button className={styles.btnPrimary} onClick={() => setModalAberto(true)}>
            + Sugerir guia
          </button>
        </div>
      </div>

      <input
        className={styles.searchBox}
        type="text"
        placeholder="Buscar guia... (ex: tabela, deploy, componente, lgpd)"
        value={busca}
        onChange={e => setBusca(e.target.value)}
      />

      <div className={styles.categories}>
        {CATEGORIAS.map(c => (
          <button
            key={c.value}
            className={catAtiva === c.value ? styles.catPillActive : styles.catPill}
            onClick={() => setCatAtiva(c.value)}
          >
            {c.label} ({contagemPorCat[c.value] || 0})
          </button>
        ))}
      </div>

      <div className={styles.count}>
        {filtradas.length} guia{filtradas.length !== 1 ? 's' : ''} encontrada{filtradas.length !== 1 ? 's' : ''}
      </div>

      {filtradas.length === 0 ? (
        <div className={styles.empty}>Nenhuma guia encontrada para "{busca}"</div>
      ) : (
        filtradas.map(g => {
          const isDinamico = g.id.startsWith('user-')
          return (
            <details key={g.id} className={`${styles.card} ${g.rascunho ? styles.cardRascunho : ''}`}>
              <summary>
                <span>{g.titulo}</span>
                <span className={styles[NIVEL_CLASS[g.nivel]]}>{NIVEL_LABEL[g.nivel]}</span>
                <span className={styles.badgeCat}>{CATEGORIAS.find(c => c.value === g.categoria)?.label}</span>
                {g.rascunho && <span className={styles.badgeRascunho}>Rascunho</span>}
              </summary>
              <div className={styles.cardBody}>
                <GuiaSection titulo="O que é" conteudo={g.oQueE} />
                <GuiaSection titulo="Quando usar" conteudo={g.quandoUsar} />
                <GuiaSection titulo="Como fazer" conteudo={g.comoFazer} />
                <GuiaSection titulo="Onde fazer" conteudo={g.ondeFazer} />
                <GuiaSection titulo="Por quê" conteudo={g.porQue} />
                <div className={styles.guiaActions}>
                  <a
                    className={styles.btnPerplexity}
                    href={perplexityUrl(g.titulo)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Aprofundar no Perplexity
                  </a>
                  {isDinamico && g.rascunho && (
                    <button className={styles.btnPrimary} onClick={() => aprovarGuia(g.id)} style={{ fontSize: '0.78rem', padding: '5px 12px' }}>
                      Aprovar
                    </button>
                  )}
                  {isDinamico && (
                    <button className={styles.btnDanger} onClick={() => excluirGuia(g.id)} style={{ fontSize: '0.78rem', padding: '5px 12px' }}>
                      Excluir
                    </button>
                  )}
                </div>
              </div>
            </details>
          )
        })
      )}

      {modalAberto && <SugerirGuiaModal onClose={() => setModalAberto(false)} onSave={salvarGuia} />}
    </div>
  )
}
