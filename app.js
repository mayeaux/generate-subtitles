var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
const { WebSocketServer } = require('ws');
const fs = require('fs');
const {createServer} = require("http");
const sessions = require('express-session');

var routes = require('./routes/index');
var users = require('./routes/users');

var app = express();

l = console.log;

var port = process.env.PORT || '3000';
app.set('port', port);

/**
 * Create HTTP server.
 */

const server = createServer(app);
const wss = new WebSocketServer({ server });

// store websocket connection based on random number generated
global.ws = {}

global.wss = wss;

wss.on('connection', function (websocketConnection, request, client) {

  // setInterval(function(){
  //   ws.send(Math.random(), function () {});
  // }, 2000);

  l('websocket connected');
  //
  // l(websocketConnection);
  // l(request);
  // l(client);

  const websocketNumber = request.url.split('/')[1];

  l(websocketNumber);

  global.ws[websocketNumber] = websocketConnection;


  websocketConnection.on('close', function () {
    console.log('websocket connection closed');
  });
});

fs.mkdirSync('uploads', { recursive: true })
fs.mkdirSync('transcriptions', { recursive: true })

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

const oneWeek = 1000 * 60 * 60 * 24 * 7;

//session middleware
app.use(sessions({
  secret: (Math.random() * 1000000000).toString(),
  cookie: { maxAge: oneWeek },
  saveUninitialized: false,
  resave: false
}));

app.use(function(req, res, next){
  const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  l('IP Address')
  l(ipAddress);
  next();
})


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

l(`Server listening on port ${port}`)

server.listen(port);

module.exports = app;
