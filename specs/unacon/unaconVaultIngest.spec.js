/* eslint-env mocha */
/* eslint-disable no-unused-expressions */
const { expect } = require('chai');
const {
  parseTabelaCirurgias,
  parseTabelaConsultas,
  normalizarNome,
  parseDataBr,
  ingerirVaultUnacon,
  VAULT_BASE_DIR,
} = require('../../src/incorporacao/unaconVaultIngest');

describe('Parser de Tabelas Nominais do Vault UNACON', () => {
  it('deve normalizar nomes corretamente', () => {
    expect(normalizarNome('  Dra. Maria  de Fátima  ')).to.equal('maria de fatima');
    expect(normalizarNome('DR. JOÃO PAULO DA SILVA')).to.equal('joao paulo da silva');
    expect(normalizarNome('Dr José Carlos ')).to.equal('jose carlos');
    expect(normalizarNome(null)).to.equal('');
  });

  it('deve converter datas brasileiras para ISO', () => {
    expect(parseDataBr('22/01/2026')).to.equal('2026-01-22');
    expect(parseDataBr('01/02/2026<br>')).to.equal('2026-02-01');
    expect(parseDataBr('')).to.be.null;
    expect(parseDataBr(null)).to.be.null;
  });

  it('deve extrair campos de cirurgia de tabela Markdown', () => {
    const rawMarkdown = `
|QUANT|DATA DA SOLICITAÇÃO|DATA DA CIRURGIA|TEMPO DE EXECUÇAO EM DIAS|PACIENTE|IDADE|CODIGO DO PROCEDIMENTO|PROCEDIMENTO|MÉDICO|TIPO|COMPLEXIDADE|
|1|22/01/2026|01/02/2026|10 DIAS|MARIA DA SILVA|65|0416120059|SEGMENTECTOMIA DE MAMA|DR SILVA|ELETIVA|ALTA|
|2|01/10/2025|01/02/2026|70 DIAS|ANTONIO SOUZA|70|0416120059|SEGMENTECTOMIA DE MAMA|DR SILVA|ELETIVA|MEDIA|
    `;
    const cirurgias = parseTabelaCirurgias(rawMarkdown);
    expect(cirurgias).to.have.lengthOf(2);

    expect(cirurgias[0].nome).to.equal('MARIA DA SILVA');
    expect(cirurgias[0].diasAteInicio).to.equal(10);
    expect(cirurgias[0].statusLei60Dias).to.equal('dentro_prazo');
    expect(cirurgias[0].codigoSigtap).to.equal('0416120059');
    expect(cirurgias[0].complexidade).to.equal('alta');
    expect(cirurgias[0].dataSolicitacao).to.equal('2026-01-22');
    expect(cirurgias[0].dataExecucao).to.equal('2026-02-01');

    expect(cirurgias[1].nome).to.equal('ANTONIO SOUZA');
    expect(cirurgias[1].diasAteInicio).to.equal(70);
    expect(cirurgias[1].statusLei60Dias).to.equal('fora_prazo');
    expect(cirurgias[1].complexidade).to.equal('media');
  });

  it('deve extrair campos de consultas e município de tabela Markdown', () => {
    const rawMarkdown = `
|QUANT|Data Agenda|Especialidade|Médico|Paciente|Atendido|Aus|Tipo Agendamento|Município|
|1|02/01/2026|ONCOLOGIA CLINICA|DR ADOLFO|JOAO PEREIRA|X||RETORNO|AMERICANA|
|2|02/01/2026|ONCOLOGIA CLINICA|ADOLFO SCHERR|JULIANA ALVES DE LIMA<br>07/06/1973||X|CROSS|SANTA BÁRBARA D'OESTE|
    `;
    const consultas = parseTabelaConsultas(rawMarkdown);
    expect(consultas).to.have.lengthOf(2);

    expect(consultas[0].nome).to.equal('JOAO PEREIRA');
    expect(consultas[0].municipio).to.equal('AMERICANA');
    expect(consultas[0].comparecimento).to.equal('atendido');
    expect(consultas[0].tipoAgendamento).to.equal('RETORNO');
    expect(consultas[0].especialidade).to.equal('ONCOLOGIA CLINICA');
    expect(consultas[0].dataNascimento).to.be.null;

    expect(consultas[1].nome).to.equal('JULIANA ALVES DE LIMA');
    expect(consultas[1].dataNascimento).to.equal('1973-06-07');
    expect(consultas[1].comparecimento).to.equal('ausente');
    expect(consultas[1].municipio).to.equal("SANTA BÁRBARA D'OESTE");
    expect(consultas[1].tipoAgendamento).to.equal('CROSS');
  });

  it('deve extrair cirurgias de bloco OCR de texto com delimitadores <br>', () => {
    const rawMarkdown = `
<!-- Start of picture text -->
CIRURGIAS REALIZADAS - JANEIRO 2026<br>QUANT SOLICITAÇÃODATA DA  DATA DA CIRURGIA EXECUÇAO EM DIASTEMPO DE  PACIENTE  IDADE PROCEDIMENTOCODIGO DO  PROCEDIMENTO MÉDICO TIPO COMPLEXIDADE (SIGTAP)<br>1 17/11/2025 05/01/2026 35 DIAS SOLIMARA MARIA GOMES CARMELOSSI 57 416120059 SEGMENTECTOMIA/QUADRANTECTOMIA/SETORECT PAULO SERGIO JUNIOR  ELETIVA  ALTA<br><!-- End of picture text -->
    `;
    const cirurgias = parseTabelaCirurgias(rawMarkdown);
    expect(cirurgias).to.have.lengthOf(1);
    expect(cirurgias[0].nome).to.equal('SOLIMARA MARIA GOMES CARMELOSSI');
    expect(cirurgias[0].idade).to.equal(57);
    expect(cirurgias[0].diasAteInicio).to.equal(35);
    expect(cirurgias[0].statusLei60Dias).to.equal('dentro_prazo');
    expect(cirurgias[0].codigoSigtap).to.equal('0416120059');
    expect(cirurgias[0].complexidade).to.equal('alta');
    expect(cirurgias[0].dataSolicitacao).to.equal('2025-11-17');
    expect(cirurgias[0].dataExecucao).to.equal('2026-01-05');
  });

  it('deve extrair consultas de bloco OCR de texto identificando status atendido e ausente', () => {
    const rawMarkdown = `
<!-- Start of picture text -->
CONSULTAS REALIZADAS - JANEIRO  2026<br>QUANT Data Agenda Especialidade Médico Paciente Nasc. Atendido Aus Tipo Agendamento Município<br>46 06/01/2026 ONCOLOGIA CIRURGICA - MASTOLOGIA  PAULO SERGIO REIS  FABIANA DE OLIVEIRA SOUZA 18/06/1984 X CROSS PEDREIRA<br>47 06/01/2026 ONCOLOGIA CIRURGICA - MASTOLOGIA  PAULO SERGIO REIS  MARCOS SILVA PEREIRA 12/03/1975   X CROSS AMERICANA<br><!-- End of picture text -->
    `;
    const consultas = parseTabelaConsultas(rawMarkdown);
    expect(consultas).to.have.lengthOf(2);

    expect(consultas[0].nome).to.equal('FABIANA DE OLIVEIRA SOUZA');
    expect(consultas[0].comparecimento).to.equal('atendido');
    expect(consultas[0].dataExecucao).to.equal('2026-01-06');
    expect(consultas[0].dataNascimento).to.equal('1984-06-18');
    expect(consultas[0].municipio).to.equal('PEDREIRA');

    expect(consultas[1].nome).to.equal('MARCOS SILVA PEREIRA');
    expect(consultas[1].comparecimento).to.equal('ausente');
    expect(consultas[1].dataExecucao).to.equal('2026-01-06');
    expect(consultas[1].dataNascimento).to.equal('1975-03-12');
    expect(consultas[1].municipio).to.equal('AMERICANA');
  });

  it('deve exportar ingerirVaultUnacon e VAULT_BASE_DIR', () => {
    expect(ingerirVaultUnacon).to.be.a('function');
    expect(VAULT_BASE_DIR).to.be.a('string');
  });

  it('deve retornar array vazio para markdown invalido ou vazio', () => {
    expect(parseTabelaCirurgias(null)).to.deep.equal([]);
    expect(parseTabelaCirurgias('')).to.deep.equal([]);
    expect(parseTabelaConsultas(null)).to.deep.equal([]);
    expect(parseTabelaConsultas('')).to.deep.equal([]);
  });
});

