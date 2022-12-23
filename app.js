
var express = require('express');

var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
const fs = require('fs');
const sessions = require('express-session');
const _ = require('lodash');

// Check if the .env file exists
if (!fs.existsSync('.env')) {
  // If the .env file does not exist, copy the .env.sample file to .env
  fs.copyFileSync('.env.sample', '.env');
}

// Load the .env file
require('dotenv').config();

const { server , app  } = require('./lib/websockets');

var routes = require('./routes/index');
var users = require('./routes/users');
var api = require('./routes/api');
var player = require('./routes/player');
var stats = require('./routes/stats');
const WebSocket = require("ws");


const isProd = process.NODE_ENV === 'production';

l = console.log;

var port = process.env.PORT || '3000';
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
app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '1mb' }));
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

app.use('/', api);
app.use('/users', users);
app.use('/', stats);
app.use('/', routes);


// catch 404 and forward to error handler
app.use(function (req, res, next) {
  var err = new Error('Not Found');
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
