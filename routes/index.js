var express = require('express');
const axios = require("axios");
const multer = require("multer");
var router = express.Router();
const FormData = require('form-data');
const fs = require('fs-extra');
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
const { languagesToTranslateTo, newLanguagesMap } = constants;

// const languageNameMap = require('language-name-map/map')
// l('language name map');
// l(newLanguagesMap.reverse())

// one minute in milliseconds
const oneMinute = 1000 * 60;

const interval = oneMinute;

global.siteStats = {}

async function getTranscriptionData(){
  let totalSeconds = 0;

  const processDirectory = process.cwd();
  const transcriptionsDirectory = `${processDirectory}/transcriptions`;
  const transcriptionsDirectoryContents = await fs.readdir(transcriptionsDirectory);

  // loop through all transcription directories
  for (const transcriptionDirectory of transcriptionsDirectoryContents) {
    // check if directory is directory
    const directoryPath = `${transcriptionsDirectory}/${transcriptionDirectory}`;

    // this is guaranteed to exist
    const directoryStats = await fs.stat(directoryPath);

    const isDirectory = directoryStats.isDirectory();

    // only loop through if it's a directory
    if (isDirectory) {
      // check if directory has a processing_data.json file
      const processingDataPath = `${directoryPath}/processing_data.json`;

      // read processing_data.json file
      // dont error if processingData doesn't exist
      const processingDataExists = await fs.pathExists(processingDataPath);

      if(!processingDataExists){
        continue
      }

      let processingData, fileExistsButJsonError;
      try {
        processingData = JSON.parse(await fs.readFile(processingDataPath, 'utf8'));
      } catch (err) {

        // syntax error
        fileExistsButJsonError = err.toString().includes('SyntaxError');

        // delete the media if json error
        if(fileExistsButJsonError){
          continue
        }
      }

      if(!processingData){
        continue
      }

      const uploadDurationInSeconds = processingData.uploadDurationInSeconds;

      if(uploadDurationInSeconds){
        totalSeconds += uploadDurationInSeconds;
      }


    }
  }

  global.siteStats = {
    totalSeconds,
    amountOfTranscriptions: transcriptionsDirectoryContents.length,
    humanReadableTime: forHumans(totalSeconds),
  }

  l('siteStats');
  l(global.siteStats);
}

getTranscriptionData();

// Schedule the directory reading operation at regular intervals
setInterval(async () => {
  getTranscriptionData();
}, interval);



const makeFileNameSafe = function(string){
  return filenamify(string, {replacement: '_' })
    .replace(/[&\/\\#,+()$~%.'":*?<>{}!]/g, '')
    .replace(/\s+/g,"_")
    .split('：').join(':');
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
    nodeEnv,
    siteStats: global.siteStats,
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
    const uploadGeneratedFilename = req.file.filename;
    const shouldTranslate = req.body.shouldTranslate === 'true';

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

    const separator = '--'

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
        uploadGeneratedFilename,
        shouldTranslate,

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

    const translatedLanguages = processingData.translatedLanguages;

    // TODO: check that it doesn't include the original language? or it never will?
    const languagesToLoop = newLanguagesMap.filter(function(language){
      return translatedLanguages.includes(language.name)
    });

    l('processing data');
    l(processingData);

    l('languages to loop');
    l(languagesToLoop);

    res.render('player', {
      filePath: filePathWithoutExtension,
      languages: languagesToTranscribe,
      fileNameWithoutExtension,
      filePathWithoutExtension,
      processingData,
      title: processingData.filename,
      languagesToLoop
      // vttPath,
      // fileSource
    })
  } catch (err){
    l('err');
    l(err);
    res.send(err);
  }
});

// it's an array of file names
const getAllDirectories = async (dir) => {
  let files = await fs.promises.readdir(dir, { withFileTypes: true });

  files = files.filter(file => file.isDirectory()).map(file => {
    l('file');
    l(file);
    return file.name
  });

  return files
}

async function sortByModifiedAtTime(dir){
  // sort by modified date
  return files
    .map(async fileName => ({
      name: fileName,
      time: await fs.stat(`${dir}/${fileName}`).mtime.getTime(),
    }))
    .sort((a, b) => a.time - b.time)
    .map(file => file.name);
};

async function getMatchingFiles({ dir, files, language, keepMedia }){
  let matchedFiles = [];
  for(const file of files){
    const processingDataPath = `${dir}/${file}/processing_data.json`;
    try {
      const processingData = JSON.parse(await fs.promises.readFile (processingDataPath, 'utf8'));

      // TODO: I'm pretty sure this is a bad implementation
      const languageMatches =  language === processingData.language;
      const keepMediaMatches = keepMedia === processingData.keepMedia;

      const doesntMatchLanguage = language && !languageMatches;
      const doesntMatchKeepMedia = keepMedia && !keepMediaMatches;

      const preventBasedOnMissedMatch = doesntMatchLanguage || doesntMatchKeepMedia;

      if(preventBasedOnMissedMatch){

      } else {
        matchedFiles.push(file);
      }

      // TODO: they should
    } catch (err){
      // don't do anything
    }
  }

  return matchedFiles
}



// see files
router.get('/files', async function(req, res, next) {
  try {
    // const password = req.params.password;

    const { password, language } = req.query;

    const keepMedia = req.query.keepMedia === 'true';

    l('language');
    l(language);

    if(password !== process.env.FILES_PASSWORD){
      res.redirect('/404')
    } else {
      l('rendering here');

      const dir = './transcriptions';

      //
      let files = await getAllDirectories('./transcriptions');

      // log files length
      l('files length');
      l(files.length);

      // TODO: what other things to match against?
      files = await getMatchingFiles({ dir, files, language, keepMedia });

      // // log files length
      // l('files length');
      // l(files.length);
      //
      // files = await sortByModifiedAtTime('./transcriptions');


      // most recently effected files first (non-destructive, functional)
      // files = [].concat(files).reverse();

      // log files length
      l('files length');
      l(files.length);

      l('returning');
      l(files);

      return res.render('files', {
        // list of file names
        files
      })
    }

  } catch(err){
    l('err');
    l(err);
  }
});

module.exports = router;
