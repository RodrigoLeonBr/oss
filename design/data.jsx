/* global React */
// Indicators data — invented but plausible for SUS context
window.INDICATORS = [
  {
    grupo: "Atenção Primária",
    items: [
      { id: "APS-01", code: "APS.01", nome: "Cobertura populacional ESF", meta: 85, realizado: 82.4, unidade: "%", desc: "Cobertura por Estratégia Saúde da Família", trend: [78,79,80,81,80,82,82.4], meses: 7, ultima: "03/2026" },
      { id: "APS-02", code: "APS.02", nome: "Consultas médicas por habitante/ano", meta: 2.5, realizado: 2.41, unidade: "cons/hab", desc: "Número médio de consultas médicas na APS", trend: [2.1,2.2,2.25,2.3,2.35,2.38,2.41], meses: 7, ultima: "03/2026" },
      { id: "APS-03", code: "APS.03", nome: "Cobertura vacinal infantil", meta: 95, realizado: 96.8, unidade: "%", desc: "Vacinação de crianças menores de 1 ano", trend: [93,94,94.5,95,95.8,96.2,96.8], meses: 7, ultima: "03/2026" },
      { id: "APS-04", code: "APS.04", nome: "Visitas domiciliares ACS", meta: 100, realizado: 71.2, unidade: "%", desc: "Taxa de cobertura de visitas domiciliares", trend: [82,78,75,73,72,71.5,71.2], meses: 7, ultima: "03/2026" },
    ]
  },
  {
    grupo: "Atenção Especializada",
    items: [
      { id: "AME-01", code: "AME.01", nome: "TMRG — Consulta especializada", meta: 30, realizado: 42, unidade: "dias", desc: "Tempo médio de resposta na regulação", trend: [48,45,44,43,42,42,42], meses: 7, ultima: "03/2026", invert: true },
      { id: "AME-02", code: "AME.02", nome: "Taxa de absenteísmo ambulatorial", meta: 15, realizado: 12.8, unidade: "%", desc: "Faltas em consultas especializadas", trend: [18,17,15,14,13.5,13,12.8], meses: 7, ultima: "03/2026", invert: true },
      { id: "AME-03", code: "AME.03", nome: "Exames de imagem realizados", meta: 4200, realizado: 4385, unidade: "exames", desc: "Volume mensal de exames de imagem", trend: [3800,3900,4000,4100,4200,4300,4385], meses: 7, ultima: "03/2026" },
    ]
  },
  {
    grupo: "Urgência e Emergência",
    items: [
      { id: "URG-01", code: "URG.01", nome: "Classificação de risco em ≤ 10min", meta: 90, realizado: 93.2, unidade: "%", desc: "Pacientes classificados em até 10 minutos", trend: [85,87,89,90,91,92.5,93.2], meses: 7, ultima: "03/2026" },
      { id: "URG-02", code: "URG.02", nome: "Permanência média no PS", meta: 6, realizado: 8.4, unidade: "horas", desc: "Tempo médio de permanência em PS", trend: [9,8.8,8.7,8.6,8.5,8.5,8.4], meses: 7, ultima: "03/2026", invert: true },
      { id: "URG-03", code: "URG.03", nome: "Taxa de reinternação em 30 dias", meta: 8, realizado: 6.9, unidade: "%", desc: "Pacientes reinternados em até 30 dias", trend: [9.5,8.8,8.2,7.8,7.5,7.1,6.9], meses: 7, ultima: "03/2026", invert: true },
    ]
  },
  {
    grupo: "Saúde Mental",
    items: [
      { id: "SMT-01", code: "SMT.01", nome: "Cobertura CAPS por 100 mil hab.", meta: 1.0, realizado: 0.82, unidade: "CAPS/100k", desc: "Centros de Atenção Psicossocial", trend: [0.7,0.72,0.75,0.78,0.8,0.81,0.82], meses: 7, ultima: "03/2026" },
      { id: "SMT-02", code: "SMT.02", nome: "Atendimentos psicossociais", meta: 1800, realizado: 1632, unidade: "atend.", desc: "Atendimentos mensais em CAPS", trend: [1450,1520,1560,1590,1610,1625,1632], meses: 7, ultima: "03/2026" },
    ]
  },
  {
    grupo: "Gestão e Transparência",
    items: [
      { id: "GST-01", code: "GST.01", nome: "Prestação de contas no prazo", meta: 100, realizado: 100, unidade: "%", desc: "Envio pontual de documentos ao CMS", trend: [100,100,100,100,100,100,100], meses: 7, ultima: "03/2026" },
      { id: "GST-02", code: "GST.02", nome: "Execução orçamentária", meta: 95, realizado: 87.5, unidade: "%", desc: "Execução vs. repasse contratualizado", trend: [82,84,85,86,87,87.3,87.5], meses: 7, ultima: "03/2026" },
    ]
  },
];

window.ALL_INDICATORS = window.INDICATORS.flatMap(g =>
  g.items.map(it => ({ ...it, grupo: g.grupo }))
);
