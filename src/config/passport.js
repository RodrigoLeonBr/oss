const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const config = require('./config');
const { tokenTypes } = require('./tokens');
const TokenDao = require('../dao/TokenDao');
const RedisService = require('../service/RedisService');
const models = require('../models');

const Usuario = models.usuario;

const jwtOptions = {
    secretOrKey: config.jwt.secret,
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    passReqToCallback: true,
};

const jwtVerify = async (req, payload, done) => {
    try {
        if (payload.type !== tokenTypes.ACCESS) {
            throw new Error('Invalid token type');
        }

        const authorization = req.headers.authorization
            ? req.headers.authorization.split(' ')
            : [];

        if (!authorization[1]) {
            return done(null, false);
        }

        // Verificar token no Redis (cache) ou no banco
        // hasToken é async: sem await, tokenDoc virava Promise (truthy) e a validação era ignorada
        const redisService = new RedisService();
        const tokenDao = new TokenDao();

        const inRedis = await redisService.hasToken(authorization[1], 'access_token');
        const tokenRecord = inRedis
            ? { ok: true }
            : await tokenDao.findOne({
                token: authorization[1],
                type: tokenTypes.ACCESS,
                blacklisted: false,
            });

        if (!tokenRecord) {
            return done(null, false);
        }

        // Carregar usuário de tb_usuarios por usuario_id
        const user = await Usuario.findOne({
            where: { usuario_id: payload.sub, ativo: 1 },
        });

        if (!user) {
            return done(null, false);
        }

        done(null, user);
    } catch (error) {
        console.error('[passport jwtVerify]', error.message);
        done(error, false);
    }
};

const jwtStrategy = new JwtStrategy(jwtOptions, jwtVerify);

module.exports = { jwtStrategy };
