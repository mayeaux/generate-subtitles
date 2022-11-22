var express = require('express');
const axios = require("axios");
const multer = require("multer");
var router = express.Router();
const FormData = require('form-data');
const fs = require('fs/promises');
const downloadAndTranscribe = require('../download.js')
// const transcribe = require('../transcribe');
const transcribeWrapped = require('../transcribe-wrapped');
const Queue = require("promise-queue");
const constants = require('../constants');
const {languagesToTranscribe} = require("../constants");
const filenamify = require("filenamify");
const forHumans = require('../helpers').forHumans;
const path = require('path');
const moment = require('moment');
const { languagesToTranslateTo } = constants;

// l('constants');
// l(constants);

const makeFileNameSafe = function(string){
  return filenamify(string, {replacement: '_' }).replace(/ /g,"_").replace(/[&\/\\#,+()$~%.'":*?<>{}!]/g, '');
}

let concurrentJobs = process.env.CONCURRENT_AMOUNT;
if(process.NODE_ENV === 'development'){
  concurrentJobs = 1;
}

l(`CONCURRENT JOBS ALLOWED AMOUNT: ${concurrentJobs} `)

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
    let model = req.body.model;
    const websocketNumber = req.body.websocketNumber;
    const uploadedFilePath = req.file.path;

    let logFileNames = true;
    // something.mp4
    let originalFileNameWithExtension = decode_utf8(req.file.originalname);

    // .mp4 (includes leading period)
    const originalFileExtension = path.parse(originalFileNameWithExtension).ext;

    const originalFileNameWithoutExtension = path.parse(originalFileNameWithExtension).name;
    l('originalFileNameWithoutExtension')
    l(originalFileNameWithoutExtension)

    // something
    const directorySafeFileNameWithoutExtension = makeFileNameSafe(originalFileNameWithoutExtension)

    l('directorySafeFileNameWithoutExtension')
    l(directorySafeFileNameWithoutExtension)


    // something.mp4
    const directorySafeFileNameWithExtension = `${directorySafeFileNameWithoutExtension}${originalFileExtension}`

    if(!uploadedFilePath){ res.status(500); res.send('no file')}

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
        throw new Error('no websocket!');
      }

    }

    // TODO: this is wrong, it's with adding the pending length to get amount in front
    const placeInQueue = queue.getQueueLength();

    l(queue);
    l('place in queue');
    l(placeInQueue);

    // general queue data
    global.queue = {}

    const amountOfCurrentPending = queue.getPendingLength()

    const amountinQueue = queue.getQueueLength()

    const totalOutstanding = amountOfCurrentPending + amountinQueue;

    l('totaloutstanding');
    l(totalOutstanding);

    // give frontend their queue position
    if(amountOfCurrentPending > 0){
      websocketConnection.send(JSON.stringify({
        message: 'queue',
        placeInQueue: totalOutstanding
      }), function () {});
    }

    global.queueData.push(websocketNumber)

    l('queue data');
    l(global.queueData);

    // make the model medium by default
    if(!model){
      model = 'medium';
    }

    const timestampString = moment(new Date()).format('DD-MMMM-YYYY_HH_mm_ss');

    const separator = '---'

    const fileSafeNameWithDateTimestamp = `${directorySafeFileNameWithoutExtension}${separator}${timestampString}`;

    const fileSafeNameWithDateTimestampAndExtension = `${directorySafeFileNameWithoutExtension}${separator}${timestampString}${originalFileExtension}`;

    queue.add(async function () {
      // TODO: catch the error here?
      await transcribeWrapped({
        uploadedFilePath,
        language,
        model,
        directorySafeFileNameWithoutExtension,
        directorySafeFileNameWithExtension,
        originalFileNameWithExtension,
        fileSafeNameWithDateTimestamp,
        fileSafeNameWithDateTimestampAndExtension,

        // websocket/queue
        websocketConnection,
        websocketNumber,
        queue,
        languagesToTranslateTo
      })
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

// router.get("/transcriptions/:path/:filename" , async function(req, res, next){
//   console.log(req.params);
//   res.sendFile(`${process.cwd()}/transcriptions/${req.params.path}/${req.params.filename}`);
// });

l(process.cwd());

/** PLYR PLAYER **/
router.get("/player/:filename" , async function(req, res, next){
  try {
    const fileNameWithoutExtension = req.params.filename

    const processDirectory = process.cwd();

    const filePathWithoutExtension = `/transcriptions/${fileNameWithoutExtension}/${fileNameWithoutExtension}`;

    l('filePathWithoutExtension')
    l(filePathWithoutExtension);

    const containingFolder = `${processDirectory}/transcriptions/${fileNameWithoutExtension}`

    const processingDataPath = `${containingFolder}/processing_data.json`;

    const processingData = JSON.parse(await fs.readFile(processingDataPath, 'utf8'));

    l('processing data');
    l(processingData);

    res.render('player', {
      filePath: filePathWithoutExtension,
      languages: languagesToTranscribe,
      fileNameWithoutExtension,
      filePathWithoutExtension,
      processingData
      // vttPath,
      // fileSource
    })
  } catch (err){
    l('err');
    l(err);
    res.send(err);
  }
});


/** VIDEOJS PLAYER (SUCKS) **/
// router.get("/player" , async function(req, res, next){
//   console.log(req.params);
//
//   res.render('player', {
//     vttPath,
//     fileSource
//   })
// });






/** UNFINISHED FUNCTIONALITY **/
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


module.exports = router;
