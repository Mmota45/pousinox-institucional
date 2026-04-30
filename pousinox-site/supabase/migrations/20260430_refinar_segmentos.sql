-- ══════════════════════════════════════════════════════════════════
-- Refinamento de segmentos da prospecção
-- Rodar cada bloco separadamente no SQL Editor (evitar timeout)
-- ══════════════════════════════════════════════════════════════════

-- ═══ RESTAURANTES (1M) ═══
-- Lanchonete (já rodou)
-- UPDATE prospeccao SET segmento = 'Lanchonete' WHERE segmento = 'Restaurantes' AND (razao_social ILIKE '%lanchonete%' OR razao_social ILIKE '%lanch%');

UPDATE prospeccao SET segmento = 'Pizzaria' WHERE segmento = 'Restaurantes' AND razao_social ILIKE '%pizz%';
UPDATE prospeccao SET segmento = 'Bar' WHERE segmento = 'Restaurantes' AND (razao_social ILIKE '%bar %' OR razao_social ILIKE '% bar' OR razao_social ILIKE '%bar e %');
UPDATE prospeccao SET segmento = 'Cafeteria' WHERE segmento = 'Restaurantes' AND (razao_social ILIKE '%cafeter%' OR razao_social ILIKE '%café%' OR razao_social ILIKE '%cafe %');
UPDATE prospeccao SET segmento = 'Hamburgueria' WHERE segmento = 'Restaurantes' AND (razao_social ILIKE '%hamburgu%' OR razao_social ILIKE '%burger%');
UPDATE prospeccao SET segmento = 'Sorveteria' WHERE segmento = 'Restaurantes' AND (razao_social ILIKE '%sorvet%' OR razao_social ILIKE '%gelat%');
UPDATE prospeccao SET segmento = 'Churrascaria' WHERE segmento = 'Restaurantes' AND razao_social ILIKE '%churrascar%';
UPDATE prospeccao SET segmento = 'Refeições Coletivas' WHERE segmento = 'Restaurantes' AND (razao_social ILIKE '%catering%' OR razao_social ILIKE '%refeic%' OR razao_social ILIKE '%refeiç%');
UPDATE prospeccao SET segmento = 'Buffet' WHERE segmento = 'Restaurantes' AND (razao_social ILIKE '%buffet%' OR razao_social ILIKE '%bufê%');
UPDATE prospeccao SET segmento = 'Cantina' WHERE segmento = 'Restaurantes' AND razao_social ILIKE '%cantina%';

-- ═══ REVESTIMENTOS (640K) ═══
UPDATE prospeccao SET segmento = 'Marmoraria' WHERE segmento = 'Revestimentos' AND (razao_social ILIKE '%marmor%' OR razao_social ILIKE '%granit%');
UPDATE prospeccao SET segmento = 'Cerâmica' WHERE segmento = 'Revestimentos' AND (razao_social ILIKE '%ceramic%' OR razao_social ILIKE '%cerâmic%');
UPDATE prospeccao SET segmento = 'Porcelanato' WHERE segmento = 'Revestimentos' AND razao_social ILIKE '%porcelan%';
UPDATE prospeccao SET segmento = 'Vidraçaria' WHERE segmento = 'Revestimentos' AND (razao_social ILIKE '%vidrac%' OR razao_social ILIKE '%vidraç%' OR razao_social ILIKE '%vidros%');
UPDATE prospeccao SET segmento = 'Tintas e Pinturas' WHERE segmento = 'Revestimentos' AND (razao_social ILIKE '%tinta%' OR razao_social ILIKE '%pintur%');
UPDATE prospeccao SET segmento = 'Pisos' WHERE segmento = 'Revestimentos' AND (razao_social ILIKE '%piso%' OR razao_social ILIKE '%assoalho%');
UPDATE prospeccao SET segmento = 'Material de Construção' WHERE segmento = 'Revestimentos' AND (razao_social ILIKE '%material%construc%' OR razao_social ILIKE '%material%construç%' OR razao_social ILIKE '%mat%const%');
UPDATE prospeccao SET segmento = 'Home Center' WHERE segmento = 'Revestimentos' AND (razao_social ILIKE '%home%center%' OR razao_social ILIKE '%leroy%' OR razao_social ILIKE '%telha%norte%' OR razao_social ILIKE '%c%c%' OR razao_social ILIKE '%dicico%');

-- ═══ SUPERMERCADOS (491K) ═══
UPDATE prospeccao SET segmento = 'Mercearia' WHERE segmento = 'Supermercados' AND (razao_social ILIKE '%merceari%' OR razao_social ILIKE '%armazem%' OR razao_social ILIKE '%armazém%');
UPDATE prospeccao SET segmento = 'Atacadista' WHERE segmento = 'Supermercados' AND (razao_social ILIKE '%atacad%' OR razao_social ILIKE '%atacar%');
UPDATE prospeccao SET segmento = 'Hortifruti' WHERE segmento = 'Supermercados' AND (razao_social ILIKE '%hortifrut%' OR razao_social ILIKE '%sacolao%' OR razao_social ILIKE '%sacolão%' OR razao_social ILIKE '%verdur%' OR razao_social ILIKE '%frutas%');
UPDATE prospeccao SET segmento = 'Minimercado' WHERE segmento = 'Supermercados' AND (razao_social ILIKE '%minimercard%' OR razao_social ILIKE '%mini%mercad%' OR razao_social ILIKE '%minibox%');
UPDATE prospeccao SET segmento = 'Empório' WHERE segmento = 'Supermercados' AND (razao_social ILIKE '%empori%' OR razao_social ILIKE '%empório%');
UPDATE prospeccao SET segmento = 'Padaria' WHERE segmento = 'Supermercados' AND (razao_social ILIKE '%padari%' OR razao_social ILIKE '%panific%');
UPDATE prospeccao SET segmento = 'Conveniência' WHERE segmento = 'Supermercados' AND (razao_social ILIKE '%convenienc%' OR razao_social ILIKE '%conveniênc%');

-- ═══ PANIFICAÇÃO (312K) ═══
UPDATE prospeccao SET segmento = 'Confeitaria' WHERE segmento = 'Panificação' AND (razao_social ILIKE '%confeitar%' OR razao_social ILIKE '%confeit%' OR razao_social ILIKE '%doces%' OR razao_social ILIKE '%doçaria%');
UPDATE prospeccao SET segmento = 'Pastelaria' WHERE segmento = 'Panificação' AND razao_social ILIKE '%pastel%';
UPDATE prospeccao SET segmento = 'Doceria' WHERE segmento = 'Panificação' AND (razao_social ILIKE '%doceri%' OR razao_social ILIKE '%brigadeiro%' OR razao_social ILIKE '%chocolate%');
UPDATE prospeccao SET segmento = 'Padaria' WHERE segmento = 'Panificação' AND (razao_social ILIKE '%padari%' OR razao_social ILIKE '%pao %' OR razao_social ILIKE '%pão %');

-- ═══ HOSPITALAR (135K) ═══
UPDATE prospeccao SET segmento = 'Clínica' WHERE segmento = 'Hospitalar' AND (razao_social ILIKE '%clinic%' OR razao_social ILIKE '%clínic%');
UPDATE prospeccao SET segmento = 'Laboratório de Análises' WHERE segmento = 'Hospitalar' AND (razao_social ILIKE '%laborat%' OR razao_social ILIKE '%análise%' OR razao_social ILIKE '%analise%');
UPDATE prospeccao SET segmento = 'Farmácia' WHERE segmento = 'Hospitalar' AND (razao_social ILIKE '%farmac%' OR razao_social ILIKE '%farmác%' OR razao_social ILIKE '%drogari%');
UPDATE prospeccao SET segmento = 'Consultório' WHERE segmento = 'Hospitalar' AND (razao_social ILIKE '%consultori%' OR razao_social ILIKE '%consultório%');
UPDATE prospeccao SET segmento = 'UBS/Posto de Saúde' WHERE segmento = 'Hospitalar' AND (razao_social ILIKE '%ubs%' OR razao_social ILIKE '%posto%saude%' OR razao_social ILIKE '%posto%saúde%' OR razao_social ILIKE '%unidade%saude%');
UPDATE prospeccao SET segmento = 'Odontologia' WHERE segmento = 'Hospitalar' AND (razao_social ILIKE '%odonto%' OR razao_social ILIKE '%dentist%' OR razao_social ILIKE '%dental%');

-- ═══ HOTELARIA (41K) ═══
UPDATE prospeccao SET segmento = 'Pousada' WHERE segmento = 'Hotelaria' AND razao_social ILIKE '%pousad%';
UPDATE prospeccao SET segmento = 'Resort' WHERE segmento = 'Hotelaria' AND razao_social ILIKE '%resort%';
UPDATE prospeccao SET segmento = 'Hostel' WHERE segmento = 'Hotelaria' AND razao_social ILIKE '%hostel%';
UPDATE prospeccao SET segmento = 'Motel' WHERE segmento = 'Hotelaria' AND razao_social ILIKE '%motel%';
UPDATE prospeccao SET segmento = 'Flat/Apart-hotel' WHERE segmento = 'Hotelaria' AND (razao_social ILIKE '%flat%' OR razao_social ILIKE '%apart%hotel%');

-- ═══ AÇOUGUES (75K) ═══
UPDATE prospeccao SET segmento = 'Frigorífico' WHERE segmento = 'Açougues' AND (razao_social ILIKE '%frigori%' OR razao_social ILIKE '%frigorí%');
UPDATE prospeccao SET segmento = 'Casa de Carnes' WHERE segmento = 'Açougues' AND (razao_social ILIKE '%casa%carne%' OR razao_social ILIKE '%boutique%carne%');
UPDATE prospeccao SET segmento = 'Avícola' WHERE segmento = 'Açougues' AND (razao_social ILIKE '%avicol%' OR razao_social ILIKE '%avícol%' OR razao_social ILIKE '%frango%');

-- ═══ LIMPEZA ENCODING ═══
UPDATE prospeccao SET segmento = 'Panificação' WHERE segmento LIKE 'Panifica%' AND segmento != 'Panificação';
