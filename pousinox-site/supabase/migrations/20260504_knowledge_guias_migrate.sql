-- Migration: Garantir colunas extras em knowledge_guias para migração localStorage → Supabase
-- Data: 2026-05-04

-- Adicionar colunas que podem estar faltando
ALTER TABLE knowledge_guias ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE knowledge_guias ADD COLUMN IF NOT EXISTS rascunho BOOLEAN DEFAULT false;
ALTER TABLE knowledge_guias ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ DEFAULT now();
