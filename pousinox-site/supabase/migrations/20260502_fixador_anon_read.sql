-- Leitura pública (anon) para a calculadora de fixadores
-- As tabelas só tinham policy service_role, bloqueando o cliente anon

CREATE POLICY "anon_read_fixador_modelos" ON fixador_modelos
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_fixador_consumiveis" ON fixador_consumiveis
  FOR SELECT TO anon USING (ativo = true);

CREATE POLICY "anon_read_fixador_regras" ON fixador_regras_calculo
  FOR SELECT TO anon USING (true);
