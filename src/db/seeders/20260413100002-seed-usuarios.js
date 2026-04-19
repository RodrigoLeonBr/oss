'use strict';

const bcrypt = require('bcryptjs');

const OSS_SCMC = '11111111-1111-1111-1111-111111111111';
const OSS_INDSH = '22222222-2222-2222-2222-222222222222';

module.exports = {
  async up(queryInterface) {
    const hash = await bcrypt.hash('Oss@2026', 10);

    await queryInterface.bulkInsert('tb_usuarios', [
      {
        usuario_id: 'aaaa0001-0001-0001-0001-000000000001',
        nome: 'Administrador Geral',
        email: 'admin@americana.sp.gov.br',
        perfil: 'admin',
        senha_hash: hash,
        ativo: 1,
      },
      {
        usuario_id: 'aaaa0002-0002-0002-0002-000000000002',
        nome: 'Gestor SMS',
        email: 'gestor@sms.americana.sp.gov.br',
        perfil: 'gestor_sms',
        senha_hash: hash,
        ativo: 1,
      },
      {
        usuario_id: 'aaaa0003-0003-0003-0003-000000000003',
        nome: 'Auditora SMS',
        email: 'auditora@sms.americana.sp.gov.br',
        perfil: 'auditora',
        senha_hash: hash,
        ativo: 1,
      },
      {
        usuario_id: 'aaaa0004-0004-0004-0004-000000000004',
        nome: 'Conselheiro CMS',
        email: 'cms@americana.sp.gov.br',
        perfil: 'conselheiro_cms',
        senha_hash: hash,
        ativo: 1,
      },
      {
        usuario_id: 'aaaa0005-0005-0005-0005-000000000005',
        nome: 'Operador SCMC',
        email: 'operador@scmc.org.br',
        perfil: 'contratada_scmc',
        oss_id: OSS_SCMC,
        senha_hash: hash,
        ativo: 1,
      },
      {
        usuario_id: 'aaaa0006-0006-0006-0006-000000000006',
        nome: 'Operador INDSH',
        email: 'operador@indsh.org.br',
        perfil: 'contratada_indsh',
        oss_id: OSS_INDSH,
        senha_hash: hash,
        ativo: 1,
      },
      {
        usuario_id: 'aaaa0007-0007-0007-0007-000000000007',
        nome: 'Central Regulação',
        email: 'regulacao@sms.americana.sp.gov.br',
        perfil: 'central_regulacao',
        senha_hash: hash,
        ativo: 1,
      },
      {
        usuario_id: 'aaaa0008-0008-0008-0008-000000000008',
        nome: 'Visualizador Externo',
        email: 'visualizador@americana.sp.gov.br',
        perfil: 'visualizador',
        senha_hash: hash,
        ativo: 1,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('tb_usuarios', null, {});
  },
};
