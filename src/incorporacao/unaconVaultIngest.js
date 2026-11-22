const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const db = require('../models');

const MESES_MAP = {
  janeiro: '01',
  fevereiro: '02',
  marco: '03',
  março: '03',
  abril: '04',
  maio: '05',
  junho: '06',
  julho: '07',
  agosto: '08',
  setembro: '09',
  outubro: '10',
  novembro: '11',
  dezembro: '12',
  '01': '01',
  '02': '02',
  '03': '03',
  '04': '04',
  '05': '05',
  '06': '06',
  '07': '07',
  '08': '08',
  '09': '09',
  '10': '10',
  '11': '11',
  '12': '12',
};

const NUM_MESES_MAP = {
  '01': 'janeiro',
  '02': 'fevereiro',
  '03': 'marco',
  '04': 'abril',
  '05': 'maio',
  '06': 'junho',
  '07': 'julho',
  '08': 'agosto',
  '09': 'setembro',
  '10': 'outubro',
  '11': 'novembro',
  '12': 'dezembro',
};

function getVaultDir() {
  const rootDir = path.resolve(__dirname, '..', '..');
  const localVault = path.join(rootDir, 'prestacao-vault');
  if (fs.existsSync(localVault)) return localVault;
  const globalVault = 'E:\\xampp\\htdocs\\oss\\prestacao-vault';
  if (fs.existsSync(globalVault)) return globalVault;
  return localVault;
}

/**
 * Normaliza o nome do paciente removendo títulos (Dr, Dra, Sr, Sra), acentos,
 * pontuação supérflua, convertendo para minúsculas e colapsando espaços.
 */
function normalizarNome(nome) {
  if (!nome || typeof nome !== 'string') return '';
  let str = nome.replace(/\*+/g, '').trim();
  while (/^(?:dra?|sra?)\.?\s+/i.test(str)) {
    str = str.replace(/^(?:dra?|sra?)\.?\s+/i, '');
  }
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Converte data em formato brasileiro DD/MM/AAAA para formato ISO AAAA-MM-DD.
 */
function parseDataBr(str) {
  if (!str || typeof str !== 'string') return null;
  const match = str.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (!match) return null;
  const [, dia, mes, ano] = match;
  return `${ano}-${mes}-${dia}`;
}

/**
 * Extrai registros cirúrgicos de tabelas Markdown e blocos textuais.
 */
function parseTabelaCirurgias(conteudoMarkdown) {
  if (!conteudoMarkdown || typeof conteudoMarkdown !== 'string') return [];
  const resultados = [];
  const linhas = conteudoMarkdown.split(/\r?\n/);

  let inTable = false;
  let headerMap = null;

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i].trim();
    if (!linha.startsWith('|')) {
      inTable = false;
      headerMap = null;
      continue;
    }

    let rawCells = linha.split('|');
    if (rawCells.length > 0 && rawCells[0].trim() === '') rawCells.shift();
    if (rawCells.length > 0 && rawCells[rawCells.length - 1].trim() === '') rawCells.pop();
    const cells = rawCells.map((c) => c.trim());

    if (cells.every((c) => /^[-:\s]+$/.test(c))) {
      continue;
    }

    const cleanCells = cells.map((c) =>
      c
        .replace(/<[^>]+>/g, ' ')
        .replace(/\*+/g, '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .trim()
    );

    const isCirurgiaHeader =
      cleanCells.some((c) => c.includes('DATA DA CIRURGIA') || c.includes('DATA CIRURGIA')) ||
      (cleanCells.some((c) => c.includes('PACIENTE')) && cleanCells.some((c) => c.includes('PROCEDIMENTO')));

    if (isCirurgiaHeader) {
      inTable = true;
      headerMap = {};
      cleanCells.forEach((c, idx) => {
        if (c.includes('SOLICIT')) headerMap.dataSolicitacao = idx;
        else if (c.includes('CIRURGIA') && (c.includes('DATA') || cleanCells.some((x) => x.includes('CIRURGIA')))) headerMap.dataExecucao = idx;
        else if (c.includes('TEMPO') || c.includes('EXECUCAO EM DIAS') || c.includes('DIAS')) headerMap.dias = idx;
        else if (c.includes('PACIENTE')) headerMap.paciente = idx;
        else if (c.includes('COMPLEXIDADE')) headerMap.complexidade = idx;
        else if (/\bIDADE\b/.test(c)) headerMap.idade = idx;
        else if (c.includes('CODIGO')) headerMap.codigo = idx;
        else if (c.includes('PROCEDIMENTO')) headerMap.procedimento = idx;
        else if (c.includes('MEDICO') || c.includes('PROFISSIONAL')) headerMap.medico = idx;
        else if (c.includes('TIPO')) headerMap.tipo = idx;
      });
      continue;
    }

    if (inTable && headerMap && headerMap.paciente !== undefined) {
      const pacienteRaw = cells[headerMap.paciente] || '';
      const nomeLimpo = pacienteRaw.replace(/<[^>]+>/g, ' ').replace(/\*+/g, '').trim();
      if (!nomeLimpo || nomeLimpo.toUpperCase() === 'PACIENTE') continue;

      const dataSolicitacao = headerMap.dataSolicitacao !== undefined ? parseDataBr(cells[headerMap.dataSolicitacao]) : null;
      const dataExecucao = headerMap.dataExecucao !== undefined ? parseDataBr(cells[headerMap.dataExecucao]) : null;

      let diasAteInicio = null;
      if (headerMap.dias !== undefined && cells[headerMap.dias]) {
        const rawDias = cells[headerMap.dias];
        const match = rawDias.match(/(\d+)/);
        if (match) {
          let d = parseInt(match[1], 10);
          if (/mes|mês/i.test(rawDias)) d *= 30;
          diasAteInicio = d;
        }
      }

      const statusLei60Dias = diasAteInicio !== null ? (diasAteInicio <= 60 ? 'dentro_prazo' : 'fora_prazo') : 'nao_aplicavel';

      let codigoSigtap = null;
      if (headerMap.codigo !== undefined && cells[headerMap.codigo]) {
        let rawCod = cells[headerMap.codigo].replace(/<[^>]+>/g, '').replace(/\*+/g, '').replace(/[^\d]/g, '').trim();
        if (rawCod.length === 9) rawCod = `0${rawCod}`;
        codigoSigtap = rawCod || null;
      }

      let complexidade = 'nao_informada';
      if (headerMap.complexidade !== undefined && cells[headerMap.complexidade]) {
        const compRaw = cells[headerMap.complexidade].toLowerCase();
        if (compRaw.includes('alta')) complexidade = 'alta';
        else if (compRaw.includes('med') || compRaw.includes('méd')) complexidade = 'media';
        else if (compRaw.includes('baix')) complexidade = 'baixa';
      }

      let idade = null;
      if (headerMap.idade !== undefined && cells[headerMap.idade]) {
        const mIdade = cells[headerMap.idade].match(/\d+/);
        if (mIdade) idade = parseInt(mIdade[0], 10);
      }

      const descricaoProcedimento =
        headerMap.procedimento !== undefined
          ? cells[headerMap.procedimento].replace(/<br\s*\/?>/gi, ' ').replace(/\*+/g, '').replace(/\s+/g, ' ').trim()
          : null;

      const medico =
        headerMap.medico !== undefined
          ? cells[headerMap.medico].replace(/<br\s*\/?>/gi, ' ').replace(/\*+/g, '').replace(/\s+/g, ' ').trim()
          : null;

      const subtipo =
        headerMap.tipo !== undefined
          ? cells[headerMap.tipo].replace(/<br\s*\/?>/gi, ' ').replace(/\*+/g, '').replace(/\s+/g, ' ').trim()
          : null;

      resultados.push({
        tipo: 'cirurgia',
        nome: nomeLimpo,
        idade,
        dataSolicitacao,
        dataExecucao,
        diasAteInicio,
        statusLei60Dias,
        codigoSigtap,
        descricaoProcedimento,
        medico,
        subtipo,
        complexidade,
      });
    }
  }

  // Bloco de texto OCR (como em ra_unacon_janeiro_2026.md)
  const picMatches = conteudoMarkdown.matchAll(/CIRURGIAS REALIZADAS[\s\S]*?(?:<!-- End of picture text -->|#|\n\n)/gi);
  for (const pm of picMatches) {
    const items = pm[0].split(/<br\s*\/?>/i);
    for (const item of items) {
      const m = item.match(
        /^\s*(\d+)\s+(\d{2}[\/\-]\d{2}[\/\-]\d{4})\s+(\d{2}[\/\-]\d{2}[\/\-]\d{4})\s+(\d+\s*(?:dias|meses|mês)?)\s+(.*?)\s+(\d{1,3})\s+([0-9\.\-]+)\s+(.*)$/i
      );
      if (m) {
        const dataSolicitacao = parseDataBr(m[2]);
        const dataExecucao = parseDataBr(m[3]);
        const rawTempo = m[4];
        const nome = m[5].trim();
        const idade = parseInt(m[6], 10);
        let rawCodigo = m[7].replace(/[^\d]/g, '');
        if (rawCodigo.length === 9) rawCodigo = `0${rawCodigo}`;
        const codigoSigtap = rawCodigo || null;

        let diasAteInicio = null;
        const tm = rawTempo.match(/(\d+)/);
        if (tm) {
          let d = parseInt(tm[1], 10);
          if (/mes|mês/i.test(rawTempo)) d *= 30;
          diasAteInicio = d;
        }
        const statusLei60Dias = diasAteInicio !== null ? (diasAteInicio <= 60 ? 'dentro_prazo' : 'fora_prazo') : 'nao_aplicavel';

        const resto = m[8].trim();
        let complexidade = 'nao_informada';
        if (/alta/i.test(resto)) complexidade = 'alta';
        else if (/med|méd/i.test(resto)) complexidade = 'media';
        else if (/baix/i.test(resto)) complexidade = 'baixa';

        const exists = resultados.some(
          (r) => r.nome === nome && r.dataExecucao === dataExecucao && r.codigoSigtap === codigoSigtap
        );
        if (!exists) {
          resultados.push({
            tipo: 'cirurgia',
            nome,
            idade,
            dataSolicitacao,
            dataExecucao,
            diasAteInicio,
            statusLei60Dias,
            codigoSigtap,
            descricaoProcedimento: resto,
            medico: null,
            subtipo: 'ELETIVA',
            complexidade,
          });
        }
      }
    }
  }

  return resultados;
}

/**
 * Extrai consultas ambulatoriais e dados de município/agendamento de tabelas Markdown.
 */
function parseTabelaConsultas(conteudoMarkdown) {
  if (!conteudoMarkdown || typeof conteudoMarkdown !== 'string') return [];
  const resultados = [];
  const linhas = conteudoMarkdown.split(/\r?\n/);

  let inTable = false;
  let headerMap = null;

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i].trim();
    if (!linha.startsWith('|')) {
      inTable = false;
      headerMap = null;
      continue;
    }

    let rawCells = linha.split('|');
    if (rawCells.length > 0 && rawCells[0].trim() === '') rawCells.shift();
    if (rawCells.length > 0 && rawCells[rawCells.length - 1].trim() === '') rawCells.pop();
    const cells = rawCells.map((c) => c.trim());

    if (cells.every((c) => /^[-:\s]+$/.test(c))) {
      continue;
    }

    const cleanCells = cells.map((c) =>
      c
        .replace(/<[^>]+>/g, ' ')
        .replace(/\*+/g, '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .trim()
    );

    const isConsultaHeader =
      cleanCells.some((c) => c.includes('DATA AGENDA') || c.includes('DATA')) &&
      cleanCells.some((c) => c.includes('ESPECIALIDADE')) &&
      (cleanCells.some((c) => c.includes('PACIENTE')) || cleanCells.some((c) => c.includes('ATENDIDO')));

    if (isConsultaHeader) {
      inTable = true;
      headerMap = {};
      cleanCells.forEach((c, idx) => {
        if (c.includes('DATA')) headerMap.data = idx;
        else if (c.includes('ESPECIALIDADE')) headerMap.especialidade = idx;
        else if (c.includes('MEDICO') || c.includes('PROFISSIONAL')) headerMap.medico = idx;
        else if (c.includes('PACIENTE')) headerMap.paciente = idx;
        else if (c.includes('ATENDIDO')) headerMap.atendido = idx;
        else if (c.includes('AUS')) headerMap.ausente = idx;
        else if (c.includes('TIPO')) headerMap.tipoAgendamento = idx;
        else if (c.includes('MUNICIPIO')) headerMap.municipio = idx;
      });
      continue;
    }

    if (inTable && headerMap && headerMap.paciente !== undefined) {
      const pacienteRaw = cells[headerMap.paciente] || '';
      const cleanRaw = pacienteRaw.replace(/\*+/g, '').trim();
      if (!cleanRaw || cleanRaw.toUpperCase() === 'PACIENTE') continue;

      const dateInCell = cleanRaw.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{4})/);
      const dataNascimento = dateInCell ? parseDataBr(dateInCell[1]) : null;

      const nomeLimpo = cleanRaw
        .replace(/\d{2}[\/\-]\d{2}[\/\-]\d{4}/g, '')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!nomeLimpo) continue;

      const dataExecucao = headerMap.data !== undefined ? parseDataBr(cells[headerMap.data]) : null;

      const especialidade =
        headerMap.especialidade !== undefined
          ? cells[headerMap.especialidade].replace(/<br\s*\/?>/gi, ' ').replace(/\*+/g, '').replace(/\s+/g, ' ').trim()
          : null;

      const medico =
        headerMap.medico !== undefined
          ? cells[headerMap.medico].replace(/<br\s*\/?>/gi, ' ').replace(/\*+/g, '').replace(/\s+/g, ' ').trim()
          : null;

      const atendidoCell = headerMap.atendido !== undefined ? cells[headerMap.atendido] : '';
      const ausenteCell = headerMap.ausente !== undefined ? cells[headerMap.ausente] : '';

      let comparecimento = 'atendido';
      if (/x/i.test(ausenteCell)) {
        comparecimento = 'ausente';
      } else if (/x/i.test(atendidoCell)) {
        comparecimento = 'atendido';
      }

      const tipoAgendamento =
        headerMap.tipoAgendamento !== undefined
          ? cells[headerMap.tipoAgendamento].replace(/<br\s*\/?>/gi, ' ').replace(/\*+/g, '').replace(/\s+/g, ' ').trim()
          : null;

      const municipio =
        headerMap.municipio !== undefined
          ? cells[headerMap.municipio].replace(/<br\s*\/?>/gi, ' ').replace(/\*+/g, '').replace(/\s+/g, ' ').trim()
          : null;

      resultados.push({
        tipo: 'consulta',
        nome: nomeLimpo,
        dataNascimento,
        dataExecucao,
        especialidade,
        medico,
        comparecimento,
        tipoAgendamento,
        municipio,
      });
    }
  }

  // Bloco de texto OCR (como em ra_unacon_janeiro_2026.md)
  const picMatches = conteudoMarkdown.matchAll(/CONSULTAS REALIZADAS[\s\S]*?(?:<!-- End of picture text -->|#|\n\n)/gi);
  for (const pm of picMatches) {
    const items = pm[0].split(/<br\s*\/?>/i);
    for (const item of items) {
      const m = item.match(
        /^\s*(\d+)\s+(\d{2}[\/\-]\d{2}[\/\-]\d{4})\s+(ONCOLOGIA[A-Z\s\-]+?)\s{2,}([A-Z\s]+?)\s{2,}([A-Z\s]+?)\s+(\d{2}[\/\-]\d{2}[\/\-]\d{4})\s+(?:(X|x)\s+)?(?:(X|x)\s+)?(CROSS|RETORNO|INTERCONSULTA)\s+(.*)$/i
      );
      if (m) {
        const dataExecucao = parseDataBr(m[2]);
        const especialidade = m[3].trim();
        const medico = m[4].trim();
        const nomeLimpo = m[5].trim();
        const dataNascimento = parseDataBr(m[6]);
        const ausente = m[8];
        let comparecimento = 'atendido';
        if (/x/i.test(ausente)) comparecimento = 'ausente';
        const tipoAgendamento = m[9].trim();
        const municipio = m[10].trim();

        const exists = resultados.some(
          (r) => r.nome === nomeLimpo && r.dataExecucao === dataExecucao && r.especialidade === especialidade
        );
        if (!exists) {
          resultados.push({
            tipo: 'consulta',
            nome: nomeLimpo,
            dataNascimento,
            dataExecucao,
            especialidade,
            medico,
            comparecimento,
            tipoAgendamento,
            municipio,
          });
        }
      }
    }
  }

  return resultados;
}

/**
 * Ingestão de dados do Vault para um mês específico da UNACON.
 */
async function ingerirMesUnacon(ano, mes) {
  const mesStr = String(mes).toLowerCase().trim();
  const mesNum = MESES_MAP[mesStr];
  if (!mesNum) {
    throw new Error(`Mês inválido informado para ingestão: ${mes}`);
  }

  const mesDir = NUM_MESES_MAP[mesNum] || mesStr;
  const competencia = `${ano}-${mesNum}`;
  const vaultRoot = getVaultDir();
  const raDir = path.join(vaultRoot, 'vault', String(ano), 'unacon', mesDir, 'relatorio_assistencial');

  if (!fs.existsSync(raDir)) {
    console.warn(`[Vault Ingest] Diretório não encontrado: ${raDir}`);
    return {
      competencia,
      totalPacientesCriados: 0,
      totalCirurgias: 0,
      totalConsultas: 0,
      aviso: 'Diretório não encontrado',
    };
  }

  const arquivos = fs
    .readdirSync(raDir)
    .filter((f) => f.endsWith('.md'))
    .sort();

  if (arquivos.length === 0) {
    return {
      competencia,
      totalPacientesCriados: 0,
      totalCirurgias: 0,
      totalConsultas: 0,
      aviso: 'Nenhum arquivo markdown encontrado',
    };
  }

  const cirurgiasTotal = [];
  const consultasTotal = [];

  for (const arq of arquivos) {
    const caminhoCompleto = path.join(raDir, arq);
    const conteudo = fs.readFileSync(caminhoCompleto, 'utf8');
    const arqRelativo = path.join('vault', String(ano), 'unacon', mesDir, 'relatorio_assistencial', arq);

    const cirs = parseTabelaCirurgias(conteudo);
    for (const c of cirs) {
      c.arquivoOrigem = arqRelativo;
      cirurgiasTotal.push(c);
    }

    const cons = parseTabelaConsultas(conteudo);
    for (const co of cons) {
      co.arquivoOrigem = arqRelativo;
      consultasTotal.push(co);
    }
  }

  const todosRegistros = [...cirurgiasTotal, ...consultasTotal];

  const Paciente = db.unacon_paciente || db.UnaconPaciente;
  const Procedimento = db.unacon_procedimento || db.UnaconProcedimento;

  let totalPacientesCriados = 0;
  let totalCirurgias = 0;
  let totalConsultas = 0;

  const t = await db.sequelize.transaction();
  try {
    const cachePacientes = new Map();

    for (const reg of todosRegistros) {
      const nomeNorm = normalizarNome(reg.nome);
      if (!nomeNorm) continue;

      const cacheKey = `${nomeNorm}|${reg.dataNascimento || ''}`;
      let paciente = cachePacientes.get(cacheKey);

      if (!paciente) {
        if (reg.dataNascimento) {
          paciente = await Paciente.findOne({
            where: { nome_normalizado: nomeNorm, data_nascimento: reg.dataNascimento },
            transaction: t,
          });
        } else {
          paciente = await Paciente.findOne({
            where: { nome_normalizado: nomeNorm },
            transaction: t,
          });
        }

        if (!paciente) {
          paciente = await Paciente.create(
            {
              paciente_id: randomUUID(),
              nome: reg.nome,
              nome_normalizado: nomeNorm,
              data_nascimento: reg.dataNascimento || null,
              idade: reg.idade || null,
              municipio_origem: reg.municipio || null,
            },
            { transaction: t }
          );
          totalPacientesCriados++;
        }
        cachePacientes.set(cacheKey, paciente);
      }

      // Atualiza dados faltantes se disponíveis
      const updates = {};
      if (reg.municipio && !paciente.municipio_origem) {
        updates.municipio_origem = reg.municipio;
        paciente.municipio_origem = reg.municipio;
      }
      if (reg.idade && !paciente.idade) {
        updates.idade = reg.idade;
        paciente.idade = reg.idade;
      }
      if (reg.dataNascimento && !paciente.data_nascimento) {
        updates.data_nascimento = reg.dataNascimento;
        paciente.data_nascimento = reg.dataNascimento;
      }
      if (Object.keys(updates).length > 0) {
        await paciente.update(updates, { transaction: t });
      }

      // Previne duplicatas de procedimento
      const whereProc = {
        paciente_id: paciente.paciente_id,
        data_execucao: reg.dataExecucao || null,
        tipo: reg.tipo,
      };
      if (reg.tipo === 'cirurgia') {
        whereProc.codigo_sigtap = reg.codigoSigtap || null;
      } else if (reg.tipo === 'consulta') {
        whereProc.especialidade = reg.especialidade || null;
      }

      const existingProc = await Procedimento.findOne({
        where: whereProc,
        transaction: t,
      });

      if (!existingProc) {
        await Procedimento.create(
          {
            procedimento_id: randomUUID(),
            paciente_id: paciente.paciente_id,
            competencia,
            tipo: reg.tipo,
            subtipo: reg.subtipo || null,
            codigo_sigtap: reg.codigoSigtap || null,
            descricao_procedimento: reg.descricaoProcedimento || null,
            data_solicitacao: reg.dataSolicitacao || null,
            data_execucao: reg.dataExecucao || null,
            dias_ate_inicio: reg.diasAteInicio !== undefined ? reg.diasAteInicio : null,
            status_lei_60_dias: reg.statusLei60Dias || 'nao_aplicavel',
            profissional_nome: reg.medico || null,
            especialidade: reg.especialidade || null,
            comparecimento: reg.comparecimento || 'atendido',
            tipo_agendamento: reg.tipoAgendamento || null,
            complexidade: reg.complexidade || 'nao_informada',
            fonte_origem: 'vault_ra',
            arquivo_origem: reg.arquivoOrigem || null,
          },
          { transaction: t }
        );

        if (reg.tipo === 'cirurgia') totalCirurgias++;
        if (reg.tipo === 'consulta') totalConsultas++;
      }
    }

    await t.commit();
  } catch (error) {
    await t.rollback();
    throw error;
  }

  return {
    competencia,
    totalPacientesCriados,
    totalCirurgias,
    totalConsultas,
  };
}

/**
 * Ingestão de dados de todos os meses de um ano.
 */
async function ingerirAnoUnacon(ano) {
  const meses = [
    'janeiro',
    'fevereiro',
    'marco',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ];
  const resultados = {};
  for (const m of meses) {
    resultados[m] = await ingerirMesUnacon(ano, m);
  }
  return resultados;
}

if (require.main === module) {
  (async () => {
    try {
      const args = process.argv.slice(2);
      let ano = 2026;
      let mes = null;

      for (const arg of args) {
        if (arg.startsWith('--ano=')) {
          ano = parseInt(arg.split('=')[1], 10);
        } else if (arg.startsWith('--mes=')) {
          mes = arg.split('=')[1].trim().toLowerCase();
        }
      }

      console.log(`[Vault Ingest] Iniciando ingestão UNACON: ano=${ano}, mes=${mes || 'todos'}`);
      if (mes) {
        const res = await ingerirMesUnacon(ano, mes);
        console.log(`[Vault Ingest] Mês ${mes} concluído:`, res);
      } else {
        const res = await ingerirAnoUnacon(ano);
        console.log(`[Vault Ingest] Ano ${ano} concluído:`, res);
      }
      process.exit(0);
    } catch (err) {
      console.error('[Vault Ingest] Erro na ingestão:', err);
      process.exit(1);
    }
  })();
}

module.exports = {
  normalizarNome,
  parseDataBr,
  parseTabelaCirurgias,
  parseTabelaConsultas,
  ingerirMesUnacon,
  ingerirAnoUnacon,
};
