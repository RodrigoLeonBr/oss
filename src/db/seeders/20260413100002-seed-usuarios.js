'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const OSS_SCMC = '11111111-1111-1111-1111-111111111111';
const OSS_INDSH = '22222222-2222-2222-2222-222222222222';

// Dados fixos dos usuários. A senha NUNCA fica hardcoded: é gerada por usuário no seed.
const USUARIOS = [
  { usuario_id: 'aaaa0001-0001-0001-0001-000000000001', nome: 'Administrador Geral', email: 'admin@americana.sp.gov.br', perfil: 'admin' },
  { usuario_id: 'aaaa0002-0002-0002-0002-000000000002', nome: 'Gestor SMS', email: 'gestor@sms.americana.sp.gov.br', perfil: 'gestor_sms' },
  { usuario_id: 'aaaa0003-0003-0003-0003-000000000003', nome: 'Auditora SMS', email: 'auditora@sms.americana.sp.gov.br', perfil: 'auditora' },
  { usuario_id: 'aaaa0004-0004-0004-0004-000000000004', nome: 'Conselheiro CMS', email: 'cms@americana.sp.gov.br', perfil: 'conselheiro_cms' },
  { usuario_id: 'aaaa0005-0005-0005-0005-000000000005', nome: 'Operador SCMC', email: 'operador@scmc.org.br', perfil: 'contratada_scmc', oss_id: OSS_SCMC },
  { usuario_id: 'aaaa0006-0006-0006-0006-000000000006', nome: 'Operador INDSH', email: 'operador@indsh.org.br', perfil: 'contratada_indsh', oss_id: OSS_INDSH },
  { usuario_id: 'aaaa0007-0007-0007-0007-000000000007', nome: 'Central Regulação', email: 'regulacao@sms.americana.sp.gov.br', perfil: 'central_regulacao' },
  { usuario_id: 'aaaa0008-0008-0008-0008-000000000008', nome: 'Visualizador Externo', email: 'visualizador@americana.sp.gov.br', perfil: 'visualizador' },
];

const gerarSenha = () => crypto.randomBytes(12).toString('base64url');

module.exports = {
  async up(queryInterface) {
    const credenciais = [];
    const rows = [];
    for (const u of USUARIOS) {
      const senha = gerarSenha();
      credenciais.push({ email: u.email, perfil: u.perfil, senha });
      // eslint-disable-next-line no-await-in-loop
      rows.push({ ...u, senha_hash: await bcrypt.hash(senha, 10), ativo: 1 });
    }

    await queryInterface.bulkInsert('tb_usuarios', rows);

    // Senhas em claro gravadas só em arquivo local (gitignored). Nunca no banco nem no repo.
    const arquivo = path.resolve(process.cwd(), 'seed-credenciais.local.json');
    fs.writeFileSync(arquivo, JSON.stringify(credenciais, null, 2), { encoding: 'utf8', mode: 0o600 });
    // eslint-disable-next-line no-console
    console.log(
      `\n[seed] Credenciais iniciais gravadas em ${arquivo}\n`
      + '       Arquivo é gitignored. Guarde em cofre e troque as senhas após o 1º login.\n',
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('tb_usuarios', null, {});
  },
};
