import { useState, useCallback, useEffect } from 'react'
import { supabaseAdmin } from '../lib/supabase'
import styles from './AdminKnowledge.module.css'

type Categoria = 'sql' | 'frontend' | 'backend' | 'deploy' | 'git' | 'sites' | 'apps' | 'lgpd' | 'comercial'
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
  { value: 'comercial', label: 'Comercial/Negócio' },
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

  // Comercial/Negócio
  {
    id: 'plano-negocio-pousinox',
    titulo: 'Plano de Negócio — Monetização Imediata',
    categoria: 'comercial',
    nivel: 'avancado',
    tags: ['plano de negócio', 'monetização', 'receita', 'roi', 'estratégia', 'vendas'],
    oQueE: `Plano de ação para gerar receita IMEDIATA com os ativos já construídos da Pousinox.

SITUAÇÃO ATUAL (Maio/2026):
  Investimento mensal: ~R$977/mês (Claude Max R$687 + Supabase R$155 + Z-API R$99 + domínios R$36)
  Receita digital: R$0
  Ativos construídos: ERP completo, 800K prospects, IA, site institucional, outlet

O PROBLEMA:
  ⛔ Sistema robusto sem retorno financeiro
  ⛔ Base de 800K prospects parada
  ⛔ Módulos prontos sem uso comercial ativo
  ⛔ Investimento mensal sem ROI`,
    quandoUsar: `Consultar este plano TODA SEMANA para acompanhar execução e ajustar prioridades.

QUANDO REVISAR:
  → Segunda-feira: planejar ações da semana
  → Sexta-feira: medir resultados e ajustar
  → Ao tomar decisão de investimento (novo tool, serviço, etc.)`,
    comoFazer: `FASE 1 — RECEITA IMEDIATA (Semanas 1-2):

  1. PROSPECÇÃO ATIVA (custo: R$0):
    → Usar Hot List do AdminCentralVendas (top 50 prospects por scoring)
    → Filtrar por UF com maior demanda (MG, SP, RJ)
    → Meta: 10-15 contatos/dia via canais diversos (ver guia "Canais de Prospecção")
    → Follow-up sistemático via aba Follow-ups

  2. OUTLET / PRONTA-ENTREGA (custo: R$0):
    → Publicar produtos no outlet com Pix QR
    → Checkout já funciona (implementado 24/04)
    → Divulgar link direto nos contatos comerciais

  3. ORÇAMENTOS RÁPIDOS (custo: R$0):
    → AdminOrcamento com templates prontos
    → Responder em <2h toda solicitação
    → Usar Ficha Técnica Comercial (PDF automático)

FASE 2 — ESCALA (Semanas 3-6):

  4. E-MAIL MARKETING (custo: ~R$0-50/mês):
    → Extrair e-mails da base de 800K (prospects com email)
    → Ferramenta: Brevo (grátis até 300/dia) ou Mailchimp (grátis até 500 contatos)
    → Campanha segmentada por segmento/UF
    → Template: apresentação + catálogo + link outlet

  5. GOOGLE MEU NEGÓCIO (custo: R$0):
    → Otimizar perfil GBP com fotos, posts semanais
    → Responder avaliações
    → Publicar ofertas outlet

  6. WHATSAPP OFICIAL via Interakt (custo: ~R$178/mês):
    → Migrar para API oficial (sem risco de ban)
    → Templates aprovados pela Meta
    → Prospecção automatizada segura

FASE 3 — INTELIGÊNCIA (Meses 2-3):

  7. RELATÓRIOS DE MERCADO (custo: R$0):
    → AdminEstudoMercado já tem dados cruzados
    → Gerar PDF com insights por UF/segmento
    → Oferecer como valor agregado para clientes

  8. PROPOSTAS COMERCIAIS (custo: R$0):
    → PropostaAcesso já funciona com link público
    → Personalizar por segmento do prospect
    → Incluir dados de mercado como diferencial

MÉTRICAS DE SUCESSO:
  Semana 1: ≥50 contatos realizados
  Semana 2: ≥3 orçamentos enviados
  Mês 1: ≥1 venda fechada (break-even parcial)
  Mês 2: receita ≥ R$977 (break-even total)
  Mês 3: margem positiva + reinvestimento`,
    ondeFazer: `AdminCentralVendas (Hot List + Follow-ups), AdminOrcamento, AdminPipeline, Outlet (/pronta-entrega), AdminEstudoMercado.`,
    porQue: `O sistema está pronto — falta USAR. Cada semana sem prospecção ativa é R$244 jogado fora (R$977/4). A base de 800K prospects é o maior ativo: segmentada, scorada, com telefone e endereço. O ROI vem da ação, não de mais features.`,
  },
  {
    id: 'canais-prospeccao',
    titulo: 'Canais de Prospecção — B2B e B2C com Prós, Contras e Riscos',
    categoria: 'comercial',
    nivel: 'intermediario',
    tags: ['prospecção', 'whatsapp', 'email', 'telefone', 'linkedin', 'b2b', 'b2c', 'canais', 'riscos'],
    oQueE: `Guia completo de TODOS os canais disponíveis para prospectar clientes — empresas (B2B) e pessoas físicas (B2C).

A Pousinox vende para:
  → B2B: construtoras, marmorarias, revendas, arquitetos, engenheiros
  → B2C: proprietários fazendo reforma, decoradores, DIY

Cada canal tem perfil de risco, custo e efetividade diferentes.`,
    quandoUsar: `Antes de iniciar qualquer campanha de prospecção. Consultar para escolher o MIX certo de canais para cada público-alvo.

REGRA DE OURO: nunca depender de um único canal — diversificar sempre.`,
    comoFazer: `CANAIS B2B (EMPRESAS):

  1. WHATSAPP (API Oficial — Interakt):
    ✅ Prós: taxa de abertura 90%+, resposta rápida, mídia rica
    ⛔ Contras: custo por conversa (~R$0,25-0,50), templates precisam aprovação Meta
    ⚠️ Riscos: BAIXO com API oficial / ALTO com API não oficial (ban permanente)
    → Volume seguro: 50-100 msgs/dia com API oficial
    → Obrigatório: opt-out em toda mensagem (LGPD)
    → Base legal: legítimo interesse (B2B, Art. 7º IX)

  2. E-MAIL MARKETING:
    ✅ Prós: custo quase zero, escalável (300/dia grátis no Brevo), rastreável, profissional
    ⛔ Contras: taxa de abertura 15-25% B2B, vai para spam se mal configurado
    ⚠️ Riscos: BAIXO se tiver opt-out + SPF/DKIM configurados
    → Ferramentas: Brevo (grátis 300/dia), Mailchimp (grátis 500 contatos)
    → Obrigatório: link de descadastro, remetente real, SPF/DKIM
    → Dica: assunto curto e personalizado (nome da empresa)

  3. TELEFONE / LIGAÇÃO:
    ✅ Prós: contato direto, gera confiança, fecha negócio mais rápido
    ⛔ Contras: trabalhoso, 1 a 1, taxa de atendimento ~30%
    ⚠️ Riscos: MUITO BAIXO — ligação comercial B2B é prática aceita
    → Volume: 20-30 ligações/dia (realista para 1 pessoa)
    → Melhor horário: 9h-11h e 14h-16h (terça a quinta)
    → Dica: ligar após enviar material por e-mail/WhatsApp

  4. LINKEDIN (prospecção orgânica):
    ✅ Prós: profissional, decisores acessíveis, conteúdo técnico valorizado
    ⛔ Contras: escala limitada (100 conexões/semana), tempo para construir
    ⚠️ Riscos: BAIXO — restrição é de volume, não de ban
    → Público: engenheiros, arquitetos, compradores de construtoras
    → Estratégia: publicar conteúdo técnico → conexão → mensagem
    → Sem automação: LinkedIn bane ferramentas de automação

  5. VISITA PRESENCIAL:
    ✅ Prós: maior taxa de conversão (40-60%), relacionamento real
    ⛔ Contras: custo de deslocamento, 3-5 visitas/dia máximo
    ⚠️ Riscos: NENHUM — é a prospecção tradicional
    → Priorizar: prospects top-score na região de Pouso Alegre e Sul de MG
    → Levar: amostras físicas + ficha técnica impressa

  6. GOOGLE ADS / META ADS (pago):
    ✅ Prós: leads qualificados, segmentação precisa, resultados rápidos
    ⛔ Contras: custo R$500-2000/mês para testar, precisa otimizar
    ⚠️ Riscos: MÉDIO — gastar sem retorno se mal configurado
    → Começar com: Google Search "fixador porcelanato inox" (intenção alta)
    → Orçamento mínimo: R$20/dia Google, R$15/dia Meta
    → Só investir DEPOIS de validar conversão orgânica

CANAIS B2C (PESSOAS FÍSICAS):

  7. INSTAGRAM / REDES SOCIAIS:
    ✅ Prós: visual (produto fotogênico), alcance orgânico, Stories/Reels
    ⛔ Contras: resultado lento, precisa constância, algoritmo imprevisível
    ⚠️ Riscos: BAIXO — risco só de investir tempo sem retorno
    → Conteúdo: antes/depois de obras, vídeos de instalação, depoimentos
    → Hashtags: #reforma #porcelanato #obra #decoracao #arquitetura
    → Frequência: 3-5 posts/semana, 1-2 Reels/semana

  8. MARKETPLACE (MercadoLivre, Shopee):
    ✅ Prós: tráfego pronto, confiança do comprador, logística integrada
    ⛔ Contras: comissão 11-16%, concorrência de preço, margem menor
    ⚠️ Riscos: BAIXO — risco financeiro limitado ao estoque
    → Ideal para: kits pequenos, outlet, pronta-entrega
    → Dica: usar Mercado Livre primeiro (maior volume construção civil)

  9. GOOGLE MEU NEGÓCIO (GBP):
    ✅ Prós: gratuito, aparece em buscas locais, gera ligações diretas
    ⛔ Contras: limitado à região, precisa manutenção
    ⚠️ Riscos: NENHUM — é presença digital básica
    → Ações: fotos profissionais, posts semanais, responder avaliações
    → Pedir avaliação a cada cliente satisfeito

  10. INDICAÇÃO / PARCERIAS:
    ✅ Prós: lead mais quente que existe, custo zero, confiança prévia
    ⛔ Contras: não é escalável, depende de relacionamento
    ⚠️ Riscos: NENHUM
    → Parceiros: lojas de porcelanato, marmorarias, pedreiros, arquitetos
    → Oferecer: comissão por indicação ou desconto cruzado
    → Manter: contato mensal com parceiros ativos

  11. SEO / CONTEÚDO (site + blog):
    ✅ Prós: tráfego gratuito, autoridade, longo prazo
    ⛔ Contras: resultado em 3-6 meses, precisa constância
    ⚠️ Riscos: NENHUM — investimento de tempo com retorno composto
    → Site pousinox.com.br já existe e indexa
    → Blog com: guias de instalação, comparativos, normas técnicas
    → Calculadora pública já atrai tráfego (implementada)

COMO PROSPECTAR PESSOAS FÍSICAS (B2C):

  ONDE ENCONTRAR:
    → Google Ads: palavras-chave de reforma ("fixador porcelanato preço")
    → Instagram: hashtags de reforma, comentários em perfis de arquitetos
    → Grupos Facebook: "reforma", "obra", "construindo minha casa"
    → YouTube: comentários em vídeos de instalação de porcelanato
    → MercadoLivre: quem busca "fixador porcelanato" é PF comprando
    → Parcerias com lojas de material de construção

  ABORDAGEM B2C (diferente de B2B):
    → Linguagem simples, sem jargão técnico
    → Foco em benefício: "não risca o porcelanato", "instalação fácil"
    → Preço visível (PF quer saber o preço ANTES de falar com vendedor)
    → Frete calculado no site (já implementado)
    → Pix QR para pagamento rápido (já implementado)

RESUMO — PRIORIDADE DE CANAIS:
  🥇 Imediato (esta semana): Telefone + E-mail + WhatsApp manual
  🥈 Curto prazo (2 semanas): WhatsApp Interakt + Instagram + GBP
  🥉 Médio prazo (1-2 meses): Google Ads + Marketplace + SEO
  🏅 Longo prazo (3+ meses): LinkedIn + Parcerias + Conteúdo blog`,
    ondeFazer: `AdminCentralVendas (B2B — Hot List, Follow-ups, WhatsApp). Outlet /pronta-entrega (B2C). Instagram/Meta (perfil da Pousinox). Google Ads (ads.google.com). Mercado Livre (mercadolivre.com.br).`,
    porQue: `Diversificar canais reduz risco (o ban do WhatsApp provou isso). B2C é mercado inexplorado pela Pousinox — fixadores para reforma residencial têm demanda crescente. Cada canal tem custo e risco diferente: começar pelos gratuitos e escalar conforme resultado.`,
  },
  {
    id: 'atualizar-prospects',
    titulo: 'Como Atualizar e Manter a Base de 800K Prospects',
    categoria: 'comercial',
    nivel: 'intermediario',
    tags: ['prospects', 'base de dados', 'atualização', 'brasilapi', 'receita federal', 'enriquecimento', 'cnpj'],
    oQueE: `Estratégia para manter a base de 800K prospects atualizada SEM repetir o trabalho árduo da importação original.

A BASE ATUAL:
  → 800K CNPJs segmentados da Receita Federal
  → Campos: razão social, fantasia, CNPJ, porte, segmento, UF, cidade, telefone, email
  → Scoring on-the-fly via fn_top_prospects
  → Problema: dados podem ficar desatualizados (telefone, situação cadastral, endereço)`,
    quandoUsar: `→ Quando iniciar campanha de prospecção (atualizar os top prospects primeiro)
→ Trimestralmente: importar novos CNPJs da Receita Federal
→ Quando ligação/WhatsApp retornar "número inexistente"`,
    comoFazer: `3 ESTRATÉGIAS (da mais simples à mais completa):

  1. ENRIQUECIMENTO SOB DEMANDA (Recomendado — custo R$0):
    → Atualiza SÓ os prospects que você vai contactar
    → BrasilAPI (gratuita): consulta CNPJ → telefone, situação, endereço
    → Automático: edge function semanal nos top 200 sem atualização há 90+ dias
    → Manual: botão "Atualizar dados" no drawer do prospect

    COMO FUNCIONA:
      a) Cron semanal seleciona top 200 prospects (por score) sem update há 90 dias
      b) Consulta BrasilAPI: https://brasilapi.com.br/api/cnpj/v1/{cnpj}
      c) Atualiza: telefone, email, situação cadastral, endereço
      d) Marca data de atualização
      e) Remove prospects com situação "Baixada" ou "Inapta"

    ✅ Prós: gratuito, rápido, focado no que importa
    ⛔ Contras: não pega empresas novas
    ⚠️ Riscos: BAIXO — BrasilAPI tem rate limit (3/seg), respeitamos

  2. IMPORTAÇÃO INCREMENTAL (Trimestral — custo R$0):
    → Receita Federal publica dados abertos a cada ~3 meses
    → Fonte: dados.gov.br → CNPJ → download dos arquivos de "estabelecimentos"
    → Script compara com base existente: insere novos, atualiza alterados
    → NÃO precisa reimportar tudo — só o delta

    COMO FUNCIONA:
      a) Download dos CSVs da Receita (divididos por UF)
      b) Script filtra por CNAEs relevantes (construção, arquitetura, etc.)
      c) Compara CNPJ: novo → INSERT, existente → UPDATE se mudou
      d) Marca empresas "Baixadas" como inativas

    ✅ Prós: pega empresas novas, dados oficiais, gratuito
    ⛔ Contras: arquivos grandes (~30GB total), processamento demorado
    ⚠️ Riscos: BAIXO — dados públicos, sem limite de uso

  3. APIS DE ENRIQUECIMENTO (Para dados extras — custo variável):
    → ReceitaWS: gratuito 3/min, pago ~R$50/mês para volume
    → CNPJ.ws: similar, foco em dados complementares
    → Clearbit/Apollo: dados de contato avançados (caro, internacional)

    ✅ Prós: dados mais ricos (sócios, capital social, filiais)
    ⛔ Contras: custo mensal, limites de volume
    ⚠️ Riscos: MÉDIO — dependência de serviço terceiro

PLANO RECOMENDADO (combinação):
  → Semanal: enriquecimento automático dos top 200 (BrasilAPI, grátis)
  → Trimestral: importação incremental da Receita Federal (grátis)
  → Sob demanda: BrasilAPI no drawer do prospect (já existe no admin)

IMPLEMENTAÇÃO TÉCNICA:
  → Edge function: enriquecer-prospects (cron semanal)
  → Coluna nova: atualizado_em TIMESTAMPTZ em prospeccao
  → Filtro: WHERE atualizado_em IS NULL OR atualizado_em < NOW() - INTERVAL '90 days'
  → Rate limit: 2 req/seg para BrasilAPI (seguro)
  → Lote: 200 prospects por execução (10-15 minutos)`,
    ondeFazer: `Edge function em supabase/supabase/functions/enriquecer-prospects/. Drawer de detalhe em AdminProspeccao.tsx (botão "Atualizar dados" já consulta BrasilAPI). Dados abertos em dados.gov.br.`,
    porQue: `800K prospects são o maior ativo digital da Pousinox. Dados desatualizados = ligações perdidas e e-mails devolvidos. A estratégia "sob demanda" custa R$0 e garante que os prospects que IMPORTAM estejam sempre atualizados. Atualizar tudo de uma vez é desperdício — foco nos top-score.`,
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

function RichContent({ text }: { text: string }) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // Empty line
    if (!trimmed) { i++; continue }

    // Code block ```
    if (trimmed.startsWith('```')) {
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing ```
      elements.push(<CodeBlock key={elements.length} code={codeLines.join('\n')} />)
      continue
    }

    // SQL/code block (starts with -- or CREATE or ALTER or SELECT or INSERT)
    if (/^(--|CREATE |ALTER |SELECT |INSERT |UPDATE |DROP |WITH )/.test(trimmed)) {
      const codeLines: string[] = [line]
      i++
      while (i < lines.length) {
        const next = lines[i].trim()
        if (!next || /^(--|CREATE |ALTER |SELECT |INSERT |UPDATE |DROP |WITH |  )/.test(lines[i]) || /[;)]$/.test(next)) {
          codeLines.push(lines[i])
          if (/;$/.test(next)) { i++; break }
          i++
        } else break
      }
      elements.push(<CodeBlock key={elements.length} code={codeLines.join('\n')} />)
      continue
    }

    // HEADER LINE: mostly uppercase words ending with optional :
    // Matches: "COMPARATIVO:", "API NÃO OFICIAL (Z-API):", "COMO MIGRAR (Z-API → Interakt):", "BSPs MAIS ACESSÍVEIS NO BRASIL:"
    const isHeader = (s: string) => {
      const clean = s.replace(/[:]\s*$/, '').replace(/[^a-záéíóúâêôãõçA-ZÁÉÍÓÚÂÊÔÃÕÇ\s]/g, ' ').trim()
      if (clean.length < 3) return false
      const words = clean.split(/\s+/).filter(w => w.length > 1)
      if (words.length === 0) return false
      const upperWords = words.filter(w => w === w.toUpperCase())
      return upperWords.length / words.length >= 0.6
    }

    if (isHeader(trimmed)) {
      const header = trimmed.replace(/:$/, '')
      const items: string[] = []
      i++
      while (i < lines.length) {
        const next = lines[i].trim()
        if (!next) { i++; continue }
        // Stop if next header at same level (not indented)
        if (!lines[i].startsWith('  ') && isHeader(next)) break
        items.push(lines[i])
        i++
      }

      if (items.length > 0) {
        elements.push(
          <details key={elements.length} className={styles.richBlock}>
            <summary className={styles.richBlockHeader}>{header}</summary>
            <div className={styles.richBlockBody}>
              {items.map((item, j) => {
                const t = item.trim()
                // Numbered item: "1. ..."
                if (/^\d+\.\s/.test(t)) {
                  const num = t.match(/^(\d+)\.\s/)![1]
                  const rest = t.replace(/^\d+\.\s/, '')
                  return <div key={j} className={styles.richStep}><span className={styles.richStepNum}>{num}</span><span>{renderInline(rest)}</span></div>
                }
                // Checkbox item: "✅ ..." or "⛔ ..." or "⚠️ ..."
                if (/^[✅⛔⚠️❌]/.test(t)) {
                  const isOk = t.startsWith('✅')
                  const isBad = t.startsWith('⛔') || t.startsWith('❌')
                  return <div key={j} className={`${styles.richItem} ${isOk ? styles.richItemOk : isBad ? styles.richItemBad : styles.richItemWarn}`}>{renderInline(t)}</div>
                }
                // Key: Value pair
                if (/^[\w\sáéíóúâêôãõç]+:\s/.test(t) && t.indexOf(':') < 30) {
                  const [key, ...valParts] = t.split(':')
                  const val = valParts.join(':').trim()
                  return <div key={j} className={styles.richKV}><span className={styles.richKey}>{key}</span><span>{renderInline(val)}</span></div>
                }
                // Indented sub-item
                if (item.startsWith('  ')) {
                  return <div key={j} className={styles.richSubItem}>{renderInline(t)}</div>
                }
                return <div key={j} className={styles.richLine}>{renderInline(t)}</div>
              })}
            </div>
          </details>
        )
      } else {
        elements.push(<div key={elements.length} className={styles.richBlockHeader} style={{ marginBottom: 8 }}>{header}</div>)
      }
      continue
    }

    // Regular line
    elements.push(<div key={elements.length} className={styles.richLine}>{renderInline(trimmed)}</div>)
    i++
  }

  return <div className={styles.richContent}>{elements}</div>
}

function renderInline(text: string): React.ReactNode {
  // Bold **text** and inline `code`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/)
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>
    if (p.startsWith('`') && p.endsWith('`')) return <code key={i} style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 4, fontSize: '0.85em' }}>{p.slice(1, -1)}</code>
    return <span key={i}>{p}</span>
  })
}

function GuiaSection({ titulo, conteudo }: { titulo: string; conteudo: string }) {
  if (!conteudo) return null
  return (
    <div className={styles.section}>
      <h4>{titulo}</h4>
      <RichContent text={conteudo} />
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
const ACESSOS_KEY = 'pousinox_knowledge_acessos'

function loadGuiasDinamicos(): GuiaDinamico[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch { return [] }
}

function saveGuiasDinamicos(guias: GuiaDinamico[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(guias))
}

function loadAcessos(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(ACESSOS_KEY) || '{}')
  } catch { return {} }
}

function registrarAcesso(id: string): Record<string, number> {
  const acessos = loadAcessos()
  acessos[id] = (acessos[id] || 0) + 1
  localStorage.setItem(ACESSOS_KEY, JSON.stringify(acessos))
  return acessos
}

type Vista = 'lista' | 'mapa'

function MapaMental({ guias, onAcesso, perplexityUrl }: { guias: Guia[]; onAcesso: (id: string) => void; perplexityUrl: (t: string) => string }) {
  const [aberto, setAberto] = useState<string | null>(null)
  const cats = CATEGORIAS.filter(c => c.value !== 'todos')
  const guiasPorCat = cats.map(c => ({
    ...c,
    guias: guias.filter(g => g.categoria === c.value),
  })).filter(c => c.guias.length > 0)

  const guiaAtivo = aberto ? guias.find(g => g.id === aberto) : null

  return (
    <div className={styles.mapaContainer}>
      <div className={styles.mapaCenter}>Base de Conhecimento</div>
      <div className={styles.mapaRamos}>
        {guiasPorCat.map(cat => (
          <div key={cat.value} className={styles.mapaRamo}>
            <div className={styles.mapaCatNode}>
              <span className={styles.mapaCatLabel}>{cat.label}</span>
              <span className={styles.mapaCatCount}>{cat.guias.length}</span>
            </div>
            <div className={styles.mapaFilhos}>
              {cat.guias.map(g => (
                <button
                  key={g.id}
                  className={`${styles.mapaGuiaNode} ${g.rascunho ? styles.mapaGuiaRascunho : ''} ${aberto === g.id ? styles.mapaGuiaAtivo : ''}`}
                  onClick={() => {
                    const next = aberto === g.id ? null : g.id
                    setAberto(next)
                    if (next) onAcesso(g.id)
                  }}
                  title={g.oQueE.slice(0, 120)}
                >
                  <span className={styles.mapaGuiaTitulo}>{g.titulo}</span>
                  <span className={styles[NIVEL_CLASS[g.nivel]]} style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                    {g.nivel === 'iniciante' ? 'Ini' : g.nivel === 'intermediario' ? 'Int' : 'Av'}
                  </span>
                </button>
              ))}
            </div>
            {guiaAtivo && cat.guias.some(g => g.id === aberto) && (
              <div className={styles.mapaDetalhe}>
                <div className={styles.mapaDetalheHeader}>
                  <h3>{guiaAtivo.titulo}</h3>
                  <button className={styles.modalClose} onClick={() => setAberto(null)}>x</button>
                </div>
                <div className={styles.cardBody}>
                  <GuiaSection titulo="O que é" conteudo={guiaAtivo.oQueE} />
                  <GuiaSection titulo="Quando usar" conteudo={guiaAtivo.quandoUsar} />
                  <GuiaSection titulo="Como fazer" conteudo={guiaAtivo.comoFazer} />
                  <GuiaSection titulo="Onde fazer" conteudo={guiaAtivo.ondeFazer} />
                  <GuiaSection titulo="Por quê" conteudo={guiaAtivo.porQue} />
                  <div className={styles.guiaActions}>
                    <a className={styles.btnPerplexity} href={perplexityUrl(guiaAtivo.titulo)} target="_blank" rel="noopener noreferrer">
                      Aprofundar no Perplexity
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

async function indexarGuiaParaIA(guia: Guia) {
  const texto = [
    `# ${guia.titulo}`,
    `Categoria: ${guia.categoria} | Nível: ${guia.nivel}`,
    `Tags: ${guia.tags.join(', ')}`,
    '',
    '## O que é',
    guia.oQueE,
    '',
    '## Quando usar',
    guia.quandoUsar,
    '',
    '## Como fazer',
    guia.comoFazer,
    '',
    '## Onde fazer',
    guia.ondeFazer,
    '',
    '## Por quê',
    guia.porQue,
  ].join('\n')

  const encoder = new TextEncoder()
  const bytes = encoder.encode(texto)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  const base64 = btoa(binary)

  const { data, error } = await supabaseAdmin.functions.invoke('indexar-documento', {
    body: { file_base64: base64, mime_type: 'text/plain', filename: `guia-${guia.id}.txt` },
  })
  if (error) throw new Error(typeof error === 'object' ? JSON.stringify(error) : String(error))
  const parsed = typeof data === 'string' ? JSON.parse(data) : data
  if (!parsed.success) throw new Error('Falha ao indexar')
  return parsed
}

export default function AdminKnowledge() {
  const [busca, setBusca] = useState('')
  const [catAtiva, setCatAtiva] = useState<Categoria | 'todos'>('todos')
  const [modalAberto, setModalAberto] = useState(false)
  const [guiasDinamicos, setGuiasDinamicos] = useState<GuiaDinamico[]>([])
  const [vista, setVista] = useState<Vista>('lista')
  const [guiaAberto, setGuiaAberto] = useState<string | null>(null)
  const [acessos, setAcessos] = useState<Record<string, number>>({})
  const [navUrl, setNavUrl] = useState<string | null>(null)
  const [navInput, setNavInput] = useState('')
  const [indexandoIA, setIndexandoIA] = useState(false)
  const [iaStatus, setIaStatus] = useState<string | null>(null)

  useEffect(() => {
    setGuiasDinamicos(loadGuiasDinamicos())
    setAcessos(loadAcessos())
  }, [])

  const abrirNav = (url: string) => { setNavUrl(url); setNavInput(url) }
  const pesquisarGoogle = (q: string) => abrirNav(`https://www.google.com/search?igu=1&q=${encodeURIComponent(q)}`)

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

  const abrirGuia = (id: string) => {
    setGuiaAberto(id)
    setAcessos(registrarAcesso(id))
  }

  const fecharGuia = () => setGuiaAberto(null)

  const guiaAbertoObj = guiaAberto ? todasGuias.find(g => g.id === guiaAberto) : null

  const filtradas = todasGuias.filter(g => {
    if (catAtiva !== 'todos' && g.categoria !== catAtiva) return false
    if (!busca) return true
    return (
      g.titulo.toLowerCase().includes(buscaLower) ||
      g.tags.some(t => t.includes(buscaLower)) ||
      g.oQueE.toLowerCase().includes(buscaLower) ||
      g.comoFazer.toLowerCase().includes(buscaLower)
    )
  }).sort((a, b) => (acessos[b.id] || 0) - (acessos[a.id] || 0))

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
      {guiaAbertoObj ? (
        /* === VISTA TELA CHEIA === */
        <div className={styles.guiaFullScreen}>
          <div className={styles.guiaFullHeader}>
            <button className={styles.btnVoltar} onClick={fecharGuia}>← Voltar</button>
            <div className={styles.guiaFullMeta}>
              <span className={styles[NIVEL_CLASS[guiaAbertoObj.nivel]]}>{NIVEL_LABEL[guiaAbertoObj.nivel]}</span>
              <span className={styles.badgeCat}>{CATEGORIAS.find(c => c.value === guiaAbertoObj.categoria)?.label}</span>
              {guiaAbertoObj.rascunho && <span className={styles.badgeRascunho}>Rascunho</span>}
              {(acessos[guiaAbertoObj.id] || 0) > 0 && <span className={styles.badgeAcessos}>{acessos[guiaAbertoObj.id]}x</span>}
            </div>
          </div>
          <h2 className={styles.guiaFullTitulo}>{guiaAbertoObj.titulo}</h2>
          <div className={styles.guiaFullTags}>
            {guiaAbertoObj.tags.map(t => <span key={t} className={styles.guiaTag}>{t}</span>)}
          </div>
          <div className={styles.guiaFullBody}>
            <GuiaSection titulo="O que é" conteudo={guiaAbertoObj.oQueE} />
            <GuiaSection titulo="Quando usar" conteudo={guiaAbertoObj.quandoUsar} />
            <GuiaSection titulo="Como fazer" conteudo={guiaAbertoObj.comoFazer} />
            <GuiaSection titulo="Onde fazer" conteudo={guiaAbertoObj.ondeFazer} />
            <GuiaSection titulo="Por quê" conteudo={guiaAbertoObj.porQue} />
          </div>
          <div className={styles.guiaFullActions}>
            <button className={styles.btnPerplexity} onClick={() => pesquisarGoogle(guiaAbertoObj.titulo + ' tutorial prático')}>
              Pesquisar no Google
            </button>
            <a className={styles.btnPerplexity} style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }} href={perplexityUrl(guiaAbertoObj.titulo)} target="_blank" rel="noopener noreferrer">
              Perplexity
            </a>
            <button
              className={styles.btnPerplexity}
              style={{ background: 'linear-gradient(135deg, #059669, #047857)' }}
              disabled={indexandoIA}
              onClick={async () => {
                setIndexandoIA(true); setIaStatus(null)
                try {
                  await indexarGuiaParaIA(guiaAbertoObj)
                  setIaStatus('✅ Guia indexado na base IA!')
                } catch (err) {
                  setIaStatus(`❌ Erro: ${(err as Error).message}`)
                } finally { setIndexandoIA(false); setTimeout(() => setIaStatus(null), 4000) }
              }}
            >
              {indexandoIA ? '⏳ Indexando...' : '🧠 Ensinar à IA'}
            </button>
            {iaStatus && <span style={{ fontSize: '0.78rem', padding: '4px 8px' }}>{iaStatus}</span>}
            {guiaAbertoObj.id.startsWith('user-') && guiaAbertoObj.rascunho && (
              <button className={styles.btnPrimary} onClick={() => aprovarGuia(guiaAbertoObj.id)} style={{ fontSize: '0.85rem' }}>
                Aprovar
              </button>
            )}
            {guiaAbertoObj.id.startsWith('user-') && (
              <button className={styles.btnDanger} onClick={() => { excluirGuia(guiaAbertoObj.id); fecharGuia() }} style={{ fontSize: '0.85rem' }}>
                Excluir
              </button>
            )}
          </div>
        </div>
      ) : (
        /* === VISTA LISTA / MAPA === */
        <>
          <div className={styles.header}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h2>Base de Conhecimento</h2>
                <p>Guias práticos — busque por tema ou filtre por categoria.</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div className={styles.vistaToggle}>
                  <button className={vista === 'lista' ? styles.vistaActive : styles.vistaBtn} onClick={() => setVista('lista')}>Lista</button>
                  <button className={vista === 'mapa' ? styles.vistaActive : styles.vistaBtn} onClick={() => setVista('mapa')}>Mapa</button>
                </div>
                <button className={styles.btnPrimary} onClick={() => setModalAberto(true)}>
                  + Sugerir guia
                </button>
              </div>
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

          {vista === 'mapa' ? (
            <MapaMental guias={filtradas} onAcesso={id => setAcessos(registrarAcesso(id))} perplexityUrl={perplexityUrl} />
          ) : (
            <>
              <div className={styles.count}>
                {filtradas.length} guia{filtradas.length !== 1 ? 's' : ''} encontrada{filtradas.length !== 1 ? 's' : ''}
              </div>

              {filtradas.length === 0 ? (
                <div className={styles.empty}>Nenhuma guia encontrada para "{busca}"</div>
              ) : (
                filtradas.map(g => (
                  <div key={g.id} className={`${styles.cardCompact} ${g.rascunho ? styles.cardRascunho : ''}`} onClick={() => abrirGuia(g.id)}>
                    <span className={styles.cardCompactTitle}>{g.titulo}</span>
                    <div className={styles.cardCompactMeta}>
                      {(acessos[g.id] || 0) > 0 && <span className={styles.badgeAcessos}>{acessos[g.id]}x</span>}
                      <span className={styles[NIVEL_CLASS[g.nivel]]}>{NIVEL_LABEL[g.nivel]}</span>
                      <span className={styles.badgeCat}>{CATEGORIAS.find(c => c.value === g.categoria)?.label}</span>
                      {g.rascunho && <span className={styles.badgeRascunho}>Rascunho</span>}
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </>
      )}

      {modalAberto && <SugerirGuiaModal onClose={() => setModalAberto(false)} onSave={salvarGuia} />}

      {navUrl && (
        <div className={styles.navOverlay}>
          <div className={styles.navPanel}>
            <div className={styles.navToolbar}>
              <input
                className={styles.navUrlBar}
                value={navInput}
                onChange={e => setNavInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') abrirNav(navInput) }}
                placeholder="Digite URL ou pesquisa..."
              />
              <button className={styles.btnSecondary} onClick={() => {
                const q = navInput.trim()
                if (q.startsWith('http')) abrirNav(q)
                else pesquisarGoogle(q)
              }} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Ir</button>
              <a className={styles.btnSecondary} href={navUrl} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 12px', fontSize: '0.8rem', textDecoration: 'none' }}>Nova aba</a>
              <button className={styles.modalClose} onClick={() => setNavUrl(null)}>x</button>
            </div>
            <iframe
              src={navUrl}
              className={styles.navIframe}
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              title="Navegador"
            />
          </div>
        </div>
      )}
    </div>
  )
}
