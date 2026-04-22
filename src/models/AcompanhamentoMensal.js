const { Model, DataTypes } = require('sequelize');

class AcompanhamentoMensal extends Model {
  static init(sequelize) {
    return super.init(
      {
        acomp_id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: sequelize.literal('(UUID())') },
        indicador_id: { type: DataTypes.CHAR(36), allowNull: false },
        meta_id: { type: DataTypes.CHAR(36), allowNull: false },
        mes_referencia: { type: DataTypes.DATEONLY, allowNull: false },
        meta_vigente_mensal: DataTypes.DECIMAL(15, 4),
        meta_vigente_qualit: DataTypes.DECIMAL(15, 4),
        meta_minima:    DataTypes.DECIMAL(15, 4),
        meta_parcial:   DataTypes.DECIMAL(15, 4),
        meta_tipo_snap: {
          type: DataTypes.ENUM('maior_igual', 'menor_igual'),
          allowNull: false,
          defaultValue: 'maior_igual',
        },
        valor_realizado: DataTypes.DECIMAL(15, 4),
        percentual_cumprimento: { type: DataTypes.VIRTUAL, get() {
          const meta = parseFloat(this.getDataValue('meta_vigente_mensal'));
          const real = parseFloat(this.getDataValue('valor_realizado'));
          if (meta && meta > 0 && real !== null) return parseFloat(((real / meta) * 100).toFixed(4));
          return null;
        }},
        variacao_vs_mes_ant: DataTypes.DECIMAL(8, 4),
        status_cumprimento: {
          type: DataTypes.ENUM(
            'cumprido', 'parcial', 'nao_cumprido', 'nao_aplicavel', 'aguardando',
            'atingido', 'nao_atingido', 'pendente',
          ),
          allowNull: false,
          defaultValue: 'aguardando',
        },
        faixa_producao: { type: DataTypes.ENUM('acima_meta', 'entre_85_100', 'entre_70_84', 'abaixo_70') },
        status_implantacao: { type: DataTypes.ENUM('nao_iniciado', 'em_prazo', 'cumprido', 'vencido') },
        data_cumprimento_impl: DataTypes.DATEONLY,
        descricao_desvios: DataTypes.TEXT,
        status_aprovacao: { type: DataTypes.ENUM('rascunho', 'submetido', 'aprovado', 'rejeitado'), allowNull: false, defaultValue: 'rascunho' },
        preenchido_por: DataTypes.CHAR(36),
        data_preenchimento: DataTypes.DATE,
        submetido_por: DataTypes.CHAR(36),
        data_submissao: DataTypes.DATE,
        aprovado_por: DataTypes.CHAR(36),
        data_aprovacao: DataTypes.DATE,
        motivo_rejeicao: DataTypes.TEXT,
        desconto_estimado: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0.00 },
        versao: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      },
      {
        sequelize,
        modelName: 'acompanhamento_mensal',
        tableName: 'tb_acompanhamento_mensal',
        timestamps: true,
        createdAt: 'criado_em',
        updatedAt: 'atualizado_em',
      }
    );
  }

  static associate(models) {
    this.belongsTo(models.indicador, { foreignKey: 'indicador_id', as: 'indicador' });
    this.belongsTo(models.meta, { foreignKey: 'meta_id', as: 'meta' });
    this.belongsTo(models.usuario, { foreignKey: 'preenchido_por', as: 'preenchedor' });
    this.belongsTo(models.usuario, { foreignKey: 'aprovado_por', as: 'aprovador' });
    this.hasMany(models.nota_explicativa, { foreignKey: 'acomp_id', as: 'notas' });
    this.hasMany(models.desconto_indicador, { foreignKey: 'acomp_id', as: 'descontos' });
  }
}

module.exports = AcompanhamentoMensal;
