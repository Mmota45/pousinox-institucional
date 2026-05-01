import { useState, useCallback } from 'react'
import styles from './AdminKnowledge.module.css'

type Categoria = 'sql' | 'frontend' | 'backend' | 'deploy' | 'git' | 'sites' | 'apps'
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
}

const CATEGORIAS: { value: Categoria | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'sql', label: 'SQL/Banco' },
  { value: 'frontend', label: 'Frontend' },
  { value: 'backend', label: 'Backend/API' },
  { value: 'deploy', label: 'Deploy' },
  { value: 'git', label: 'Git' },
  { value: 'sites', label: 'Criacao de Sites' },
  { value: 'apps', label: 'Apps' },
]

const NIVEL_LABEL: Record<Nivel, string> = {
  iniciante: '\uD83D\uDFE2 Iniciante',
  intermediario: '\uD83D\uDFE1 Intermediario',
  avancado: '\uD83D\uDD34 Avancado',
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
    oQueE: 'Uma tabela e a estrutura basica de armazenamento de dados no banco PostgreSQL do Supabase. Cada tabela tem colunas (campos) e linhas (registros).',
    quandoUsar: 'Sempre que voce precisa armazenar um novo tipo de dado no sistema. Ex: cadastrar fornecedores, ordens de producao, logs de atividade.',
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
    porQue: 'O banco de dados e a fundacao do sistema. Sem tabelas bem definidas, o frontend nao consegue salvar nem consultar dados. RLS garante seguranca.',
  },
  {
    id: 'cron-job',
    titulo: 'Como criar um cron job (tarefa agendada)',
    categoria: 'sql',
    nivel: 'intermediario',
    tags: ['cron', 'pg_cron', 'pg_net', 'agendamento', 'automatizacao'],
    oQueE: 'Um cron job e uma tarefa que roda automaticamente em intervalos regulares no banco de dados, usando a extensao pg_cron do Supabase.',
    quandoUsar: 'Para tarefas periodicas como: recalcular scores RFM diariamente, limpar registros antigos, enviar notificacoes agendadas.',
    comoFazer: `-- Habilitar extensao (se ainda nao estiver)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Exemplo: recalcular RFM todo dia as 3h
SELECT cron.schedule(
  'rfm-diario',           -- nome do job
  '0 3 * * *',            -- cron expression: 3h todo dia
  $$SELECT fn_calcular_rfm()$$  -- comando SQL
);

-- Ver jobs agendados
SELECT * FROM cron.job;

-- Remover um job
SELECT cron.unschedule('rfm-diario');

-- Ver historico de execucoes
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC LIMIT 20;`,
    ondeFazer: 'Supabase Dashboard > SQL Editor. Precisa que pg_cron esteja habilitado em Database > Extensions.',
    porQue: 'Automatiza tarefas repetitivas sem precisar de servidor externo. O banco faz tudo sozinho no horario certo.',
  },
  {
    id: 'rpc-function',
    titulo: 'Como criar uma RPC/Function no banco',
    categoria: 'sql',
    nivel: 'intermediario',
    tags: ['function', 'rpc', 'plpgsql', 'supabase', 'stored procedure'],
    oQueE: 'Uma function (ou RPC) e um bloco de codigo SQL que roda dentro do banco. Voce chama pelo frontend com supabaseAdmin.rpc("nome_funcao").',
    quandoUsar: 'Quando precisa de logica complexa que seria lenta ou insegura no frontend. Ex: calcular scores, buscar dados agregados, operacoes em lote.',
    comoFazer: `-- Exemplo: funcao que retorna top prospects por score
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
SECURITY DEFINER  -- roda com permissoes do owner
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

-- Dar permissao para o service_role chamar
GRANT EXECUTE ON FUNCTION fn_top_prospects TO service_role;

-- Chamar no frontend:
-- const { data } = await supabaseAdmin.rpc('fn_top_prospects', { n: 50, filtro_uf: 'MG' })`,
    ondeFazer: 'Supabase Dashboard > SQL Editor. Ou em arquivo de migration.',
    porQue: 'Functions rodam direto no banco, muito mais rapidas que buscar tudo no frontend e processar. SECURITY DEFINER garante que a logica tem as permissoes certas.',
  },
  {
    id: 'criar-indice',
    titulo: 'Como criar um indice no banco',
    categoria: 'sql',
    nivel: 'intermediario',
    tags: ['index', 'performance', 'consulta', 'otimizacao'],
    oQueE: 'Um indice e como um "sumario" que o banco cria para encontrar dados mais rapido. Sem indice, o banco precisa ler TODAS as linhas da tabela.',
    quandoUsar: 'Quando uma consulta esta lenta, especialmente em tabelas grandes (>10K linhas). Consultas com WHERE, JOIN ou ORDER BY se beneficiam de indices.',
    comoFazer: `-- Criar indice SEM travar a tabela (sempre usar CONCURRENTLY)
CREATE INDEX CONCURRENTLY idx_prospeccao_uf
  ON prospeccao (uf);

-- Indice composto (2+ colunas)
CREATE INDEX CONCURRENTLY idx_prospeccao_uf_segmento
  ON prospeccao (uf, segmento);

-- Indice parcial (so para registros ativos)
CREATE INDEX CONCURRENTLY idx_prospeccao_ativo
  ON prospeccao (uf) WHERE ativo = true;

-- Ver indices existentes de uma tabela
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'prospeccao';

-- Remover indice desnecessario
DROP INDEX IF EXISTS idx_prospeccao_uf;`,
    ondeFazer: 'Supabase Dashboard > SQL Editor. Usar CONCURRENTLY para nao travar o banco durante a criacao.',
    porQue: 'Sem indice, consultas em tabelas com 800K+ registros (como prospeccao) podem levar segundos. Com indice, caem para milissegundos.',
  },
  {
    id: 'migration',
    titulo: 'Como fazer uma migration',
    categoria: 'sql',
    nivel: 'iniciante',
    tags: ['migration', 'versionamento', 'sql', 'supabase'],
    oQueE: 'Uma migration e um arquivo SQL versionado que documenta mudancas no banco. Fica em supabase/migrations/ com timestamp no nome.',
    quandoUsar: 'Sempre que voce muda a estrutura do banco: criar tabela, adicionar coluna, criar function. Isso garante que as mudancas sao rastreadas e reproduziveis.',
    comoFazer: `-- 1. Criar arquivo com timestamp
-- Nome: supabase/migrations/20260501_nova_feature.sql

-- 2. Escrever o SQL da mudanca
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
    ondeFazer: 'Crie o arquivo .sql na pasta supabase/migrations/. Execute o conteudo no SQL Editor. Depois faca commit no Git.',
    porQue: 'Sem migrations, voce perde o historico de mudancas do banco. Se precisar recriar o banco ou revisar o que mudou, as migrations sao essenciais.',
  },

  // Frontend
  {
    id: 'componente-react',
    titulo: 'Como criar um componente React',
    categoria: 'frontend',
    nivel: 'iniciante',
    tags: ['react', 'componente', 'typescript', 'props', 'estado'],
    oQueE: 'Um componente React e uma funcao TypeScript que retorna HTML (JSX). E a unidade basica de construcao da interface.',
    quandoUsar: 'Sempre que voce precisa de um pedaco reutilizavel de interface. Ex: um botao customizado, um card de produto, um formulario.',
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
    ondeFazer: 'Crie o arquivo .tsx dentro de src/components/ (se reutilizavel) ou src/pages/ (se for pagina). Sempre acompanhado do .module.css.',
    porQue: 'Componentes permitem reutilizar interface e logica. Em vez de copiar HTML, voce importa o componente onde precisar.',
  },
  {
    id: 'pagina-admin',
    titulo: 'Como criar uma pagina admin (modulo completo)',
    categoria: 'frontend',
    nivel: 'intermediario',
    tags: ['admin', 'modulo', 'rota', 'permissao', 'nav'],
    oQueE: 'Um modulo admin e uma pagina completa dentro do painel administrativo, com rota propria, permissao de acesso e item no menu lateral.',
    quandoUsar: 'Quando voce precisa de uma nova area no admin. Ex: gestao de fornecedores, controle de qualidade, novo relatorio.',
    comoFazer: `// 1. Criar o componente: src/pages/AdminNovo.tsx
import styles from './AdminNovo.module.css'

export default function AdminNovo() {
  return (
    <div className={styles.container}>
      <h2>Novo Modulo</h2>
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
// - Adicionar item em NAV_ITEMS com icone SVG

// 5. Dar permissao no banco:
// UPDATE admin_perfis SET permissoes = permissoes || '{novo}';`,
    ondeFazer: 'Arquivo .tsx em src/pages/, rota em App.tsx, permissoes em AdminLayout.tsx, SQL no Supabase.',
    porQue: 'Seguir esse padrao garante que o modulo tera controle de acesso, aparecera no menu e sera consistente com os outros modulos.',
  },
  {
    id: 'css-modules',
    titulo: 'CSS Modules - como funciona',
    categoria: 'frontend',
    nivel: 'iniciante',
    tags: ['css', 'modulos', 'estilos', 'classes'],
    oQueE: 'CSS Modules e um sistema onde cada arquivo .module.css gera classes unicas automaticamente. Isso evita conflito de nomes entre componentes.',
    quandoUsar: 'Sempre que criar um componente ou pagina. E o padrao do projeto Pousinox.',
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
// <div className={styles.card}>conteudo</div>

/* Para classes adicionadas via JS puro (body.classList.add): */
/* usar :global(.minhaClasse) { ... } */`,
    ondeFazer: 'Crie o arquivo .module.css ao lado do .tsx. Importe como "styles" no componente.',
    porQue: 'Sem CSS Modules, classes como .container ou .card de componentes diferentes podem conflitar. Com Modules, cada classe e unica.',
  },
  {
    id: 'searchable-select',
    titulo: 'Como usar o SearchableSelect',
    categoria: 'frontend',
    nivel: 'iniciante',
    tags: ['select', 'dropdown', 'busca', 'componente', 'filtro'],
    oQueE: 'SearchableSelect e um componente dropdown com campo de busca integrado. Substitui o <select> nativo com melhor UX.',
    quandoUsar: 'Em formularios onde ha muitas opcoes (UFs, segmentos, fornecedores). Permite digitar para filtrar.',
    comoFazer: `import SearchableSelect from '../components/SearchableSelect/SearchableSelect'

// Opcoes no formato { value, label }
const opcoes = [
  { value: 'MG', label: 'Minas Gerais' },
  { value: 'SP', label: 'Sao Paulo' },
  { value: 'RJ', label: 'Rio de Janeiro' },
]

// Uso basico
<SearchableSelect
  value={ufSelecionada}
  onChange={setUfSelecionada}
  options={opcoes}
  placeholder="Selecione a UF"
  searchPlaceholder="Buscar estado..."
  minWidth={200}
/>

// O componente:
// - Filtra opcoes conforme digita
// - Highlight na opcao selecionada
// - Botao X para limpar selecao
// - Fecha ao clicar fora`,
    ondeFazer: 'Importe de src/components/SearchableSelect/SearchableSelect.tsx e passe as props necessarias.',
    porQue: 'O select nativo do HTML e limitado: nao tem busca, nao tem estilo customizavel. SearchableSelect resolve isso com uma UX moderna.',
  },

  // Backend/API
  {
    id: 'edge-function',
    titulo: 'Como criar uma Edge Function',
    categoria: 'backend',
    nivel: 'intermediario',
    tags: ['deno', 'edge function', 'supabase', 'api', 'serverless'],
    oQueE: 'Uma Edge Function e um pedaco de codigo que roda no servidor do Supabase (Deno). Usado para logica que nao pode ficar no frontend (chaves secretas, processamento pesado).',
    quandoUsar: 'Para integracoes com APIs externas (Z-API, Brave, Gemini), processamento de PDF, validacoes server-side.',
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

      // Sua logica aqui
      const resultado = { ok: true, processado: dados }

      return new Response(JSON.stringify(resultado), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Acao invalida' }), {
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
    porQue: 'O frontend e publico - qualquer pessoa pode ver o codigo. Chaves de API, logica de seguranca e processamento pesado devem ficar no servidor.',
  },
  {
    id: 'supabase-api',
    titulo: 'Como chamar a API do Supabase (CRUD)',
    categoria: 'backend',
    nivel: 'iniciante',
    tags: ['supabase', 'select', 'insert', 'update', 'delete', 'rpc', 'api'],
    oQueE: 'O cliente Supabase (@supabase/supabase-js) permite fazer operacoes no banco diretamente do frontend: buscar, inserir, atualizar e deletar dados.',
    quandoUsar: 'Sempre que precisar ler ou escrever dados no banco. E a forma padrao de interagir com o Supabase no projeto.',
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
  .insert({ nome: 'Acos Silva', cnpj: '12345678000100' })
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
    ondeFazer: 'Em qualquer componente React. Importe supabaseAdmin de src/lib/supabase.ts. Para tabelas publicas, use supabase (sem Admin).',
    porQue: 'O Supabase gera uma API REST automaticamente para cada tabela. O cliente JS facilita as chamadas com tipagem e filtros encadeados.',
  },
  {
    id: 'zapi-whatsapp',
    titulo: 'Como usar a Z-API (WhatsApp)',
    categoria: 'backend',
    nivel: 'avancado',
    tags: ['zapi', 'whatsapp', 'mensagem', 'validacao', 'api'],
    oQueE: 'A Z-API e o servico usado para integrar WhatsApp no sistema. Permite verificar se um numero tem WhatsApp e enviar mensagens.',
    quandoUsar: 'Para validar numeros de telefone de prospects (verificar se aceitam WhatsApp) e para envio de mensagens automatizadas.',
    comoFazer: `// Edge function: supabase/supabase/functions/validar-whatsapp/index.ts

// Verificar se numero tem WhatsApp
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
// Em lote, processar no maximo 50 por vez com delay

// Secrets necessarias no Supabase:
// ZAPI_INSTANCE_ID
// ZAPI_TOKEN
// ZAPI_CLIENT_TOKEN

// Chamar do frontend:
// await supabaseAdmin.functions.invoke('validar-whatsapp', {
//   body: { acao: 'check', telefone: '5535999998888' }
// })`,
    ondeFazer: 'Toda integracao Z-API deve ficar em Edge Functions (nunca no frontend). As chaves ficam como secrets do Supabase.',
    porQue: 'As chaves da Z-API dao acesso total a sua conta WhatsApp Business. Se ficarem no frontend, qualquer pessoa pode usa-las.',
  },

  // Deploy
  {
    id: 'deploy-cloudflare',
    titulo: 'Como fazer deploy no Cloudflare Pages',
    categoria: 'deploy',
    nivel: 'iniciante',
    tags: ['cloudflare', 'deploy', 'build', 'wrangler', 'producao'],
    oQueE: 'Cloudflare Pages hospeda o site estatico (HTML/CSS/JS) gerado pelo Vite. O deploy envia os arquivos da pasta dist/ para os servidores da Cloudflare.',
    quandoUsar: 'Apos finalizar alteracoes e testar localmente. O deploy publica as mudancas no site pousinox.com.br.',
    comoFazer: `# 1. Build do projeto
npm run build

# 2. Deploy via script (recomendado)
npm run deploy
# Isso roda: ../scripts/deploy.sh

# 3. Ou deploy manual via wrangler
npx wrangler pages deploy dist/ --project-name pousinox-institucional

# 4. Verificar no Cloudflare Dashboard
# https://dash.cloudflare.com > Pages > pousinox-institucional

# Deploy automatico (configurado):
# Push para branch main > Cloudflare auto-build > deploy`,
    ondeFazer: 'No terminal, na pasta pousinox-site/. Certifique-se de que o build nao tem erros antes de fazer deploy.',
    porQue: 'O deploy e o que leva suas mudancas do computador local para o site acessivel publicamente. Sem deploy, as alteracoes ficam so no seu PC.',
  },
  {
    id: 'deploy-edge-functions',
    titulo: 'Como fazer deploy de Edge Functions',
    categoria: 'deploy',
    nivel: 'iniciante',
    tags: ['supabase', 'edge function', 'deploy', 'deno'],
    oQueE: 'Deploy de Edge Functions envia o codigo Deno para os servidores do Supabase, tornando a funcao acessivel via API.',
    quandoUsar: 'Apos criar ou alterar uma Edge Function. Precisa fazer deploy para que as mudancas tenham efeito.',
    comoFazer: `# Deploy de uma funcao especifica
cd ../supabase
supabase functions deploy minha-funcao --project-ref SEU_PROJECT_REF

# Deploy de todas as funcoes
supabase functions deploy --project-ref SEU_PROJECT_REF

# Adicionar secret (chave de API)
supabase secrets set MINHA_API_KEY=valor_da_chave --project-ref SEU_PROJECT_REF

# Listar secrets
supabase secrets list --project-ref SEU_PROJECT_REF

# Ver logs da funcao
supabase functions logs minha-funcao --project-ref SEU_PROJECT_REF`,
    ondeFazer: 'No terminal, na pasta supabase/. Precisa do CLI do Supabase instalado e estar logado (supabase login).',
    porQue: 'Edge Functions rodam no servidor. Se voce nao fizer deploy, o Supabase continua rodando a versao antiga do codigo.',
  },

  // Git
  {
    id: 'fluxo-git',
    titulo: 'Fluxo Git basico',
    categoria: 'git',
    nivel: 'iniciante',
    tags: ['git', 'commit', 'push', 'branch', 'merge', 'versionamento'],
    oQueE: 'Git e o sistema de versionamento que rastreia todas as mudancas no codigo. Cada "commit" e uma fotografia do estado do projeto naquele momento.',
    quandoUsar: 'Sempre. Todo trabalho deve ser commitado no Git. Antes de desligar o computador, antes de mudar de assunto, antes de fazer deploy.',
    comoFazer: `# Ver o que mudou
git status

# Ver diferenca nos arquivos
git diff

# Adicionar arquivos para commit (especificos)
git add src/pages/AdminNovo.tsx src/pages/AdminNovo.module.css

# Criar commit com mensagem descritiva
git commit -m "feat: adicionar modulo AdminNovo com CRUD"

# Enviar para o GitHub
git push

# --- Branches ---

# Criar branch para feature nova
git checkout -b minha-feature

# Voltar para main
git checkout main

# Trazer mudancas da branch para main
git merge minha-feature

# --- Boas praticas ---
# Prefixos de commit:
# feat:  nova funcionalidade
# fix:   correcao de bug
# chore: tarefas de manutencao
# docs:  documentacao
# refactor: refatoracao (sem mudar comportamento)`,
    ondeFazer: 'No terminal (Git Bash, VS Code terminal, Claude Code). Sempre na pasta raiz do projeto.',
    porQue: 'Sem Git voce perde o historico de mudancas. Se algo quebrar, voce pode voltar para uma versao anterior. Alem disso, o deploy depende do Git.',
  },
  {
    id: 'badge-dinamica',
    titulo: 'Como criar badges dinamicas com dados do estado',
    categoria: 'frontend',
    nivel: 'iniciante',
    tags: ['badge', 'jsx', 'array', 'join', 'filter', 'estado', 'react'],
    oQueE: 'Badge e uma etiqueta visual que mostra informacao resumida (ex: "MG · Sul/Sudoeste de Minas · POUSO ALEGRE"). Ela reflete o estado atual dos filtros ou dados selecionados.',
    quandoUsar: 'Sempre que tiver uma secao colapsavel ou card onde o usuario precisa ver o resumo sem abrir. Exemplos: filtros salvos, status, contadores.',
    comoFazer: `// Exemplo real: badge do cron de prospeccao
// cronConfig tem arrays: { uf: ['MG'], mesorregiao: ['Sul/Sudoeste de Minas'], cidade: ['POUSO ALEGRE'], segmento: [] }

// ERRADO - esquecendo um campo (cidade nao aparece):
{[cronConfig.uf.join(','), cronConfig.mesorregiao.join(',')].filter(Boolean).join(' . ')}

// CERTO - incluir TODOS os campos relevantes:
{[
  cronConfig.uf.join(','),
  cronConfig.mesorregiao.join(','),
  cronConfig.cidade.join(','),       // <-- nao esquecer!
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
    ondeFazer: 'No arquivo .tsx do modulo, dentro do JSX. Geralmente no <summary> de um <details> (secao colapsavel).',
    porQue: 'Sem a badge, o usuario precisa abrir a secao para ver o que esta selecionado. Com a badge, a informacao fica visivel mesmo com a secao fechada.',
  },
  {
    id: 'admin-loading',
    titulo: 'Como usar o AdminLoading (spinner e progresso)',
    categoria: 'frontend',
    nivel: 'iniciante',
    tags: ['loading', 'spinner', 'progresso', 'componente', 'AdminLoading', 'useLoadingProgress'],
    oQueE: 'AdminLoading e o componente padrao para estados de carregamento no admin. Tem dois modos: spinner animado (sem %) e anel de progresso (com %).',
    quandoUsar: 'Sempre que o sistema estiver carregando dados, validando, fazendo upload/download. NUNCA usar texto "Carregando..." puro.',
    comoFazer: `// 1. Importar o componente
import AdminLoading from '../components/AdminLoading/AdminLoading'

// 2a. MODO SPINNER (sem progresso definido)
// Usa quando nao sabe quantos passos faltam
{loading ? <AdminLoading /> : <ConteudoReal />}

// 2b. MODO PROGRESSO (com %)
// Usa quando sabe o total de passos
{loading ? <AdminLoading total={10} current={3} /> : <ConteudoReal />}
// Mostra: anel com "30%" no centro

// 2c. COM LABEL
<AdminLoading label="Validando numeros..." />
<AdminLoading total={50} current={25} label="Validando WhatsApp..." />

// --- Hook useLoadingProgress (para progresso automatico) ---
import { useLoadingProgress } from '../hooks/useLoadingProgress'

// No componente:
const prog = useLoadingProgress()

// Ao carregar dados:
async function carregarDados() {
  prog.reset(3) // 3 passos no total

  const { data: clientes } = await supabaseAdmin.from('clientes').select('*')
  prog.step() // passo 1 concluido

  const { data: vendas } = await supabaseAdmin.from('vendas').select('*')
  prog.step() // passo 2 concluido

  const { data: pipeline } = await supabaseAdmin.from('pipeline_deals').select('*')
  prog.step() // passo 3 concluido (100%)
}

// No JSX:
{loading
  ? <AdminLoading total={prog.total} current={prog.current} label="Carregando dados..." />
  : <ConteudoReal />
}`,
    ondeFazer: 'Em qualquer arquivo .tsx de modulo admin. Importar de ../components/AdminLoading/AdminLoading.',
    porQue: 'O spinner animado da feedback visual profissional ao usuario. O modo com % mostra exatamente quanto falta, evitando a sensacao de "travou". E padrao do sistema - usar texto simples e proibido.',
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

export default function AdminKnowledge() {
  const [busca, setBusca] = useState('')
  const [catAtiva, setCatAtiva] = useState<Categoria | 'todos'>('todos')

  const buscaLower = busca.toLowerCase()

  const filtradas = GUIAS.filter(g => {
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
      ? GUIAS.length
      : GUIAS.filter(g => g.categoria === c.value).length
    return acc
  }, {})

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Base de Conhecimento</h2>
        <p>Guias praticos para desenvolvimento — busque por tema ou filtre por categoria.</p>
      </div>

      <input
        className={styles.searchBox}
        type="text"
        placeholder="Buscar guia... (ex: tabela, deploy, componente)"
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
        filtradas.map(g => (
          <details key={g.id} className={styles.card}>
            <summary>
              <span>{g.titulo}</span>
              <span className={styles[NIVEL_CLASS[g.nivel]]}>{NIVEL_LABEL[g.nivel]}</span>
              <span className={styles.badgeCat}>{CATEGORIAS.find(c => c.value === g.categoria)?.label}</span>
            </summary>
            <div className={styles.cardBody}>
              <GuiaSection titulo="O que e" conteudo={g.oQueE} />
              <GuiaSection titulo="Quando usar" conteudo={g.quandoUsar} />
              <GuiaSection titulo="Como fazer" conteudo={g.comoFazer} />
              <GuiaSection titulo="Onde fazer" conteudo={g.ondeFazer} />
              <GuiaSection titulo="Por que" conteudo={g.porQue} />
            </div>
          </details>
        ))
      )}
    </div>
  )
}
