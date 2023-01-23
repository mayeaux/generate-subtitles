const url = require('url');
const path = require('path');
const ffprobe = require('ffprobe');
const moment = require('moment/moment');
const Queue = require('promise-queue');
const multer = require('multer');
const express = require('express');
const router = express.Router();
const which = require('which');
const ffprobePath = which.sync('ffprobe')
const fs = require('fs-extra');

const { downloadFile, getFilename } = require('../downloading/yt-dlp-download');
const transcribeWrapped = require('../transcribe/transcribe-wrapped');
const { languagesToTranslateTo } = require('../constants/constants');
const {forHumansNoSeconds} = require('../helpers/helpers');
const {makeFileNameSafe} = require('../lib/files');
const { addItemToQueue, getNumberOfPendingOrProcessingJobs } = require('../queue/queue');
const { addToJobProcessOrQueue, amountOfRunningJobs } = require('../queue/newQueue');


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

    l('isYtdlp');
    l(isYtdlp);

    let language = req.body.language;
    let model = req.body.model;
    const websocketNumber = req.body.websocketNumber;
    const shouldTranslate = req.body.shouldTranslate === 'true';
    const downloadLink = req.body.downloadLink;
    const { user, skipToFront, uploadTimeStarted } = req.body

    const passedFile = req.file;
    let downloadedFile = false;

    const uploadTimeFinished = new Date();

    // this shouldn't happen but there's some sort of frontend bug
    if (!language || language === 'undefined' || language === 'Auto-Detect') {
      language = 'auto-detect';
    }

    // make the model medium by default
    if (!model) {
      model = 'medium';
    }

    if (model === 'tiny.en' || model === 'base.en' || model === 'small.en' || model === 'medium.en') {
      language = 'English'
    }

    let filename;

    l(downloadLink);

    function matchByWebsocketNumber (item) {
      return item.websocketNumber === websocketNumber;
    }

    // websocket number is pushed when it connects on page load
    // l(global.webSocketData);
    const websocket = global.webSocketData.find(matchByWebsocketNumber)
    if (websocket) {
      websocketConnection = websocket.websocket;
    } else {
      throw new Error('no websocket!');
    }

    let originalFileNameWithExtension, uploadedFilePath, uploadGeneratedFilename;
    if (passedFile) {

      originalFileNameWithExtension = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
      uploadedFilePath = req.file.path;
      uploadGeneratedFilename = req.file.filename;
      l('uploadedFilePath');
      l(uploadedFilePath);
    } else if (downloadLink) {

      websocketConnection.send(JSON.stringify({
        message: 'downloadInfo',
        fileName: downloadLink,
        percentDownloaded: 0,
      }), function () {});

      // TODO: not the world's greatest implemention
      function generateRandomNumber () {
        return Math.floor(Math.random() * 10000000000).toString();
      }

      const randomNumber = generateRandomNumber();

      filename =  await getFilename(downloadLink);
      // remove linebreaks, this was causing bugs
      filename = filename.replace(/\r?\n|\r/g, '');
      l('filename');
      l(filename);
      uploadGeneratedFilename = filename;
      originalFileNameWithExtension = filename;
      const baseName = path.parse(filename).name;
      const extension = path.parse(filename).ext;
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

    l('uploadedFilePath');
    l(uploadedFilePath);

    // get upload duration
    const ffprobeResponse = await ffprobe(uploadedFilePath, { path: ffprobePath });

    const audioStream = ffprobeResponse.streams.filter(stream => stream.codec_type === 'audio')[0];
    const uploadDurationInSeconds = Math.round(audioStream.duration);

    const stats = await fs.promises.stat(uploadedFilePath);
    const fileSizeInBytes = stats.size;
    const fileSizeInMB = Number(fileSizeInBytes / 1048576).toFixed(1);

    // TODO: pull out into a function
    // error if on FS and over file size limit or duration limit
    const domainName = req.hostname;

    const isFreeSubtitles = domainName === 'freesubtitles.ai';
    if (isFreeSubtitles && !isYtdlp) {

      const amountOfSecondsInHour = 60 * 60;
      if (uploadDurationInSeconds > amountOfSecondsInHour) {
        const uploadLengthErrorMessage = `Your upload length is ${forHumansNoSeconds(uploadDurationInSeconds)}, but currently the maximum length allowed is only 1 hour`;
        return res.status(400).send(uploadLengthErrorMessage);
      }
      if (fileSizeInMB > uploadLimitInMB) {
        const uploadSizeErrorMessage = `Your upload size is ${fileSizeInMB} MB, but the maximum size currently allowed is ${uploadLimitInMB} MB.`;
        return res.status(400).send(uploadSizeErrorMessage);
      }
    }

    // TODO: pull into its own function
    /** WEBSOCKET FUNCTIONALITY **/
    // load websocket by passed number


    const currentlyRunningJobs = amountOfRunningJobs();
    const amountInQueue = global.newQueue.length
    const totalOutstanding = currentlyRunningJobs + amountInQueue - maxConcurrentJobs + 1;

    l('totaloutstanding');
    l(totalOutstanding);

    /** WEBSOCKET FUNCTIONALITY END **/

    const originalFileExtension = path.parse(originalFileNameWithExtension).ext;
    const originalFileNameWithoutExtension = path.parse(originalFileNameWithExtension).name;

    // directory name
    const directorySafeFileNameWithoutExtension = makeFileNameSafe(originalFileNameWithoutExtension)

    // used for the final media resting place
    const directorySafeFileNameWithExtension = `${directorySafeFileNameWithoutExtension}${originalFileExtension}`

    const timestampString = moment(new Date()).format('DD-MMMM-YYYY_HH_mm_ss');

    const separator = '--'

    const fileSafeNameWithDateTimestamp = `${directorySafeFileNameWithoutExtension}${separator}${timestampString}`;

    const fileSafeNameWithDateTimestampAndExtension = `${directorySafeFileNameWithoutExtension}${separator}${timestampString}${originalFileExtension}`;

    // pass ip to queue
    const ip = req.headers['x-forwarded-for'] ||
      req.socket.remoteAddress ||
      null;

    // allow admin to see items in the queue
    addItemToQueue({
      model,
      language,
      filename: originalFileNameWithExtension,
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
      directorySafeFileNameWithoutExtension,
      directorySafeFileNameWithExtension,
      originalFileNameWithExtension,
      fileSafeNameWithDateTimestamp,
      fileSafeNameWithDateTimestampAndExtension,
      uploadGeneratedFilename,
      shouldTranslate,
      uploadDurationInSeconds,
      fileSizeInMB,
      ...(user && { user }),
      ...(downloadLink && { downloadLink }),
      skipToFront: skipToFront === 'true',
      totalOutstanding,
      ip,

      // websocket/queue
      websocketConnection,
      websocketNumber,
      languagesToTranslateTo,
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
