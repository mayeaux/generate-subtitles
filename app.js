const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const { WebSocketServer } = require('ws');
const fs = require('fs');
const {createServer} = require('http');
const sessions = require('express-session');
const _ = require('lodash');
l = console.log;
const { deleteOldFiles } = require('./scripts/deleteTranscriptionUploads');

// Load the .env file
require('dotenv').config();

const { createWebSocketServer } = require('./lib/websockets');

l('node env');
l(process.env.NODE_ENV);

// run stats gathering
require('./lib/stats');

// Check if the .env file exists
if (!fs.existsSync('.env')) {
  // If the .env file does not exist, copy the .env.sample file to .env
  fs.copyFileSync('.env.sample', '.env');
}

const hourInMilliseconds = 1000 * 60 * 60;

function runDeleteLoop () {
  setTimeout(() => {
    deleteOldFiles(true);
    runDeleteLoop();
  }, hourInMilliseconds);  // repeat every 1000 milliseconds (1 second)
}

if (process.env.NODE_ENV === 'production') {
  deleteOldFiles(true);
  runDeleteLoop();
}

l(`FILES PASSWORD: ${process.env.FILES_PASSWORD}`);

const routes = require('./routes/index');
const users = require('./routes/users');
const api = require('./routes/api');
const stats = require('./routes/stats');
const player = require('./routes/player');
const transcribe = require('./routes/transcribe');
const admin = require('./routes/admin');

const app = express();
const server = createServer(app);

createWebSocketServer(server);

l = console.log;

// l = function(l) {
//   var stack = (new Error()).stack.split(/\n/);
//   // Chrome includes a single "Error" line, FF doesn't.
//   if (stack[0].indexOf('Error') === 0) {
//     stack = stack.slice(1);
//   }
//   var args = [].slice.apply(arguments).concat([stack[1].trim()]);
//   return console.log(console, args);
// }
const port = process.env.PORT || '3000';
app.set('port', port);

// create folders if they don't exist yet
// fs.mkdirSync('uploads', { recursive: true })
fs.mkdirSync('uploads', { recursive: true })
fs.mkdirSync('transcriptions', { recursive: true })

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(favicon(path.join(__dirname,'public','images','favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
// assumes nginx
// if(!isProd){
  // TODO: this isn't secure if the API key is there
  app.use(express.static(__dirname));
// }

const oneWeek = 1000 * 60 * 60 * 24 * 7;

//session middleware
app.use(sessions({
  secret: (Math.random() * 1000000000).toString(),
  cookie: { maxAge: oneWeek },
  saveUninitialized: false,
  resave: false
}));

app.use(function (req, res, next) {
  const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  l('IP Address')
  l(ipAddress);
  next();
})

app.use('/', routes);
app.use('/', api);
app.use('/users', users);
app.use('/', stats);
app.use('/', transcribe);
app.use('/', admin);
app.use('/', player);

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
      error: err
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
    error: {}
  });
});

l(`Server listening on port ${port}`)

server.listen(port);

module.exports = app;
