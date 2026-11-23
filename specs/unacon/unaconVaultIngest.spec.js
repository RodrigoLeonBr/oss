/* eslint-env mocha */
/* eslint-disable no-unused-expressions */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { expect } = require('chai');
const db = require('../../src/models');
const {
  parseTabelaCirurgias,
  parseTabelaConsultas,
  normalizarNome,
  parseDataBr,
  ingerirMesUnacon,
  ingerirVaultUnacon,
  VAULT_BASE_DIR,
} = require('../../src/incorporacao/unaconVaultIngest');

describe('Parser de Tabelas Nominais do Vault UNACON', () => {
  it('deve normalizar nomes corretamente', () => {
    expect(normalizarNome('  Dra. Fulana  de Fátima  ')).to.equal('fulana de fatima');
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

  it('deve extrair campos de cirurgia de tabela Markdown com nomes ficticios', () => {
    const rawMarkdown = `
|QUANT|DATA DA SOLICITAÇÃO|DATA DA CIRURGIA|TEMPO DE EXECUÇAO EM DIAS|PACIENTE|IDADE|CODIGO DO PROCEDIMENTO|PROCEDIMENTO|MÉDICO|TIPO|COMPLEXIDADE|
|1|22/01/2026|01/02/2026|10 DIAS|PACIENTE FICTICIO ALFA|65|0416120059|SEGMENTECTOMIA DE MAMA|DR MEDICO FICTICIO|ELETIVA|ALTA|
|2|01/10/2025|01/02/2026|70 DIAS|PACIENTE FICTICIO BETA|70|0416120059|SEGMENTECTOMIA DE MAMA|DR MEDICO FICTICIO|ELETIVA|MEDIA|
    `;
    const cirurgias = parseTabelaCirurgias(rawMarkdown);
    expect(cirurgias).to.have.lengthOf(2);

    expect(cirurgias[0].nome).to.equal('PACIENTE FICTICIO ALFA');
    expect(cirurgias[0].diasAteInicio).to.equal(10);
    expect(cirurgias[0].statusLei60Dias).to.equal('dentro_prazo');
    expect(cirurgias[0].codigoSigtap).to.equal('0416120059');
    expect(cirurgias[0].complexidade).to.equal('alta');
    expect(cirurgias[0].dataSolicitacao).to.equal('2026-01-22');
    expect(cirurgias[0].dataExecucao).to.equal('2026-02-01');

    expect(cirurgias[1].nome).to.equal('PACIENTE FICTICIO BETA');
    expect(cirurgias[1].diasAteInicio).to.equal(70);
    expect(cirurgias[1].statusLei60Dias).to.equal('fora_prazo');
    expect(cirurgias[1].complexidade).to.equal('media');
  });

  it('deve extrair campos de consultas e município de tabela Markdown com nomes ficticios', () => {
    const rawMarkdown = `
|QUANT|Data Agenda|Especialidade|Médico|Paciente|Atendido|Aus|Tipo Agendamento|Município|
|1|02/01/2026|ONCOLOGIA CLINICA|DR MEDICO TESTE|PACIENTE FICTICIO GAMA|X||RETORNO|AMERICANA|
|2|02/01/2026|ONCOLOGIA CLINICA|DR MEDICO TESTE|PACIENTE FICTICIO DELTA<br>01/01/1980||X|CROSS|SANTA BÁRBARA D'OESTE|
    `;
    const consultas = parseTabelaConsultas(rawMarkdown);
    expect(consultas).to.have.lengthOf(2);

    expect(consultas[0].nome).to.equal('PACIENTE FICTICIO GAMA');
    expect(consultas[0].municipio).to.equal('AMERICANA');
    expect(consultas[0].comparecimento).to.equal('atendido');
    expect(consultas[0].tipoAgendamento).to.equal('RETORNO');
    expect(consultas[0].especialidade).to.equal('ONCOLOGIA CLINICA');
    expect(consultas[0].dataNascimento).to.be.null;

    expect(consultas[1].nome).to.equal('PACIENTE FICTICIO DELTA');
    expect(consultas[1].dataNascimento).to.equal('1980-01-01');
    expect(consultas[1].comparecimento).to.equal('ausente');
    expect(consultas[1].municipio).to.equal("SANTA BÁRBARA D'OESTE");
    expect(consultas[1].tipoAgendamento).to.equal('CROSS');
  });

  it('deve extrair cirurgias de bloco OCR de texto com delimitadores <br>', () => {
    const rawMarkdown = `
<!-- Start of picture text -->
CIRURGIAS REALIZADAS - JANEIRO 2026<br>QUANT SOLICITAÇÃODATA DA  DATA DA CIRURGIA EXECUÇAO EM DIASTEMPO DE  PACIENTE  IDADE PROCEDIMENTOCODIGO DO  PROCEDIMENTO MÉDICO TIPO COMPLEXIDADE (SIGTAP)<br>1 17/11/2025 05/01/2026 35 DIAS PACIENTE FICTICIO EPSILON 57 416120059 SEGMENTECTOMIA/QUADRANTECTOMIA/SETORECT DR CIRURGIAO TESTE  ELETIVA  ALTA<br><!-- End of picture text -->
    `;
    const cirurgias = parseTabelaCirurgias(rawMarkdown);
    expect(cirurgias).to.have.lengthOf(1);
    expect(cirurgias[0].nome).to.equal('PACIENTE FICTICIO EPSILON');
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
CONSULTAS REALIZADAS - JANEIRO  2026<br>QUANT Data Agenda Especialidade Médico Paciente Nasc. Atendido Aus Tipo Agendamento Município<br>46 06/01/2026 ONCOLOGIA CIRURGICA - MASTOLOGIA  DR ONCOLOGISTA TESTE  PACIENTE FICTICIO ZETA 15/05/1985 X CROSS PEDREIRA<br>47 06/01/2026 ONCOLOGIA CIRURGICA - MASTOLOGIA  DR ONCOLOGISTA TESTE  PACIENTE FICTICIO ETA 20/10/1970   X CROSS AMERICANA<br><!-- End of picture text -->
    `;
    const consultas = parseTabelaConsultas(rawMarkdown);
    expect(consultas).to.have.lengthOf(2);

    expect(consultas[0].nome).to.equal('PACIENTE FICTICIO ZETA');
    expect(consultas[0].comparecimento).to.equal('atendido');
    expect(consultas[0].dataExecucao).to.equal('2026-01-06');
    expect(consultas[0].dataNascimento).to.equal('1985-05-15');
    expect(consultas[0].municipio).to.equal('PEDREIRA');

    expect(consultas[1].nome).to.equal('PACIENTE FICTICIO ETA');
    expect(consultas[1].comparecimento).to.equal('ausente');
    expect(consultas[1].dataExecucao).to.equal('2026-01-06');
    expect(consultas[1].dataNascimento).to.equal('1970-10-20');
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

  it('deve enriquecer e deduplicar paciente quando data_nascimento for inicialmente nula', async () => {
    const Paciente = db.unacon_paciente || db.UnaconPaciente;
    const Procedimento = db.unacon_procedimento || db.UnaconProcedimento;
    const nomeFicticio = 'PACIENTE FICTICIO DEDUP TESTE';
    const nomeNorm = normalizarNome(nomeFicticio);

    // Limpa dados prévios se houver
    const pacienteAnterior = await Paciente.findOne({ where: { nome_normalizado: nomeNorm } });
    if (pacienteAnterior) {
      await Procedimento.destroy({ where: { paciente_id: pacienteAnterior.paciente_id } });
      await Paciente.destroy({ where: { paciente_id: pacienteAnterior.paciente_id } });
    }

    // Cria diretório temporário para simular estrutura do Vault
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-dedup-test-'));
    const mesDir = path.join(tempDir, 'vault', '2026', 'unacon', 'janeiro', 'relatorio_assistencial');
    fs.mkdirSync(mesDir, { recursive: true });

    // Cria arquivo markdown onde cirurgia vem primeiro (sem data de nascimento) e consulta vem depois (com data de nascimento)
    const conteudoMd = [
      '|QUANT|DATA DA SOLICITAÇÃO|DATA DA CIRURGIA|TEMPO DE EXECUÇAO EM DIAS|PACIENTE|IDADE|CODIGO DO PROCEDIMENTO|PROCEDIMENTO|MÉDICO|TIPO|COMPLEXIDADE|',
      `|1|22/01/2026|01/02/2026|10 DIAS|${nomeFicticio}|55|0416120059|SEGMENTECTOMIA|DR TESTE|ELETIVA|ALTA|`,
      '',
      '|QUANT|Data Agenda|Especialidade|Médico|Paciente|Atendido|Aus|Tipo Agendamento|Município|',
      `|1|02/01/2026|ONCOLOGIA CLINICA|DR TESTE|${nomeFicticio}<br>15/04/1971|X||RETORNO|AMERICANA|`,
    ].join('\n');

    fs.writeFileSync(path.join(mesDir, 'ra_unacon_janeiro_2026.md'), conteudoMd, 'utf8');

    const oldVaultPath = process.env.VAULT_PATH;
    process.env.VAULT_PATH = tempDir;

    try {
      const resultado = await ingerirMesUnacon(2026, 'janeiro');

      // Verifica que apenas 1 paciente foi criado para os 2 procedimentos
      expect(resultado.totalPacientesCriados).to.equal(1);
      expect(resultado.totalCirurgias).to.equal(1);
      expect(resultado.totalConsultas).to.equal(1);

      const pacientesNoBanco = await Paciente.findAll({ where: { nome_normalizado: nomeNorm } });
      expect(pacientesNoBanco).to.have.lengthOf(1);

      // O paciente deve ter sido enriquecido com a data de nascimento da consulta
      const pacienteEnriquecido = pacientesNoBanco[0];
      expect(pacienteEnriquecido.data_nascimento).to.equal('1971-04-15');
      expect(pacienteEnriquecido.municipio_origem).to.equal('AMERICANA');

      // Ambos os procedimentos devem estar associados ao mesmo paciente
      const procs = await Procedimento.findAll({ where: { paciente_id: pacienteEnriquecido.paciente_id } });
      expect(procs).to.have.lengthOf(2);
    } finally {
      if (oldVaultPath) {
        process.env.VAULT_PATH = oldVaultPath;
      } else {
        delete process.env.VAULT_PATH;
      }
      fs.rmSync(tempDir, { recursive: true, force: true });
      const pFinal = await Paciente.findOne({ where: { nome_normalizado: nomeNorm } });
      if (pFinal) {
        await Procedimento.destroy({ where: { paciente_id: pFinal.paciente_id } });
        await Paciente.destroy({ where: { paciente_id: pFinal.paciente_id } });
      }
    }
  });

  it('não deve fundir pacientes homônimos que possuem datas de nascimento distintas', async () => {
    const Paciente = db.unacon_paciente || db.UnaconPaciente;
    const Procedimento = db.unacon_procedimento || db.UnaconProcedimento;
    const nomeHomonimo = 'PACIENTE FICTICIO HOMONIMO';
    const nomeNorm = normalizarNome(nomeHomonimo);

    const anteriores = await Paciente.findAll({ where: { nome_normalizado: nomeNorm } });
    for (const p of anteriores) {
      await Procedimento.destroy({ where: { paciente_id: p.paciente_id } });
      await Paciente.destroy({ where: { paciente_id: p.paciente_id } });
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-homonimo-test-'));
    const mesDir = path.join(tempDir, 'vault', '2026', 'unacon', 'janeiro', 'relatorio_assistencial');
    fs.mkdirSync(mesDir, { recursive: true });

    const conteudoMd = [
      '|QUANT|Data Agenda|Especialidade|Médico|Paciente|Atendido|Aus|Tipo Agendamento|Município|',
      `|1|02/01/2026|ONCOLOGIA CLINICA|DR TESTE|${nomeHomonimo}<br>10/01/1960|X||RETORNO|AMERICANA|`,
      `|2|05/01/2026|ONCOLOGIA CLINICA|DR TESTE|${nomeHomonimo}<br>25/12/1985|X||RETORNO|SUMARÉ|`,
    ].join('\n');

    fs.writeFileSync(path.join(mesDir, 'ra_unacon_janeiro_2026.md'), conteudoMd, 'utf8');

    const oldVaultPath = process.env.VAULT_PATH;
    process.env.VAULT_PATH = tempDir;

    try {
      const resultado = await ingerirMesUnacon(2026, 'janeiro');

      expect(resultado.totalPacientesCriados).to.equal(2);
      expect(resultado.totalConsultas).to.equal(2);

      const pacientesNoBanco = await Paciente.findAll({
        where: { nome_normalizado: nomeNorm },
        order: [['data_nascimento', 'ASC']],
      });
      expect(pacientesNoBanco).to.have.lengthOf(2);
      expect(pacientesNoBanco[0].data_nascimento).to.equal('1960-01-10');
      expect(pacientesNoBanco[1].data_nascimento).to.equal('1985-12-25');
      expect(pacientesNoBanco[0].paciente_id).to.not.equal(pacientesNoBanco[1].paciente_id);
    } finally {
      if (oldVaultPath) {
        process.env.VAULT_PATH = oldVaultPath;
      } else {
        delete process.env.VAULT_PATH;
      }
      fs.rmSync(tempDir, { recursive: true, force: true });
      const pFinal = await Paciente.findAll({ where: { nome_normalizado: nomeNorm } });
      for (const p of pFinal) {
        await Procedimento.destroy({ where: { paciente_id: p.paciente_id } });
        await Paciente.destroy({ where: { paciente_id: p.paciente_id } });
      }
    }
  });
});
