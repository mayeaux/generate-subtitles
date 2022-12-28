const url = require('url');
const path = require("path");
const ffprobe = require("ffprobe");
const moment = require("moment/moment");
const Queue = require("promise-queue");
const multer = require("multer");
var express = require('express');
var router = express.Router();
const which = require('which');
const ffprobePath = which.sync('ffprobe')

const { downloadFile, getFilename } = require("../downloading/yt-dlp-download");
const transcribeWrapped = require("../transcribe/transcribe-wrapped");
const { languagesToTranslateTo } = require("../constants/constants");
const {forHumansNoSeconds} = require("../helpers/helpers");
const {makeFileNameSafe} = require("../lib/files");

const nodeEnv = process.env.NODE_ENV || 'development';
const concurrentJobs = process.NODE_ENV === 'development' ? 1 : process.env.CONCURRENT_AMOUNT;
const uploadLimitInMB = nodeEnv === 'production' ? process.env.UPLOAD_FILE_SIZE_LIMIT_IN_MB : 3000;

l(`CONCURRENT JOBS ALLOWED AMOUNT: ${concurrentJobs}`);

// todo: on dif node-env change it to 2
var maxConcurrent = ( concurrentJobs && Number(concurrentJobs) ) || 1;
var maxQueue = Infinity;
var queue = new Queue(maxConcurrent, maxQueue);

// l(queue);

const storage = multer.diskStorage({ // notice you are calling the multer.diskStorage() method here, not multer()
  destination: function(req, file, cb) {
    cb(null, './uploads/')
  },
});

var upload = multer({ storage });

router.post('/file', upload.single('file'), async function (req, res, next) {
  // l(global.ws);

  try {
    l(req.file);
    l(req.body);

    const referer = req.headers.referer;
    const urlObject = url.parse(referer);
    const pathname = urlObject.pathname;
    const isYtdlp = pathname === '/ytdlp';

    l('isYtdlp');
    l(isYtdlp);

    const language = req.body.language;
    let model = req.body.model;
    const websocketNumber = req.body.websocketNumber;
    const shouldTranslate = req.body.shouldTranslate === 'true';
    const downloadLink = req.body.downloadLink;
    const passedFile = req.file;
    let downloadedFile = false;

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
      downloadedFile = true;

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
    if(isFreeSubtitles && !isYtdlp){
      const fileSizeInMB = Math.round(req.file.size / 1048576);

      if(uploadDurationInSeconds > amountOfSecondsInHour){
        const uploadLengthErrorMessage = `Your upload length is ${forHumansNoSeconds(uploadDurationInSeconds)}, but currently the maximum length allowed is only 1 hour`;
        return res.status(400).send(uploadLengthErrorMessage);
      }
      if(fileSizeInMB > uploadLimitInMB){
        const uploadSizeErrorMessage = `Your upload size is ${fileSizeInMB} MB, but the maximum size currently allowed is ${uploadLimitInMB} MB.`;
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

    // assuming already sent from above
    if(!downloadedFile){
      res.send('ok');
    }
    // req.files is array of uploaded files
    // req.body will contain the text fields, if there were any
  } catch (err){
    l('err')
    l(err);
    throw(err);
  }
});

module.exports = router;
