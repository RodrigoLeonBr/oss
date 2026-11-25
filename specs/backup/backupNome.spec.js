const { expect } = require('chai');
const { NOME_VALIDO } = require('../../src/service/BackupService');

// Download e remoção aceitam só nomes gerados pelo módulo. Path traversal deve ser barrado aqui.
describe('BackupService — validação de nome de arquivo', () => {
    it('aceita nomes gerados pelo módulo (.sql e .sql.gz)', () => {
        expect(NOME_VALIDO.test('backup-manual-2026-11-25T09-51-23-000Z.sql.gz')).to.equal(true);
        expect(NOME_VALIDO.test('importado-2026-11-25T09-51-23-000Z.sql')).to.equal(true);
    });

    it('recusa caminhos, traversal e extensões fora do padrão', () => {
        ['../../.env', '..\\..\\x.sql', 'a/b.sql', 'backup.exe', 'backup.sql.part', '.sql', 'x.sql.gz.sh'].forEach((nome) => {
            expect(NOME_VALIDO.test(nome), nome).to.equal(false);
        });
    });
});
