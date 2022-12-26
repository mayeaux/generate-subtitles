var express = require('express');
const axios = require("axios");
const multer = require("multer");
var router = express.Router();
const FormData = require('form-data');
const fs = require('fs-extra');
const downloadAndTranscribe = require('../downloading/download.js')
// const transcribe = require('../transcribe');
const transcribeWrapped = require('../transcribe/transcribe-wrapped');
const Queue = require("promise-queue");
const {languagesToTranscribe} = require("../constants/constants");
const filenamify = require("filenamify");
const { forHumans, forHumansNoSeconds } = require('../helpers/helpers')
const path = require('path');
const moment = require('moment');
const ffprobe = require("ffprobe");
const which = require("which");
const {fr} = require("language-name-map/map");
const { languagesToTranslateTo, newLanguagesMap, modelsArray, whisperLanguagesHumanReadableArray } = require('../constants/constants');
const ffprobePath = which.sync('ffprobe')
const _ = require('lodash');
const { downloadFile, getFilename } = require('../downloading/yt-dlp-download.js');

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
  await fs.mkdirp(transcriptionsDirectory);

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

let uploadFileSizeLimitInMB = 3000;
if(nodeEnv === 'production'){
  uploadFileSizeLimitInMB = process.env.UPLOAD_FILE_SIZE_LIMIT_IN_MB;
}
l('uploadFileSizeLimitInMB');
l(uploadFileSizeLimitInMB);

// home page
router.get('/', function(req, res, next) {
  const domainName = req.hostname;

  const isFreeSubtitles = domainName === 'freesubtitles.ai';

  function decrementBySecond(timeRemainingValues) {
    let { secondsRemaining, minutesRemaining, hoursRemaining } = timeRemainingValues;

    if(secondsRemaining === 0 || secondsRemaining === '00'){
      if(minutesRemaining > 0){
        secondsRemaining = 59;
        minutesRemaining = minutesRemaining - 1;
      }
    } else {
      secondsRemaining = secondsRemaining - 1;
    }

    if (minutesRemaining === 0 || minutesRemaining === '00') {
      if(hoursRemaining > 0){
        minutesRemaining = 59;
        hoursRemaining = hoursRemaining - 1;
      }
    }

    if (minutesRemaining.toString()?.length === 1) {
      minutesRemaining = '0' + minutesRemaining;
    }

    if (secondsRemaining.toString()?.length === 1) {
      secondsRemaining = '0' + secondsRemaining;
    }


    let thingString = `${minutesRemaining}:${secondsRemaining}`;
    if(hoursRemaining){ thingString = `${hoursRemaining}:${thingString}` }

    return {
      secondsRemaining,
      minutesRemaining,
      hoursRemaining,
      string: thingString
    }
  }

  // transcribe frontend page
  res.render('index', {
    title: 'Transcribe File',
    uploadPath,
    forHumans,
    nodeEnv,
    siteStats: global.siteStats,
    isFreeSubtitles,
    uploadFileSizeLimitInMB,
    modelsArray,
    languages: whisperLanguagesHumanReadableArray,
    decrementBySecond
  });
});

// home page
router.get('/ytdlp', function(req, res, next) {
  const domainName = req.hostname;

  const isFreeSubtitles = domainName === 'freesubtitles.ai';

  function decrementBySecond(timeRemainingValues) {
    let { secondsRemaining, minutesRemaining, hoursRemaining } = timeRemainingValues;

    if(secondsRemaining === 0 || secondsRemaining === '00'){
      if(minutesRemaining > 0){
        secondsRemaining = 59;
        minutesRemaining = minutesRemaining - 1;
      }
    } else {
      secondsRemaining = secondsRemaining - 1;
    }

    if (minutesRemaining === 0 || minutesRemaining === '00') {
      if(hoursRemaining > 0){
        minutesRemaining = 59;
        hoursRemaining = hoursRemaining - 1;
      }
    }

    if (minutesRemaining.toString()?.length === 1) {
      minutesRemaining = '0' + minutesRemaining;
    }

    if (secondsRemaining.toString()?.length === 1) {
      secondsRemaining = '0' + secondsRemaining;
    }


    let thingString = `${minutesRemaining}:${secondsRemaining}`;
    if(hoursRemaining){ thingString = `${hoursRemaining}:${thingString}` }

    return {
      secondsRemaining,
      minutesRemaining,
      hoursRemaining,
      string: thingString
    }
  }

  // transcribe frontend page
  res.render('index', {
    title: 'Transcribe File',
    uploadPath,
    forHumans,
    nodeEnv,
    siteStats: global.siteStats,
    isFreeSubtitles,
    uploadFileSizeLimitInMB,
    modelsArray,
    languages: whisperLanguagesHumanReadableArray,
    decrementBySecond,
    ytdlp: true
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
    const shouldTranslate = req.body.shouldTranslate === 'true';
    const downloadLink = req.body.downloadLink;
    const passedFile = req.file;

    let filename;

    l(downloadLink);

    let originalFileNameWithExtension, uploadedFilePath, uploadGeneratedFilename;
    if(passedFile){
      originalFileNameWithExtension = req.file.originalname;
      uploadedFilePath = req.file.path;
      uploadGeneratedFilename = req.file.filename;
      l('uploadedFilePath');
      l(uploadedFilePath);
    } else if (downloadLink){
      function generateRandomNumber() {
        return Math.floor(Math.random() * 10000000000).toString();
      }

      const randomNumber = generateRandomNumber();

      filename =  await getFilename(downloadLink);
      filename = filename.replace(/\r?\n|\r/g, '');
      l('filename');
      l(filename);
      uploadGeneratedFilename = filename;
      originalFileNameWithExtension = filename;
      const baseName = path.parse(filename).name;
      const extension = path.parse(filename).ext;
      uploadedFilePath = `uploads/${randomNumber}${extension}`;


      await downloadFile({ videoUrl: downloadLink, filepath: uploadedFilePath, randomNumber });

      uploadGeneratedFilename = baseName;

    } else {
      throw new Error('No file or download link provided');
      // ERROR
    }

    l('uploadedFilePath');
    l(uploadedFilePath);

    const ffprobeResponse = await ffprobe(uploadedFilePath, { path: ffprobePath });

    const audioStream = ffprobeResponse.streams.filter(stream => stream.codec_type === 'audio')[0];
    const uploadDurationInSeconds = Math.round(audioStream.duration);

    const amountOfSecondsInHour = 60 * 60;
    const domainName = req.hostname;

    const isFreeSubtitles = domainName === 'freesubtitles.ai';
    if(isFreeSubtitles){
      const fileSizeInMB = Math.round(req.file.size / 1048576);

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

    const containingFolder = `${processDirectory}/transcriptions/${fileNameWithoutExtension}`

    const processingDataPath = `${containingFolder}/processing_data.json`;

    const processingData = JSON.parse(await fs.readFile(processingDataPath, 'utf8'));


    const filePathWithoutExtension = `/transcriptions/${fileNameWithoutExtension}/${processingData.directoryFileName}`;

    l('filePathWithoutExtension')
    l(filePathWithoutExtension);

    const translatedLanguages = processingData.translatedLanguages;

    // TODO: check that it doesn't include the original language? or it never will?
    const languagesToLoop = newLanguagesMap.filter(function(language){
      return translatedLanguages.includes(language.name)
    });

    l('processing data');
    l(processingData);

    l('languages to loop');
    l(languagesToLoop);

    let allLanguages = languagesToLoop.slice();

    allLanguages.push({
      name: processingData.language,
      languageCode: processingData.languageCode
    })

    l('all languages');
    l(allLanguages);

    res.render('player/player', {
      filePath: filePathWithoutExtension,
      languages: languagesToTranscribe,
      fileNameWithoutExtension,
      filePathWithoutExtension,
      processingData,
      title: processingData.filename,
      languagesToLoop,
      allLanguages,
      renderedFilename: req.params.filename
      // vttPath,
      // fileSource
    })
  } catch (err){
    l('err');
    l(err);
    res.send(err);
  }
});

const { stripOutTextAndTimestamps, reformatVtt } = require ('../translate/helpers')

/** PLYR PLAYER **/
router.get("/player/:filename/add" , async function(req, res, next){
  try {

    const fileNameWithoutExtension = req.params.filename

    const processDirectory = process.cwd();

    const containingFolder = `${processDirectory}/transcriptions/${fileNameWithoutExtension}`

    const processingDataPath = `${containingFolder}/processing_data.json`;

    const processingData = JSON.parse(await fs.readFile(processingDataPath, 'utf8'));

    const originalVtt = await fs.readFile(`${containingFolder}/${processingData.directoryFileName}.vtt`, 'utf8');

    res.render('addTranslation/addTranslation', {
      title: 'Add Translation',
      renderedFilename: fileNameWithoutExtension,
      originalVtt
      // vttPath,
      // fileSource
    })
  } catch (err){
    l('err');
    l(err);
    res.send(err);
  }
});

const { Readable } = require('stream');


/** PLYR PLAYER **/
router.post("/player/:filename/add" , async function(req, res, next){
  try {

    const { language } = req.body;

    const fileNameWithoutExtension = req.params.filename

    const newVtt = req.body.message;

    const processDirectory = process.cwd();

    const containingFolder = `${processDirectory}/transcriptions/${fileNameWithoutExtension}`

    const processingDataPath = `${containingFolder}/processing_data.json`;

    const processingData = JSON.parse(await fs.readFile(processingDataPath, 'utf8'));

    const originalVttPath = `${containingFolder}/${processingData.directoryFileName}.vtt`;

    const originalVtt = await fs.readFile(`${containingFolder}/${processingData.directoryFileName}.vtt`, 'utf8');

    const inputStream = new Readable(newVtt);

    inputStream.push(newVtt);

    inputStream.push(null);

    l(inputStream)

    const { strippedText } = await stripOutTextAndTimestamps(inputStream, true);

    l('stripped text');
    l(strippedText);

    const { timestampsArray } = await stripOutTextAndTimestamps(originalVttPath);

    l('timestamps array');
    l(timestampsArray);

    const reformatted = reformatVtt(timestampsArray, strippedText);

    l(reformatted);
    l('refomatted');

    const newVttPath = `${containingFolder}/${processingData.directoryFileName}_${language}.vtt`;

    const originalFileVtt = `${containingFolder}/${processingData.directoryFileName}_${processingData.language}.vtt`;

    await fs.writeFile(newVttPath, reformatted, 'utf-8');

    processingData.translatedLanguages.push(language);

    processingData.keepMedia = true;

    await fs.writeFile(processingDataPath, JSON.stringify(processingData), 'utf-8');

    await fs.writeFile(originalFileVtt, originalVtt, 'utf-8');

    return res.redirect(`/player/${req.params.filename}`)

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
  // TODO: ugly design but can't think of a better approach atm
  let keepMediaMatch;
  if(keepMedia === false){
    keepMediaMatch = undefined;
  } else {
    keepMediaMatch = keepMedia;
  }

  files = files.filter((file) => {
    return language === file.processingData.language &&
    keepMediaMatch === file.processingData.keepMedia
  })

  return files
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

      files = _.orderBy(files, (file) => new Date(file.processingData.finishedAT), 'desc');

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

// see files
router.get('/learnserbian', async function(req, res, next) {
  try {

    const dir = './transcriptions';
    //
    let files = await getAllDirectories('./transcriptions');

    const language = 'Serbian';
    const keepMedia = true;

    // TODO: what other things to match against?
    files = await getMatchingFiles({ dir, files, language, keepMedia });

    l('files length');
    l(files.length);
    l(files);

    files = files.filter(function(file){
      return file.processingData.translatedLanguages.length;
    });

    // TODO: finishedAT is misspelled
    files = _.orderBy(files, (file) => new Date(file.processingData.finishedAT), 'desc');

    return res.render('files', {
      // list of file names
      files,
      title: 'Files',
    })

  } catch(err){
    l('err');
    l(err);
  }
});

module.exports = router;
