-- Migration: Adicionar coluna pasta + atualizar titulo com data dd/mm/yyyy
-- Data: 2026-05-04

-- Coluna pasta para organizar guias por assunto
ALTER TABLE knowledge_guias ADD COLUMN IF NOT EXISTS pasta TEXT DEFAULT 'geral';

-- Atualizar titulo do guia SEO com data no formato dd/mm/yyyy
UPDATE knowledge_guias
SET titulo = 'Auditoria SEO — Paginas Publicas pousinox.com.br (04/05/2026)',
    pasta = 'seo'
WHERE titulo LIKE 'Auditoria SEO%';
