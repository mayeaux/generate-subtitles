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
const { forHumans, forHumansNoSeconds } = require('../helpers')
const path = require('path');
const moment = require('moment');
const ffprobe = require("ffprobe");
const which = require("which");
const {fr} = require("language-name-map/map");
const { languagesToTranslateTo, newLanguagesMap } = constants;
const ffprobePath = which.sync('ffprobe')

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
    humanReadableTime: forHumansNoSeconds(totalSeconds),
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

const uploadFileSizeLimitInMB = Number(process.env.UPLOAD_FILE_SIZE_LIMIT_IN_MB) || 100;
l('uploadFileSizeLimitInMB');
l(uploadFileSizeLimitInMB);

// home page
router.get('/', function(req, res, next) {
  const domainName = req.hostname;

  const isFreeSubtitles = domainName === 'freesubtitles.ai';

  // transcribe frontend page
  res.render('index', {
    title: 'Transcribe File',
    uploadPath,
    forHumans,
    nodeEnv,
    siteStats: global.siteStats,
    isFreeSubtitles,
    uploadFileSizeLimitInMB,
  });
});

global.queueData = [];

router.post('/file', upload.single('file'), async function (req, res, next) {
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

    const ffprobeResponse = await ffprobe(uploadedFilePath, { path: ffprobePath });

    const audioStream = ffprobeResponse.streams.filter(stream => stream.codec_type === 'audio')[0];
    const uploadDurationInSeconds = Math.round(audioStream.duration);

    const amountOfSecondsInHour = 60 * 60;
    const domainName = req.hostname;

    const fileSizeInMB = Math.round(req.file.size / 1048576);

    const isFreeSubtitles = domainName === 'freesubtitles.ai';
    if(isFreeSubtitles){
      if(uploadDurationInSeconds > amountOfSecondsInHour){
        const uploadLengthErrorMessage = `Your upload length is ${forHumansNoSeconds(uploadDurationInSeconds)}, but currently the maximum length allowed is only 1 hour`;
        return res.status(400).send(uploadLengthErrorMessage);
      }
      if(fileSizeInMB > uploadFileSizeLimitInMB){
        const uploadSizeErrorMessage = `Your upload size is ${fileSizeInMB} MB, but the maximum size currently allowed is ${uploadFileSizeLimitInMB} MB.`;
        return res.status(400).send(uploadSizeErrorMessage);
      }
    }


    // TODO: check file duration here

    let logFileNames = true;
    // something.mp4
    let originalFileNameWithExtension = decode_utf8(req.file.originalname);

    // .mp4 (includes leading period)
    const originalFileExtension = path.parse(originalFileNameWithExtension).ext;

    const originalFileNameWithoutExtension = path.parse(originalFileNameWithExtension).name;
    // l('originalFileNameWithoutExtension')
    // l(originalFileNameWithoutExtension)

    // something
    const directorySafeFileNameWithoutExtension = makeFileNameSafe(originalFileNameWithoutExtension)

    // l('directorySafeFileNameWithoutExtension')
    // l(directorySafeFileNameWithoutExtension)


    // something.mp4
    const directorySafeFileNameWithExtension = `${directorySafeFileNameWithoutExtension}${originalFileExtension}`

    if(!uploadedFilePath){ res.status(500); res.send('no file')}

    // load websocket by passed number
    let websocketConnection;
    if(global.webSocketData){
      // l(global.webSocketData);
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

    // l(queue);
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

    // l('queue data');
    // l(global.queueData);

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
        uploadDurationInSeconds,

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
      languagesToLoop,
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

  let newFiles = [];

  for (let file of files) {
    // l('file');
    // l(file);
    // l(file.name);
    // l(file.isDirectory());
    if(!file.isDirectory()) continue;

    let processingData;
    try {
      processingData = JSON.parse(await fs.readFile(`${dir}/${file.name}/processing_data.json`, 'utf8'));
    } catch (err){
      // l('err');
      // l(err);
      processingData = null;
    }
    //
    // l('processing data');
    // l(processingData);

    if(processingData && processingData.startedAt && processingData.uploadDurationInSeconds){
      newFiles.push({
        name: file.name,
        processingData,
        formattedDate: moment(processingData.startedAt).format("D MMM YYYY"),
        timestamp: processingData.startedAt && new Date(processingData.startedAt).getTime()
      });
    }
  }

  return newFiles
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

async function getMatchingFiles({ files, language, keepMedia }){
  let matchedFiles = [];
  for(const file of files){
    try {
      const languageMatches =  language === file.processingData.language;
      const keepMediaMatches = keepMedia === file.processingData.keepMedia;

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
    const { password, language } = req.query;

    const keepMedia = req.query.keepMedia === 'true';

    if(password !== process.env.FILES_PASSWORD){
      res.redirect('/404')
    } else {
      const dir = './transcriptions';

      //
      let files = await getAllDirectories('./transcriptions');

      // log files length
      l('files length');
      l(files.length);
      // l(files);

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
      // l('files length');
      // l(files.length);
      //
      // l('returning');
      // l(files);

      return res.render('files', {
        // list of file names
        files,
        title: 'Files',
      })
    }

  } catch(err){
    l('err');
    l(err);
  }
});

module.exports = router;
