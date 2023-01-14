const url = require('url');
const path = require('path');
const ffprobe = require('ffprobe');
const moment = require('moment/moment');
const Queue = require('promise-queue');
const multer = require('multer');
const express = require('express');
const router = express.Router();
const which = require('which');
const ffprobePath = which.sync('ffprobe');
const fs = require('fs-extra');

const { downloadFile, getFilename } = require('../downloading/yt-dlp-download');
const transcribeWrapped = require('../transcribe/transcribe-wrapped');
const { targetLanguages } = require('../constants/constants');
const {getamountOfRunningJobs, sendToWebsocket, generateRandomNumber, forHumans} = require('../helpers/helpers');
const {makeFileNameSafe} = require('../lib/files');
const { addItemToQueue, getNumberOfPendingOrProcessingJobs } = require('../queue/queue');
const {addToJobProcessOrQueue} = require('../queue/newQueue');
const {getDurationByMpv, throwOffLimitsErrors, createFileNames} = require('../lib/transcribing');


const nodeEnv = process.env.NODE_ENV || 'development';
const maxConcurrentJobs = Number(process.env.CONCURRENT_AMOUNT);
const uploadLimitInMB = nodeEnv === 'production' ? Number(process.env.UPLOAD_FILE_SIZE_LIMIT_IN_MB) : 3000;

l(`CONCURRENT JOBS ALLOWED AMOUNT: ${maxConcurrentJobs}`);

const storage = multer.diskStorage({ // notice you are calling the multer.diskStorage() method here, not multer()
  destination: function (req, file, cb) {
    cb(null, './uploads/')
  },
});

let upload = multer({ storage });

router.post('/file', upload.single('file'), async function (req, res, next) {
  // l(global.ws);
  let websocketConnection;

  try {
    l(req.file);
    l(req.body);

    const referer = req.headers.referer;
    const urlObject = url.parse(referer);
    const pathname = urlObject.pathname;
    const isYtdlp = pathname === '/ytdlp';

    l({isYtdlp});

    let language = req.body.language;
    const shouldTranslate = req.body.shouldTranslate === 'true';
    const {model, websocketNumber, downloadLink, user, skipToFront, uploadTimeStarted} = req.body;

    const passedFile = req.file;
    let downloadedFile = false;
    let filename;

    const uploadTimeFinished = new Date();

    if (/\.en$/.test(model)) {
      language = 'English'
    }

    l({downloadLink});

    // websocket number is pushed when it connects on page load
    // l(global.webSocketData);
    const websocket = global.webSocketData.find(item => item.websocketNumber === websocketNumber);
    if (websocket) {
      websocketConnection = websocket.websocket;
    } else {
      throw new Error('no websocket!');
    }

    let fileNameWithExtension, uploadedFilePath, uploadGeneratedFilename;
    
    if (passedFile) {
      fileNameWithExtension = passedFile.originalname;
      uploadedFilePath = passedFile.path;
      uploadGeneratedFilename = passedFile.filename;
      l({uploadedFilePath});
    } else if (downloadLink) {
      sendToWebsocket(websocketConnection, {
        message: 'downloadInfo',
        fileName: downloadLink,
        percentDownloaded: 0,
      });

      const randomNumber = generateRandomNumber();

      filename =  await getFilename(downloadLink);
      // remove linebreaks, this was causing bugs
      filename = filename.replace(/\r?\n|\r/g, '');
      l({filename});
      uploadGeneratedFilename = filename;
      fileNameWithExtension = filename;
      const {name: baseName, ext: extension} = path.parse(filename);
      uploadedFilePath = `uploads/${randomNumber}${extension}`;

      res.send('download');

      // TODO: pass websocket connection and output download progress to frontend
      await downloadFile({
        videoUrl: downloadLink,
        filepath: uploadedFilePath,
        randomNumber,
        websocketConnection,
        filename,
        websocketNumber,
      });
      downloadedFile = true;

      uploadGeneratedFilename = baseName;

    } else {
      throw new Error('No file or download link provided');
      // ERROR
    }

    const {
      fileNameNoExtension,
      fileExtension,
      safeDirNameNoExtension,
      safeFileNameWithExtension,
      safeFileNameWithDateTimestamp,
      safeFileNameWithDateTimestampAndExtension,
    } = createFileNames(fileNameWithExtension);

    l({uploadedFilePath});

    // get upload duration
    const ffprobeResponse = await ffprobe(uploadedFilePath, { path: ffprobePath });

    const audioStream = ffprobeResponse.streams.filter(stream => stream.codec_type === 'audio')[0];
    const uploadDurationInSeconds = Math.round(audioStream.duration || await getDurationByMpv(uploadedFilePath));


    const stats = await fs.promises.stat(uploadedFilePath);
    const fileSizeInBytes = stats.size;
    const fileSizeInMB = Number(fileSizeInBytes / 1048576).toFixed(1);

    // error if on FS and over file size limit or duration limit
    const isFreeSubtitles = req.hostname === 'freesubtitles.ai';
    if (isFreeSubtitles && !isYtdlp) {
      throwOffLimitsErrors(res, uploadDurationInSeconds, fileSizeInMB);
    }

    // TODO: pull into its own function
    /** WEBSOCKET FUNCTIONALITY **/
    // load websocket by passed number

    const currentlyRunningJobs = getamountOfRunningJobs();
    const amountInQueue = global.newQueue.length
    const totalOutstanding = currentlyRunningJobs + amountInQueue - maxConcurrentJobs + 1;

    l({totalOutstanding});

    /** WEBSOCKET FUNCTIONALITY END **/

    // pass ip to queue
    const ip = req.headers['x-forwarded-for'] ||
      req.socket.remoteAddress ||
      null;

    // allow admin to see items in the queue
    addItemToQueue({
      model,
      language,
      filename: fileNameWithExtension,
      ip,
      uploadDurationInSeconds,
      shouldTranslate,
      fileSizeInMB,
      startedAt: new Date(),
      status: 'pending',
      websocketNumber,
      ...(user && { user }),
      ...(downloadLink && { downloadLink }),
      ...(skipToFront && { skipToFront }),
      totalOutstanding,
    })

    const transcriptionJobItem = {
      uploadedFilePath,
      language,
      model,
      fileNameWithExtension,
      fileNameNoExtension,
      fileExtension,
      safeDirNameNoExtension,
      safeFileNameWithExtension,
      safeFileNameWithDateTimestamp,
      safeFileNameWithDateTimestampAndExtension,
      uploadGeneratedFilename,
      shouldTranslate,
      uploadDurationInSeconds,
      uploadDuration: forHumans(uploadDurationInSeconds),
      fileSizeInMB,
      ...(user && { user }),
      ...(downloadLink && { downloadLink }),
      skipToFront: skipToFront === 'true',
      totalOutstanding,
      ip,

      // websocket/queue
      websocketConnection,
      websocketNumber,
      targetLanguages,
    }

    // l('transcriptionJobItem');
    // l(transcriptionJobItem);
    addToJobProcessOrQueue(transcriptionJobItem);

    const obj = JSON.parse(JSON.stringify(req.body));
    l(obj);

    // l(req.files);

    // assuming already sent from above
    if (!downloadedFile) {
      res.send('ok');
    }
    // req.files is array of uploaded files
    // req.body will contain the text fields, if there were any
  } catch (err) {
    l('err from transcribe route')
    l(err);

    // websocketConnection.terminate()
    // throw (err);
  }
});

router.get('/checkingOutstandingProcesses', async function (req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

  const outstandingJobsAmount = getNumberOfPendingOrProcessingJobs(ip);

  l('outstandingJobsAmount');
  l(outstandingJobsAmount);

  if (outstandingJobsAmount >= 3) {
    res.send('tooMany');
  } else {
    res.send('ok');
  }

  try {

  } catch (err) {
    l('err from transcribe route')
    l(err);

    // websocketConnection.terminate()
    // throw (err);
  }
});

module.exports = router;
