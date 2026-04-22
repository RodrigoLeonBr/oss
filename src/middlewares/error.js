const httpStatus = require('http-status');
const config = require('../config/config');
const ApiError = require('../helper/ApiError');
const logger = require('../config/logger');

function normalizeStatusCodeFromErr(err) {
    const c = err && (err.statusCode ?? err.code);
    if (c === undefined || c === null) return null;
    const n = Number(c);
    if (!Number.isFinite(n) || n < 400 || n > 599) return null;
    return Math.trunc(n);
}

const errorConverter = (err, req, res, next) => {
    if (err instanceof ApiError) {
        return next(err);
    }
    const fromErr = normalizeStatusCodeFromErr(err);
    if (fromErr && fromErr < 500) {
        return next(new ApiError(fromErr, err.message || 'Erro', err.isOperational !== false, err.stack));
    }
    if (fromErr && fromErr >= 500) {
        return next(
            new ApiError(fromErr, err.message || 'Erro', err.isOperational === true, err.stack),
        );
    }
    // Passport / JWT: muitas falhas vêm como Error com message "No auth token" (sem statusCode)
    const msg = (err && err.message) || '';
    if (typeof msg === 'string' && (msg === 'No auth token' || msg.includes('auth token'))) {
        return next(new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate', true, err?.stack));
    }
    const statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    const message = err?.message || httpStatus[httpStatus.INTERNAL_SERVER_ERROR];
    return next(new ApiError(statusCode, message, false, err?.stack));
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
    const initialMsg = err.message;
    const rawCode = err.statusCode ?? err.code;
    const normalized = normalizeStatusCodeFromErr({ statusCode: rawCode, code: rawCode });
    let statusCode = normalized != null ? normalized : httpStatus.INTERNAL_SERVER_ERROR;
    let message =
        typeof initialMsg === 'string' && initialMsg
            ? initialMsg
            : String(httpStatus[statusCode] || statusCode);
    if (config.nodeEnv === 'production' && !err.isOperational) {
        statusCode = httpStatus.INTERNAL_SERVER_ERROR;
        message = String(httpStatus[httpStatus.INTERNAL_SERVER_ERROR] || 'Internal Server Error');
    }

    res.locals.errorMessage = err.message;

    const response = {
        code: statusCode,
        message,
        ...(config.nodeEnv === 'development' && { stack: err.stack }),
    };

    if (config.nodeEnv === 'development') {
        logger.error(err);
    }

    res.status(statusCode).send(response);
};

module.exports = {
    errorConverter,
    errorHandler,
};
