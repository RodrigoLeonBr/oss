/**
 * Monta as linhas da comparação a partir de dados já carregados (sem DB).
 * @param {{
 *   indicadores: Array<{indicador_id:string, nome:string, unidade_medida:?string}>,
 *   informadoPorIndicador: Record<string, number>,   // valor_realizado
 *   produzidoPorIndicador: Record<string, number>,   // soma SIA/SIH dos filtros
 *   temMapa: Record<string, boolean>,                 // indicador tem ≥1 filtro ativo
 * }}
 */
function montarComparacao({ indicadores, informadoPorIndicador, produzidoPorIndicador, temMapa }) {
  return indicadores.map((ind) => {
    const id = ind.indicador_id;
    const semMapeamento = !temMapa[id];
    const informado = informadoPorIndicador[id] != null ? informadoPorIndicador[id] : null;
    const registrado = semMapeamento ? null
      : (produzidoPorIndicador[id] != null ? produzidoPorIndicador[id] : 0);
    const ambos = informado != null && registrado != null;
    const diferenca = ambos ? parseFloat((informado - registrado).toFixed(4)) : null;
    const divergenciaPerc = ambos && registrado > 0
      ? parseFloat((((informado - registrado) / registrado) * 100).toFixed(2))
      : null;
    return {
      indicadorId: id,
      nome: ind.nome,
      unidadeMedida: ind.unidade_medida || null,
      informado,
      registrado,
      diferenca,
      divergenciaPerc,
      semMapeamento,
    };
  });
}

module.exports = { montarComparacao };
