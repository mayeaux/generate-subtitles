var express = require('express');
const axios = require("axios");
const multer = require("multer");
var router = express.Router();
const FormData = require('form-data');
const fs = require('fs/promises');
const downloadAndTranscribe = require('../download.js')
const transcribe = require('../transcribe');
const transcribeWrapped = require('../transcribe-wrapped');
const Queue = require("promise-queue");
const forHumans = require('../helpers').forHumans;

let concurrentJobs = process.env.CONCURRENT_AMOUNT;

concurrentJobs = 1;

// todo: on dif node-env change it to 2
var maxConcurrent = ( concurrentJobs && Number(concurrentJobs) ) || 1;
var maxQueue = Infinity;
var queue = new Queue(maxConcurrent, maxQueue);

l(queue);

const storage = multer.diskStorage({ // notice you are calling the multer.diskStorage() method here, not multer()
  destination: function(req, file, cb) {
    cb(null, './uploads/')
  },
});

var upload = multer({ storage });

l = console.log;

const uploadPath =  process.env.UPLOAD_PATH || 'localhost:3000';

function decode_utf8(s) {
  return decodeURIComponent(escape(s));
}

const nodeEnv = process.env.NODE_ENV || 'development';
l('nodeEnv');
l(nodeEnv);

// home page
router.get('/', function(req, res, next) {
  // transcribe frontend page
  res.render('index', {
    title: 'Transcribe File',
    uploadPath,
    forHumans,
    nodeEnv
  });
});

global.queueData = [];

router.post('/file', upload.single('file'), function (req, res, next) {
  // l(global.ws);

  try {
    l(req.file);
    l(req.body);

    const language = req.body.language;
    const model = req.body.model;
    const websocketNumber = req.body.websocketNumber;
    const path = req.file.path;

    const utf8DecodedFileName = decode_utf8(req.file.originalname);

    if(!path){ res.status(500); res.send('no file')}

    // load websocket by passed number
    let websocketConnection;
    if(global.webSocketData){
      l(global.webSocketData);
      const websocket = global.webSocketData.find(function(websocket){
        return websocketNumber === websocket.websocketNumber;
      })
      if(websocket){
        websocketConnection = websocket.websocket;
      } else {
        throw new Error('broken!');
      }

    }

    const placeInQueue = queue.getQueueLength();

    l(queue);
    l('place in queue');
    l(placeInQueue);

    l('amount of people in front')
    l(placeInQueue);

    // general queue data
    global.queue = {}

    const amountOfCurrentPending = queue.getPendingLength()

    global.queue.currentItemNumber = amountOfCurrentPending;


    // give frontend their queue position
    if(amountOfCurrentPending > 0){
      websocketConnection.send(JSON.stringify({
        message: 'queue',
        placeInQueue
      }), function () {});
    }

    global.queueData.push(websocketNumber)

    l('queue data');
    l(global.queueData);

    queue.add(async function () {
      await transcribeWrapped(utf8DecodedFileName, path, language, model, websocketConnection, websocketNumber)
    })

    const obj = JSON.parse(JSON.stringify(req.body));
    l(obj);

    // l(req.files);
    // l(req.body);
    res.send('ok');
    // req.files is array of uploaded files
    // req.body will contain the text fields, if there were any
  } catch (err){
    l('err')
    l(err);
    throw(err);
  }
});

// post file from backend
router.post('/post', async function(req, res, next){
  try {
    l(req.body);
    l(req.params);

    const endpointToHit = 'http:localhost:3000'

    // Create a new form instance
    const form = new FormData();

    const file = await fs.readFile('./ljubav.srt');
    l('file');
    l(file);

    form.append('subtitles', file, 'subtitles');

    form.append('filename', 'ljubav.srt');


    l('form headers');
    l(form.getHeaders())

    const response = await axios.post(endpointToHit, form, {
      headers: {
        ...form.getHeaders(),
      },
      data: {
        foo: 'bar', // This is the body part
      }
    });

    // l('response');
    // l(response);

    // res.send('ok');
  } catch (err){
    l('err');
    l(err);
  }
})

router.get("/transcriptions/:path/:filename" , async function(req, res, next){
  console.log(req.params);
  res.sendFile(`${process.cwd()}/transcriptions/${req.params.path}/${req.params.filename}`);
});


module.exports = router;
