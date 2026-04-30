-- Remover duplicatas sem prefixo ANVISA (já existem com prefixo)
DELETE FROM portfolio_normas WHERE norma = 'RDC 216/2004';
DELETE FROM portfolio_normas WHERE norma = 'RDC 275/2002';
DELETE FROM portfolio_normas WHERE norma = 'RDC 50/2002';

-- Padronizar os que não têm duplicata
UPDATE portfolio_normas SET norma = 'RDC ANVISA 222/2018' WHERE norma = 'RDC 222/2018';
UPDATE portfolio_normas SET norma = 'RDC ANVISA 52/2014' WHERE norma = 'RDC 52/2014';
UPDATE portfolio_normas SET norma = 'RDC ANVISA 67/2007' WHERE norma = 'RDC 67/2007';
UPDATE portfolio_normas SET norma = 'RDC ANVISA 843/2024' WHERE norma = 'RDC 843/2024';
