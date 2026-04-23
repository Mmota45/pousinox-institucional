-- Remove constraint hardcoded de negocio em fin_contas.
-- O campo agora aceita qualquer texto (nome vem de fin_negocios dinamicamente).
ALTER TABLE fin_contas DROP CONSTRAINT IF EXISTS fin_contas_negocio_check;
