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

var maxConcurrent = 1;
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

// home page
router.get('/', function(req, res, next) {
  // transcribe frontend page
  res.render('index', {
    title: 'Transcribe File',
    uploadPath,
    forHumans,
  });
});

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
    if(global.ws[websocketNumber]){
      websocketConnection = global.ws[websocketNumber]
    }

    const placeInQueue = queue.getQueueLength();

    l('place in queue');
    l(placeInQueue);

    l(queue);

    // general queue data
    global.queue = {}

    const amountOfCurrentPending = queue.getPendingLength()

    global.queue.currentItemNumber = amountOfCurrentPending;


    if(amountOfCurrentPending > 0){
      websocketConnection.send(JSON.stringify({
        message: 'queue',
        placeInQueue
      }), function () {});
    }

    queue.add(async function () {
      await transcribeWrapped(utf8DecodedFileName, path, language, model, websocketConnection)
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
