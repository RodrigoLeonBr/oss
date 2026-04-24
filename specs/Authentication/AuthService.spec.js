const chai = require('chai');

const { expect } = chai;
const sinon = require('sinon');
const httpStatus = require('http-status');
const bcrypt = require('bcryptjs');
const AuthService = require('../../src/service/AuthService');
const models = require('../../src/models');

const Usuario = models.usuario;

const loginData = {
  email: 'john@mail.com',
  password: '123123Asd',
};

const usuarioId = '4d85f12b-6e5b-468b-a971-eabe8acc9d08';

/** Mock com a mesma forma usada após `usuario.toJSON()` (sem segredos na resposta). */
function mockUsuarioModel(senhaPlana) {
  return {
    senha_hash: bcrypt.hashSync(senhaPlana, 8),
    toJSON() {
      return {
        usuario_id: usuarioId,
        nome: 'John Doe',
        email: 'john@mail.com',
        cpf: null,
        telefone: null,
        perfil: 'admin',
        oss_id: null,
        ativo: 1,
        ultimo_acesso: null,
        data_criacao: '2026-01-01T00:00:00.000Z',
        atualizado_em: '2026-01-01T00:00:00.000Z',
        deleted_at: null,
      };
    },
  };
}

describe('AuthService — login com e-mail e senha', () => {
  let authService;

  beforeEach(() => {
    authService = new AuthService();
  });
  afterEach(() => {
    sinon.restore();
  });

  it('autentica com sucesso e devolve o usuário sem senha', async () => {
    sinon.stub(Usuario, 'findOne').resolves(mockUsuarioModel(loginData.password));

    const result = await authService.loginWithEmailPassword(
      loginData.email,
      loginData.password,
    );

    expect(result.statusCode).to.equal(httpStatus.OK);
    expect(result.response.status).to.equal(true);
    expect(result.response.code).to.equal(httpStatus.OK);
    expect(result.response.message).to.equal('Login Successful');
    expect(result.response.data).to.include({
      usuario_id: usuarioId,
      nome: 'John Doe',
      email: 'john@mail.com',
      perfil: 'admin',
    });
    expect(result.response.data.senha_hash).to.equal(undefined);
    expect(result.response.data.token_2fa).to.equal(undefined);
  });

  it('quando o usuário não existe ou está inativo, retorna 400 e mensagem padronizada', async () => {
    sinon.stub(Usuario, 'findOne').resolves(null);

    const result = await authService.loginWithEmailPassword('test@mail.com', 'any-password');

    expect(result).to.deep.equal({
      statusCode: httpStatus.BAD_REQUEST,
      response: {
        status: false,
        code: httpStatus.BAD_REQUEST,
        message: 'E-mail não cadastrado ou inativo.',
      },
    });
  });

  it('quando a senha não confere, retorna 400 e mensagem padronizada', async () => {
    sinon.stub(Usuario, 'findOne').resolves(mockUsuarioModel('outra-senha-qualquer'));

    const result = await authService.loginWithEmailPassword(
      loginData.email,
      loginData.password,
    );

    expect(result).to.deep.equal({
      statusCode: httpStatus.BAD_REQUEST,
      response: {
        status: false,
        code: httpStatus.BAD_REQUEST,
        message: 'Senha incorreta.',
      },
    });
  });
});
