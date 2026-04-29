-- Modelos de IA configuráveis pelo admin
CREATE TABLE IF NOT EXISTS ai_hub_models (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider TEXT NOT NULL,          -- groq, openrouter, together, cohere, huggingface, cloudflare
  model_id TEXT NOT NULL,          -- ID do modelo na API do provider
  display_name TEXT,               -- Nome amigável
  free BOOLEAN DEFAULT true,
  context_length INT,
  price TEXT,                      -- ex: "$0.60/1M"
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(provider, model_id)
);

-- RLS
ALTER TABLE ai_hub_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_ai_hub_models" ON ai_hub_models USING (auth.role() = 'service_role');

-- Trigger updated_at
CREATE TRIGGER set_updated_at_ai_hub_models
  BEFORE UPDATE ON ai_hub_models
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed: modelos atuais do sistema
INSERT INTO ai_hub_models (provider, model_id, display_name, free) VALUES
  ('groq', 'llama-3.3-70b-versatile', 'Llama 3.3 70B', true),
  ('groq', 'llama-3.1-8b-instant', 'Llama 3.1 8B', true),
  ('groq', 'mixtral-8x7b-32768', 'Mixtral 8x7B', true),
  ('groq', 'gemma2-9b-it', 'Gemma 2 9B', true),
  ('groq', 'llama-3.2-90b-vision-preview', 'Llama 3.2 90B Vision', true),
  ('groq', 'deepseek-r1-distill-llama-70b', 'DeepSeek R1 Distill 70B', true),
  ('groq', 'mistral-saba-24b', 'Mistral Saba 24B', true),
  ('groq', 'qwen-qwq-32b', 'Qwen QwQ 32B', true),
  ('gemini', 'gemini-2.5-flash', 'Gemini 2.5 Flash', true),
  ('cohere', 'command-a-03-2025', 'Command A', true),
  ('cohere', 'command-r7b-12-2024', 'Command R7B', true),
  ('huggingface', 'mistralai/Mistral-7B-Instruct-v0.3', 'Mistral 7B', true),
  ('huggingface', 'google/gemma-2-2b-it', 'Gemma 2 2B', true),
  ('huggingface', 'microsoft/Phi-3-mini-4k-instruct', 'Phi-3 Mini', true),
  ('huggingface', 'meta-llama/Llama-3.1-8B-Instruct', 'Llama 3.1 8B', true),
  ('huggingface', 'Qwen/Qwen2.5-72B-Instruct', 'Qwen 2.5 72B', true),
  ('huggingface', 'mistralai/Mixtral-8x7B-Instruct-v0.1', 'Mixtral 8x7B', true),
  ('together', 'meta-llama/Llama-3.3-70B-Instruct-Turbo', 'Llama 3.3 70B Turbo', false),
  ('together', 'mistralai/Mixtral-8x7B-Instruct-v0.1', 'Mixtral 8x7B', false),
  ('together', 'Qwen/Qwen2.5-72B-Instruct-Turbo', 'Qwen 2.5 72B Turbo', false),
  ('together', 'deepseek-ai/DeepSeek-R1-Distill-Llama-70B', 'DeepSeek R1 Distill 70B', false),
  ('together', 'meta-llama/Llama-3.1-405B-Instruct-Turbo', 'Llama 3.1 405B Turbo', false),
  ('cloudflare', '@cf/meta/llama-3.1-8b-instruct', 'Llama 3.1 8B', true),
  ('cloudflare', '@cf/mistral/mistral-7b-instruct-v0.1', 'Mistral 7B', true),
  ('cloudflare', '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', 'DeepSeek R1 Qwen 32B', true),
  ('cloudflare', '@cf/qwen/qwen2.5-coder-32b-instruct', 'Qwen 2.5 Coder 32B', true),
  ('openrouter', 'google/gemini-2.5-flash-exp:free', 'Gemini 2.5 Flash', true),
  ('openrouter', 'meta-llama/llama-3.3-70b-instruct:free', 'Llama 3.3 70B', true),
  ('openrouter', 'mistralai/mistral-7b-instruct:free', 'Mistral 7B', true),
  ('openrouter', 'qwen/qwen3-coder-480b:free', 'Qwen3 Coder 480B', true),
  ('openrouter', 'deepseek/deepseek-r1:free', 'DeepSeek R1', true),
  ('openrouter', 'nvidia/llama-3.1-nemotron-70b-instruct:free', 'Nemotron 70B', true)
ON CONFLICT (provider, model_id) DO NOTHING;
