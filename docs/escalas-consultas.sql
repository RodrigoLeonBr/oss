-- Consultas sobre as escalas (tb_escala_*). Base: vw_escala_realizados (exclui riscado/falta/férias/folga).
-- Parâmetros como variáveis de sessão; ajuste e rode o bloco desejado (MariaDB 11 / MySQL 8).
SET @ini = '2026-03-01', @fim = '2026-04-01', @unidade = 'HMA', @busca = 'silva', @registro = '000000';

-- 1. Efetivo por dia e turno: profissionais distintos por unidade/setor
SELECT unidade, setor, data, TIME(inicio) AS turno, COUNT(DISTINCT profissional_id) AS profissionais
FROM vw_escala_realizados
WHERE data >= @ini AND data < @fim AND unidade = @unidade
GROUP BY unidade, setor, data, TIME(inicio)
ORDER BY setor, data, turno;

-- 2. Efetivo no período (distintos) por unidade e categoria
SELECT unidade, categoria, COUNT(DISTINCT profissional_id) AS profissionais, COUNT(*) AS plantoes, SUM(horas) AS horas
FROM vw_escala_realizados
WHERE data >= @ini AND data < @fim
GROUP BY unidade, categoria;

-- 3. Quem estava de plantão num instante
SET @t = '2026-03-14 03:00';
SELECT unidade, setor, profissional, conselho, registro_numero, modalidade, inicio, fim
FROM vw_escala_realizados WHERE inicio <= @t AND fim > @t ORDER BY unidade, setor;

-- 4. Busca de profissional por nome (qualquer grafia vista) ou registro
SELECT DISTINCT pr.profissional_id, pr.nome, pr.conselho, pr.registro_numero, pr.registro_uf, pr.categoria
FROM tb_escala_profissionais pr
LEFT JOIN tb_escala_profissional_alias a ON a.profissional_id = pr.profissional_id
WHERE pr.registro_numero = @registro
   OR a.nome_normalizado LIKE CONCAT('%', UPPER(@busca), '%');

-- 5. Agenda do profissional em todas as unidades
SELECT u.sigla AS unidade, s.nome AS setor, p.data, p.inicio, p.fim, p.horas, p.modalidade, p.marcacao
FROM tb_escala_plantoes p
JOIN tb_unidades u USING (unidade_id)
LEFT JOIN tb_escala_setores s USING (setor_id)
JOIN tb_escala_profissionais pr USING (profissional_id)
WHERE pr.registro_numero = @registro AND p.data >= @ini AND p.data < @fim
ORDER BY inicio;

-- 6. Colegas: quem dividiu turno (sobreposição de horário) no mesmo setor com o profissional
SELECT o.profissional, o.registro_numero, COUNT(*) AS turnos_juntos
FROM vw_escala_realizados e
JOIN vw_escala_realizados o ON o.setor_id = e.setor_id AND o.profissional_id <> e.profissional_id
 AND o.inicio < e.fim AND e.inicio < o.fim
WHERE e.registro_numero = @registro AND e.data >= @ini AND e.data < @fim
GROUP BY o.profissional_id ORDER BY turnos_juntos DESC;

-- 7. Jornada contínua (plantões encadeados sem intervalo, inclusive entre unidades) > 24h
--    ilha nova quando o plantão começa depois do maior fim anterior.
WITH ord AS (
  SELECT profissional_id, profissional, registro_numero, unidade, inicio, fim,
         MAX(fim) OVER (PARTITION BY profissional_id ORDER BY inicio, fim ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS fim_ant
  FROM vw_escala_realizados WHERE modalidade <> 'sobreaviso' AND data >= @ini AND data < @fim
), ilhas AS (
  SELECT *, SUM(CASE WHEN fim_ant IS NULL OR inicio > fim_ant THEN 1 ELSE 0 END)
            OVER (PARTITION BY profissional_id ORDER BY inicio, fim) AS ilha
  FROM ord
)
SELECT profissional, registro_numero, MIN(inicio) AS de, MAX(fim) AS ate,
       TIMESTAMPDIFF(MINUTE, MIN(inicio), MAX(fim)) / 60 AS horas_seguidas,
       COUNT(*) AS plantoes, GROUP_CONCAT(DISTINCT unidade) AS unidades
FROM ilhas GROUP BY profissional_id, ilha
HAVING horas_seguidas > 24
ORDER BY horas_seguidas DESC;

-- 8. Interjornada curta: menos de 11h entre o fim de um plantão e o início do próximo
WITH seq AS (
  SELECT profissional, registro_numero, unidade, setor, inicio, fim,
         LEAD(inicio) OVER (PARTITION BY profissional_id ORDER BY inicio) AS prox_inicio
  FROM vw_escala_realizados WHERE modalidade <> 'sobreaviso' AND data >= @ini AND data < @fim
)
SELECT *, TIMESTAMPDIFF(MINUTE, fim, prox_inicio) / 60 AS descanso_h
FROM seq WHERE prox_inicio > fim AND TIMESTAMPDIFF(MINUTE, fim, prox_inicio) < 11 * 60
ORDER BY descanso_h;

-- 9. Sobreposição: mesmo profissional em dois lugares ao mesmo tempo (exclui sobreaviso)
SELECT a.profissional, a.registro_numero, a.unidade AS unidade_a, a.setor AS setor_a, a.inicio AS ini_a, a.fim AS fim_a,
       b.unidade AS unidade_b, b.setor AS setor_b, b.inicio AS ini_b, b.fim AS fim_b,
       TIMESTAMPDIFF(MINUTE, GREATEST(a.inicio, b.inicio), LEAST(a.fim, b.fim)) / 60 AS horas_sobrepostas
FROM vw_escala_realizados a
JOIN vw_escala_realizados b ON b.profissional_id = a.profissional_id AND a.plantao_id < b.plantao_id
 AND a.inicio < b.fim AND b.inicio < a.fim AND (a.unidade_id <> b.unidade_id OR a.setor_id <> b.setor_id)
WHERE a.modalidade <> 'sobreaviso' AND b.modalidade <> 'sobreaviso' AND a.data >= @ini AND a.data < @fim
ORDER BY (a.unidade_id <> b.unidade_id) DESC, horas_sobrepostas DESC;

-- 10. Carga por profissional no mês: ranking de plantões e horas (todas as unidades)
SELECT profissional, registro_numero, categoria, COUNT(*) AS plantoes, SUM(horas) AS horas,
       COUNT(DISTINCT unidade_id) AS unidades, SUM(marcacao = 'cobertura') AS coberturas
FROM vw_escala_realizados WHERE data >= @ini AND data < @fim AND modalidade <> 'sobreaviso'
GROUP BY profissional_id HAVING horas > 240
ORDER BY horas DESC;

-- 11. Concentração: % das horas do setor feitas por um único profissional
SELECT * FROM (
  SELECT unidade, setor, profissional, SUM(horas) AS horas,
         ROUND(100 * SUM(horas) / SUM(SUM(horas)) OVER (PARTITION BY unidade, setor), 1) AS pct_setor
  FROM vw_escala_realizados WHERE data >= @ini AND data < @fim
  GROUP BY unidade, setor, profissional_id
) x WHERE pct_setor >= 50 ORDER BY pct_setor DESC;

-- 12. Vazios: dias do período sem nenhum plantão realizado num setor/turno que costuma ter cobertura
WITH RECURSIVE dias AS (
  SELECT CAST(@ini AS DATE) AS d UNION ALL SELECT d + INTERVAL 1 DAY FROM dias WHERE d + INTERVAL 1 DAY < @fim
), habitual AS (  -- setor+turno presente em >= 80% dos dias
  SELECT unidade, setor_id, setor, TIME(inicio) AS turno
  FROM vw_escala_realizados WHERE data >= @ini AND data < @fim
  GROUP BY unidade, setor_id, TIME(inicio)
  HAVING COUNT(DISTINCT data) >= 0.8 * DATEDIFF(@fim, @ini)
)
SELECT h.unidade, h.setor, h.turno, dias.d AS dia_sem_profissional
FROM habitual h CROSS JOIN dias
WHERE NOT EXISTS (SELECT 1 FROM vw_escala_realizados r
                  WHERE r.setor_id = h.setor_id AND r.data = dias.d AND TIME(r.inicio) = h.turno)
ORDER BY h.unidade, h.setor, dias.d;

-- 13. Furos, faltas e riscados (plantão previsto que não aconteceu como escalado)
SELECT u.sigla AS unidade, s.nome AS setor, p.marcacao, COUNT(*) AS qtd
FROM tb_escala_plantoes p JOIN tb_unidades u USING (unidade_id) LEFT JOIN tb_escala_setores s USING (setor_id)
WHERE p.data >= @ini AND p.data < @fim
  AND (p.profissional_id IS NULL OR p.marcacao NOT IN ('normal', 'cobertura', 'troca', 'extra'))
GROUP BY u.sigla, s.nome, p.marcacao ORDER BY qtd DESC;

-- 14. Coberturas: % dos plantões feitos em cobertura por unidade/setor/mês
SELECT unidade, setor, DATE_FORMAT(data, '%Y-%m') AS competencia, COUNT(*) AS plantoes,
       ROUND(100 * AVG(marcacao = 'cobertura'), 1) AS pct_cobertura
FROM vw_escala_realizados GROUP BY unidade, setor, competencia
ORDER BY pct_cobertura DESC;

-- 15. Comparativo mensal por unidade (evolução de efetivo e horas)
SELECT unidade, DATE_FORMAT(data, '%Y-%m') AS competencia, COUNT(DISTINCT profissional_id) AS profissionais,
       COUNT(*) AS plantoes, SUM(horas) AS horas, ROUND(SUM(horas) / COUNT(DISTINCT profissional_id), 1) AS horas_por_prof
FROM vw_escala_realizados GROUP BY unidade, competencia ORDER BY unidade, competencia;

-- 16. Qualidade do dado: arquivos a revisar e registros com grafias muito diferentes
SELECT u.sigla, a.competencia, a.assunto, a.metodo, a.status, a.qtd_plantoes, a.obs
FROM tb_escala_arquivos a JOIN tb_unidades u USING (unidade_id) WHERE a.status <> 'ok';

SELECT pr.conselho, pr.registro_numero, pr.nome, GROUP_CONCAT(a.nome_bruto SEPARATOR ' | ') AS grafias
FROM tb_escala_profissionais pr JOIN tb_escala_profissional_alias a USING (profissional_id)
GROUP BY pr.profissional_id HAVING COUNT(DISTINCT LEFT(a.nome_normalizado, 4)) > 1;
