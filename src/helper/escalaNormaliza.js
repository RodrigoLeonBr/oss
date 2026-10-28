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

/** Chave única do profissional; sem registro, o nome normalizado faz o papel do número. */
function chaveProfissional({ nome, conselho, registro, uf }) {
  const num = String(registro || '').replace(/\D/g, '');
  if (conselho && num) {
    return { conselho, registro_numero: num, registro_uf: conselho === 'MATRICULA' ? '' : (uf || 'SP').toUpperCase() };
  }
  return { conselho: 'SEM_REGISTRO', registro_numero: normalizaNome(nome).slice(0, 120), registro_uf: '' };
}

module.exports = { normalizaNome, nomeCanonico, assinaturaNome, chaveProfissional, CATEGORIA_POR_CONSELHO };

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
  eq(chaveProfissional({ conselho: 'CRM', registro: '275.195', uf: 'sp' }), { conselho: 'CRM', registro_numero: '275195', registro_uf: 'SP' });
  eq(chaveProfissional({ nome: 'João Silva', conselho: null, registro: '' }).conselho, 'SEM_REGISTRO');
  eq(chaveProfissional({ nome: 'João Silva' }).registro_numero, 'JOAO SILVA');

  console.log('escalaNormaliza: OK');
}
