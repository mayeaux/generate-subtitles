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
const _ = require('lodash');

var routes = require('./routes/index');
var users = require('./routes/users');

var app = express();



l = console.log;

// l = function(l){
//   var stack = (new Error()).stack.split(/\n/);
//   // Chrome includes a single "Error" line, FF doesn't.
//   if(stack[0].indexOf('Error') === 0){
//     stack = stack.slice(1);
//   }
//   var args = [].slice.apply(arguments).concat([stack[1].trim()]);
//   return console.log(console, args);
// }
var port = process.env.PORT || '3000';
app.set('port', port);



/** BEGIN WEBSOCKETS **/
const server = createServer(app);
const wss = new WebSocketServer({ server });

global['webSocketData'] = []

function heartbeat() {
  l('checking heartbeat');
  this.isAlive = true;
}

wss.on('connection', function (websocketConnection, request, client) {

  // chart that it exists for first time (add to global.ws)
  websocketConnection.isAlive = true;
  // set up an event, when it receives pong it marks itself alive (overwriting the dead)
  websocketConnection.on('pong', heartbeat);

  const websocketNumber = request.url.split('/')[1];

  global['webSocketData'].push({
    websocketNumber,
    websocket: websocketConnection,
    status: 'alive',
  })

  l(`websocket connected: ${websocketNumber}`);


  websocketConnection.on('close', function (ws) {
    l(`websocket closed: ${websocketNumber}`);
  });
});

function checkForDeath(){
  l('checking for death');
  l(global.webSocketData.length);
  // loop through array of objects of websockets
  for(let [index, websocket] of global['webSocketData'].entries() ){
    // the actual websocket
    l(websocket.websocketNumber)
    const websocketConnection = websocket.websocket;

    // destroy killed websockets and cancel their transcriptions
    if (websocketConnection.isAlive === false){
      l('found a dead one!');
      //
      websocketConnection.terminate();
      global.webSocketData.splice(index, 1);
      const closerTranscription = global['transcriptions'].find(function(transcription){
        return transcription.websocketNumber === websocket.websocketNumber;
      })

      l('closer transcription');
      l(closerTranscription)

      // kill the process
      if(closerTranscription && closerTranscription.process)

        closerTranscription.process.kill('SIGINT');

        const transcriptionIndex =  global['transcriptions'].indexOf(closerTranscription);
        if (index > -1) { // only splice array when item is found
          global['transcriptions'].splice(transcriptionIndex, 1); // 2nd parameter means remove one item only
        } else {
          l('Didnt find huh?')
        }

      continue
    }

    // KILL THE PROCESS FROM THE GLOBAL THING

    /** TEST FOR ALIVENESS */
    // mark them as dead, but then check immediately after for redemption chance
    websocketConnection.isAlive = false;
    // trigger their pong event
    websocketConnection.ping();
  }
}

// todo: change to 10
setInterval(checkForDeath, 1000 * 10);


/** END WEBSOCKETS **/



fs.mkdirSync('uploads', { recursive: true })
fs.mkdirSync('transcriptions', { recursive: true })

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(favicon(path.join(__dirname,'public','images','favicon.ico')));
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
