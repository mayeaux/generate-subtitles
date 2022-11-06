var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
const { WebSocketServer } = require('ws');


var routes = require('./routes/index');
var users = require('./routes/users');
const fs = require('fs');
const http = require("http");
const {createServer} = require("http");

var app = express();



var port = process.env.PORT || '3000';
app.set('port', port);

/**
 * Create HTTP server.
 */

const server = createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', function (ws, request, client) {

  global.ws = ws;

  // setInterval(function(){
  //   ws.send(Math.random(), function () {});
  // }, 2000);

  l('running here');
  //
  // l(ws);
  // l(request);
  // l(client);


  ws.on('close', function () {
    console.log('stopping client interval');
  });
});

// global.wss = wss;

fs.mkdirSync('uploads', { recursive: true })
fs.mkdirSync('transcriptions', { recursive: true })

l = console.log;

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/users', users);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
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
app.use(function(err, req, res, next) {
  l(err);
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

server.listen(port);

module.exports = app;
