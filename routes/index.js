var express = require('express');
const _ = require('lodash');

const { global } = require('../lib/stats');
const fileRouter = require('./files');
const playerRouter = require('./player');
const transcribeRouter = require('./transcribe');
const { forHumans } = require('../helpers/helpers');
const {
  modelsArray,
  whisperLanguagesHumanReadableArray,
} = require('../constants/constants');

var router = express.Router();
const uploadPath = process.env.UPLOAD_PATH || 'localhost:3000';
const nodeEnv = process.env.NODE_ENV || 'development';

//file router
router.use(fileRouter);
//player router
router.use(playerRouter);
//transcribe router
router.use(transcribeRouter);

l('nodeEnv');
l(nodeEnv);

let uploadFileSizeLimitInMB = 3000;
if (nodeEnv === 'production') {
  uploadFileSizeLimitInMB = process.env.UPLOAD_FILE_SIZE_LIMIT_IN_MB;
}
l('uploadFileSizeLimitInMB');
l(uploadFileSizeLimitInMB);

// home page
router.get('/', function (req, res, next) {
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

global.queueData = [];

l(process.cwd());

module.exports = router;
