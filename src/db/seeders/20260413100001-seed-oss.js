'use strict';

const OSS_SCMC = '11111111-1111-1111-1111-111111111111';
const OSS_INDSH = '22222222-2222-2222-2222-222222222222';

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('tb_oss', [
      {
        oss_id: OSS_SCMC,
        nome: 'Santa Casa de Misericórdia de Cosmópolis',
        cnpj: '45.352.327/0001-55',
        tipo_org: 'Fundacao',
        email: 'contato@scmc.org.br',
        telefone: '(19) 3832-1234',
        endereco_social: 'Rua São José, 100 - Centro, Cosmópolis/SP',
        endereco_adm: 'Rua São José, 100 - Centro, Cosmópolis/SP',
        site: 'https://www.scmc.org.br',
        ativa: 1,
      },
      {
        oss_id: OSS_INDSH,
        nome: 'Instituto Nacional de Desenvolvimento Social e Humano',
        cnpj: '08.922.123/0001-00',
        tipo_org: 'Instituto',
        email: 'contato@indsh.org.br',
        telefone: '(19) 3422-5678',
        endereco_social: 'Rua Machado de Assis, 200 - Americana/SP',
        endereco_adm: 'Rua Machado de Assis, 200 - Americana/SP',
        site: 'https://www.indsh.org.br',
        ativa: 1,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('tb_oss', null, {});
  },
};
