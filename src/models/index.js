const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');

const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
// eslint-disable-next-line import/no-dynamic-require
const config = require(`${__dirname}/../config/database.js`)[env];
const db = {};

let sequelize;
if (config.use_env_variable) {
    sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
    sequelize = new Sequelize(config.database, config.username, config.password, config);
}

fs.readdirSync(__dirname)
    .filter((file) => {
        return file.indexOf('.') !== 0 && file !== basename && file.slice(-3) === '.js';
    })
    .forEach((file) => {
        // eslint-disable-next-line global-require,import/no-dynamic-require
        const exported = require(path.join(__dirname, file));
        let model;
        if (typeof exported === 'function' && exported.prototype instanceof Sequelize.Model) {
            model = exported.init(sequelize);
        } else {
            model = exported(sequelize, Sequelize.DataTypes);
        }
        db[model.name] = model;
    });

Object.keys(db).forEach((modelName) => {
    if (db[modelName].associate) {
        db[modelName].associate(db);
    }
});

// Aliases PascalCase para modelos UNACON
if (db.unacon_paciente) db.UnaconPaciente = db.unacon_paciente;
if (db.unacon_procedimento) db.UnaconProcedimento = db.unacon_procedimento;
if (db.unacon_conciliacao) db.UnaconConciliacao = db.unacon_conciliacao;
if (db.unacon_upload) db.UnaconUpload = db.unacon_upload;

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
