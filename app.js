let express = require('express');
let path = require('path');
let favicon = require('serve-favicon');
let logger = require('morgan');
let cookieParser = require('cookie-parser');
let bodyParser = require('body-parser');
const fs = require('fs');
const sessions = require('express-session');
const _ = require('lodash');

global.l = console.log;

// Check if the .env file exists
if (!fs.existsSync('.env')) {
  // If the .env file does not exist, copy the .env.sample file to .env
  fs.copyFileSync('.env.sample', '.env');
}

// Load the .env file
require('dotenv').config();

const { server , app  } = require('./lib/websockets');

let routes = require('./routes/index');
let users = require('./routes/users');
let api = require('./routes/api');

let port = process.env.PORT || '3000';
app.set('port', port);

// check every 5 seconds for dead sockets (still takes 10s)
//setInterval(checkForDeath, 1000 * 5);

/** END WEBSOCKETS **/

// create folders if they don't exist yet
// fs.mkdirSync('uploads', { recursive: true })
fs.mkdirSync('uploads', { recursive: true });
fs.mkdirSync('transcriptions', { recursive: true });

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(favicon(path.join(__dirname, 'public', 'images', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
// assumes nginx
// if(!isProd){
app.use(express.static(__dirname));
// }

const oneWeek = 1000 * 60 * 60 * 24 * 7;

//session middleware
app.use(
  sessions({
    secret: (Math.random() * 1000000000).toString(),
    cookie: { maxAge: oneWeek },
    saveUninitialized: false,
    resave: false,
  })
);

app.use(function (req, res, next) {
  const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  l('IP Address');
  l(ipAddress);
  next();
});

app.use('/', routes);
app.use('/', api);
app.use('/users', users);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  let err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function (err, req, res, next) {
    l(err);

    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err,
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
  l(err);
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {},
  });
});

l(`Server listening on port ${port}`);

server.listen(port);

module.exports = app;
