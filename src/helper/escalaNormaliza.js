// Normalização de profissionais das escalas (identidade = conselho + registro + UF).
// Self-check: node src/helper/escalaNormaliza.js

const CATEGORIA_POR_CONSELHO = {
  CRM: 'medico',
  CRO: 'dentista',
  COREN: 'enfermagem',
  CRTR: 'tecnico_radiologia',
  CRF: 'farmaceutico',
  CRESS: 'assistente_social',
  CREFITO: 'fisioterapeuta',
  CRN: 'nutricionista',
  CRP: 'psicologo',
};

const normalizaNome = (s) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase()
  .replace(/[^A-Z\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

// "MARIA DA SILVA" -> "Maria da Silva"
const titulo = (s) => s.toLowerCase().replace(/(^|\s)(\S)/g, (m, sp, c) => sp + c.toUpperCase())
  .replace(/\s(Da|De|Do|Das|Dos|E)(?=\s)/g, (m) => m.toLowerCase());

/**
 * Escolhe o nome canônico entre as grafias vistas: mais palavras por extenso, depois mais frequente.
 * @param {Map<string, number>} variantes nome -> ocorrências
 */
function nomeCanonico(variantes) {
  const extenso = (n) => n.split(/\s+/).filter((t) => t.length > 2 && !t.endsWith('.')).length;
  const acentos = (n) => (n.normalize('NFD').match(/[̀-ͯ]/g) || []).length;
  const [melhor] = [...variantes.entries()]
    .sort((a, b) => extenso(b[0]) - extenso(a[0]) || acentos(b[0]) - acentos(a[0]) || b[1] - a[1]);
  const nome = melhor[0].trim();
  // tudo maiúsculo ou maiúscula no meio da palavra (PDF: "AntôNio") -> título
  return nome === nome.toUpperCase() || /\p{Ll}\p{Lu}/u.test(nome) ? titulo(nome) : nome;
}

/**
 * Assinatura tolerante a abreviação: primeiro nome | iniciais do meio | último nome, sem partículas.
 * "Jose H. Inamonico" e "JOSE HUGO INAMONICO" -> "JOSE|H|INAMONICO".
 */
function assinaturaNome(nome) {
  const t = normalizaNome(nome).split(' ').filter((p) => p && !['DA', 'DE', 'DO', 'DAS', 'DOS', 'E'].includes(p));
  if (t.length < 2) return null;
  return `${t[0]}|${t.slice(1, -1).map((p) => p[0]).join('')}|${t[t.length - 1]}`;
}

function distancia(a, b) {
  let ant = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    for (let j = 1; j <= b.length; j += 1) {
      cur[j] = Math.min(ant[j] + 1, cur[j - 1] + 1, ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    ant = cur;
  }
  return ant[b.length];
}

/**
 * Grafia diferente da mesma pessoa: mesmo primeiro nome e (até 2 letras de diferença, ou todas as palavras
 * do nome curto presentes no longo). "Maria Elena Cardoso Halin" ~ "Maria Elena Cardozo de Halim".
 */
function nomeParecido(a, b) {
  const tok = (n) => normalizaNome(n).split(' ').filter((p) => p && !['DA', 'DE', 'DO', 'DAS', 'DOS', 'E'].includes(p));
  const [x, y] = [tok(a), tok(b)];
  if (!x.length || !y.length || x[0] !== y[0]) return false;
  if (distancia(x.join(' '), y.join(' ')) <= 2) return true;
  const [curto, longo] = x.length <= y.length ? [x, y] : [y, x];
  // ponytail: contido exige >= 2 palavras; "Isabela" sozinha casaria com qualquer Isabela
  return curto.length >= 2 && curto.every((p) => longo.some((q) => q === p || distancia(p, q) <= 1));
}

/** Chave única do profissional; sem registro, o nome normalizado faz o papel do número. */
function chaveProfissional({ nome, conselho, registro, uf }) {
  const num = String(registro || '').replace(/\D/g, '');
  if (conselho && num) {
    return { conselho, registro_numero: num, registro_uf: conselho === 'MATRICULA' ? '' : (uf || 'SP').toUpperCase() };
  }
  return { conselho: 'SEM_REGISTRO', registro_numero: normalizaNome(nome).slice(0, 120), registro_uf: '' };
}

// Mesmo tipo de escala com nome de arquivo diferente entre meses ("técnicos de enfermagem", "raio-x", ...)
function familiaAssunto(assunto) {
  const n = normalizaNome(assunto || '');
  if (n.includes('RECEPC')) return 'RECEPCAO';
  if (n.includes('TECNIC') && n.includes('ENFERM')) return 'TECNICO DE ENFERMAGEM';
  if (n.includes('RADIOLOG') || n.includes('RAIO')) return 'RADIOLOGIA';
  if (n.includes('LIMPEZA')) return 'APOIO';
  return n.replace(/S$/, '');
}

// Ciclo repetido em PDFs de meses seguintes: vale a versão do mês mais recente (decisão do usuário 2026-11-20).
// Recebe [{ arquivo_id, unidade_id, assunto, competencia, periodo_inicio, periodo_fim }] e devolve, para cada arquivo
// mais antigo, o intervalo coberto por um mais novo da mesma família: [{ arquivo_id, novo_id, inicio, fim }].
function sobreposicoes(arquivos) {
  const out = [];
  arquivos.forEach((velho) => arquivos.forEach((novo) => {
    if (novo.unidade_id !== velho.unidade_id || novo.competencia <= velho.competencia) return;
    if (familiaAssunto(novo.assunto) !== familiaAssunto(velho.assunto)) return;
    const inicio = novo.periodo_inicio > velho.periodo_inicio ? novo.periodo_inicio : velho.periodo_inicio;
    const fim = novo.periodo_fim < velho.periodo_fim ? novo.periodo_fim : velho.periodo_fim;
    if (inicio <= fim) out.push({ arquivo_id: velho.arquivo_id, novo_id: novo.arquivo_id, inicio, fim });
  }));
  return out;
}

module.exports = {
  familiaAssunto, sobreposicoes,
  normalizaNome, nomeCanonico, assinaturaNome, nomeParecido, chaveProfissional, CATEGORIA_POR_CONSELHO,
};

if (require.main === module) {
  const assert = require('assert');
  const eq = (a, b) => assert.deepStrictEqual(a, b);

  eq(normalizaNome('  Odaísa T. de M.  Miranda '), 'ODAISA T DE M MIRANDA');
  eq(nomeCanonico(new Map([['Gabriel S. P. De Souza', 42], ['GABRIEL STIVAL PAMFILIO DE SOUZA', 18]])), 'Gabriel Stival Pamfilio de Souza');
  eq(nomeCanonico(new Map([['Lucas V. Guimaraes', 149], ['Lucas V. Guimarães', 127]])), 'Lucas V. Guimarães');
  eq(nomeCanonico(new Map([['Evelin Roveda', 70], ['EVELIN ROVEDA', 9]])), 'Evelin Roveda');
  eq(nomeCanonico(new Map([['AntôNio L. Argentato', 46]])), 'Antônio L. Argentato');
  eq(assinaturaNome('Jose H. Inamonico'), assinaturaNome('JOSE HUGO INAMONICO'));
  eq(assinaturaNome('Gabriel S. P. De Souza'), assinaturaNome('GABRIEL STIVAL PAMFILIO DE SOUZA'));
  assert.notStrictEqual(assinaturaNome('Matheus X. M. de Melo'), assinaturaNome('Matheus H. R. Batista'));
  assert(nomeParecido('Maria Elena Cardoso Halin', 'MARIA ELENA CARDOZO DE HALIM'));
  assert(nomeParecido('Jose Hugo Inamonicio', 'JOSE HUGO INAMONICO'));
  assert(nomeParecido('Isabela Garcia', 'Isabela Garcia Abuissa Assad'));
  assert(!nomeParecido('Isabela Garcia Abuissa Assad', 'Isadora Garcia Abuissa Assad'));
  assert(!nomeParecido('Matheus H. R. Batista', 'Matheus X. M. de Melo'));
  eq(chaveProfissional({ conselho: 'CRM', registro: '275.195', uf: 'sp' }), { conselho: 'CRM', registro_numero: '275195', registro_uf: 'SP' });
  eq(chaveProfissional({ nome: 'João Silva', conselho: null, registro: '' }).conselho, 'SEM_REGISTRO');
  eq(chaveProfissional({ nome: 'João Silva' }).registro_numero, 'JOAO SILVA');

  eq(familiaAssunto('técnicos de enfermagem'), familiaAssunto('técnico de enfermagem'));
  eq(familiaAssunto('setor administrativo-recepção'), familiaAssunto('recepção'));
  eq(familiaAssunto('raio-x'), familiaAssunto('radiologistas'));
  const arq = (id, assunto, competencia, periodo_inicio, periodo_fim, unidade_id = 'u') => ({
    arquivo_id: id, unidade_id, assunto, competencia, periodo_inicio, periodo_fim,
  });
  eq(sobreposicoes([
    arq('mar', 'farmacêutico', '2026-03', '2026-03-16', '2026-04-15'),
    arq('abr', 'farmacêutico', '2026-04', '2026-03-16', '2026-05-15'),
    arq('jan', 'farmacêutico', '2026-01', '2025-12-16', '2026-02-15'),
    arq('fev', 'farmacêutico', '2026-02', '2026-01-16', '2026-03-15'),
    arq('enf', 'enfermeiros', '2026-04', '2026-03-16', '2026-05-15'),
    arq('out', 'farmacêutico', '2026-04', '2026-03-16', '2026-05-15', 'v'),
  ]), [
    { arquivo_id: 'mar', novo_id: 'abr', inicio: '2026-03-16', fim: '2026-04-15' },
    { arquivo_id: 'jan', novo_id: 'fev', inicio: '2026-01-16', fim: '2026-02-15' },
  ]);

  console.log('escalaNormaliza: OK');
}
