const express = require('express');
const ffprobe = require('ffprobe');
const which = require('which');
const path = require('path');
const Queue = require('promise-queue');
const moment = require('moment');
const ffprobePath = which.sync('ffprobe');
const transcribeWrapped = require('../transcribe/transcribe-wrapped');
const constants = require('../constants/constants');

const { languagesToTranslateTo } = constants;


const router = express.Router();
const { makeFileNameSafe, decode_utf8, upload } = require('../lib/files');

let concurrentJobs = process.env.CONCURRENT_AMOUNT;
if (process.NODE_ENV === 'development') {
  concurrentJobs = 1;
}

// todo: on dif node-env change it to 2
var maxConcurrent = (concurrentJobs && Number(concurrentJobs)) || 1;
var maxQueue = Infinity;
var queue = new Queue(maxConcurrent, maxQueue);

l(queue);

l(`CONCURRENT JOBS ALLOWED AMOUNT: ${concurrentJobs} `);

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

    const ffprobeResponse = await ffprobe(uploadedFilePath, {
      path: ffprobePath,
    });

    const audioStream = ffprobeResponse.streams.filter(
      (stream) => stream.codec_type === 'audio'
    )[0];
    const uploadDurationInSeconds = Math.round(audioStream.duration);

    const amountOfSecondsInHour = 60 * 60;
    const domainName = req.hostname;

    const fileSizeInMB = Math.round(req.file.size / 1048576);

    const isFreeSubtitles = domainName === 'freesubtitles.ai';
    if (isFreeSubtitles) {
      if (uploadDurationInSeconds > amountOfSecondsInHour) {
        const uploadLengthErrorMessage = `Your upload length is ${forHumansNoSeconds(
          uploadDurationInSeconds
        )}, but currently the maximum length allowed is only 1 hour`;
        return res.status(400).send(uploadLengthErrorMessage);
      }
      if (fileSizeInMB > uploadFileSizeLimitInMB) {
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

    const originalFileNameWithoutExtension = path.parse(
      originalFileNameWithExtension
    ).name;
    // l('originalFileNameWithoutExtension')
    // l(originalFileNameWithoutExtension)

    // something
    const directorySafeFileNameWithoutExtension = makeFileNameSafe(
      originalFileNameWithoutExtension
    );

    // l('directorySafeFileNameWithoutExtension')
    // l(directorySafeFileNameWithoutExtension)

    // something.mp4
    const directorySafeFileNameWithExtension = `${directorySafeFileNameWithoutExtension}${originalFileExtension}`;

    if (!uploadedFilePath) {
      res.status(500);
      res.send('no file');
    }

    // load websocket by passed number
    let websocketConnection;
    if (global.webSocketData) {
      // l(global.webSocketData);
      const websocket = global.webSocketData.find(function (websocket) {
        return websocketNumber === websocket.websocketNumber;
      });
      if (websocket) {
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
    global.queue = {};

    const amountOfCurrentPending = queue.getPendingLength();

    const amountinQueue = queue.getQueueLength();

    const totalOutstanding = amountOfCurrentPending + amountinQueue;

    l('totaloutstanding');
    l(totalOutstanding);

    // give frontend their queue position
    if (amountOfCurrentPending > 0) {
      websocketConnection.send(
        JSON.stringify({
          message: 'queue',
          placeInQueue: totalOutstanding,
        }),
        function () {}
      );
    }

    global.queueData.push(websocketNumber);

    // l('queue data');
    // l(global.queueData);

    // make the model medium by default
    if (!model) {
      model = 'medium';
    }

    const timestampString = moment(new Date()).format('DD-MMMM-YYYY_HH_mm_ss');

    const separator = '--';

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
        languagesToTranslateTo,
      });
    });

    const obj = JSON.parse(JSON.stringify(req.body));
    l(obj);

    // l(req.files);
    // l(req.body);
    res.send('ok');
    // req.files is array of uploaded files
    // req.body will contain the text fields, if there were any
  } catch (err) {
    l('err');
    l(err);
    throw err;
  }
});

module.exports = router;
