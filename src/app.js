const express = require('express');
const cors = require('cors');
const passport = require('passport');
const httpStatus = require('http-status');
const path = require('path');
const compression = require('compression');
const routes = require('./route');
const { jwtStrategy } = require('./config/passport');
const { errorConverter, errorHandler } = require('./middlewares/error');
const ApiError = require('./helper/ApiError');

process.env.PWD = process.cwd();

const app = express();

// enable cors
app.use(cors());
app.options('*', cors());

app.use(express.static(`${process.env.PWD}/public`));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// jwt authentication
app.use(passport.initialize());
passport.use('jwt', jwtStrategy);

app.get('/', async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
        return;
    }
    res.status(200).send('Congratulations! API is working!');
});
app.use('/api', routes);

if (process.env.NODE_ENV === 'production') {
    app.use(compression());
    app.use(express.static(path.join(__dirname, '../frontend/dist')));
    app.get(/^(?!\/api).*/, (req, res) => {
        res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
    });
}

// send back a 404 error for any unknown api request
app.use('/api/*', (req, res, next) => {
    next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
});

// convert error to ApiError, if needed
app.use(errorConverter);

// handle error
app.use(errorHandler);
const db = require('./models');

// Uncomment this line if you want to sync database model
// db.sequelize.sync()

module.exports = app;
