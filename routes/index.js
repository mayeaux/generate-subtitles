const express = require('express');
const router = express.Router();
const {forHumans, decrementBySecond} = require('../helpers/helpers')
const { modelsArray, languagesArray } = require('../constants/constants');
const fs = require('fs-extra')

const l = console.log;

const uploadPath =  process.env.UPLOAD_PATH || 'localhost:3000';

const nodeEnv = process.env.NODE_ENV || 'development';
l({nodeEnv});

const uploadLimitInMB = nodeEnv === 'production' ? process.env.UPLOAD_FILE_SIZE_LIMIT_IN_MB : 3000;
l({uploadLimitInMB});

// home page
router.get('/', function (req, res, next) {
  const isFreeSubtitles = req.hostname === 'freesubtitles.ai';

  // transcribe frontend page
  res.render('index/index', {
    title: 'Transcribe File',
    uploadPath,
    forHumans,
    nodeEnv,
    siteStats: global.siteStats,
    isFreeSubtitles,
    uploadLimitInMB,
    modelsArray,
    languagesArray,
    decrementBySecond
  });
});

// home page
router.get('/ytdlp', async function (req, res, next) {

  const { password, user, skip } = req.query;

  const usersString = await fs.readFile(`${process.cwd()}/constants/ytdlpUsers.txt`, 'utf8');
  const users = usersString.split(',');
  const userAuthed = users.includes(user);

  const passwordAuthed = password === process.env.FILES_PASSWORD

  const authedByPasswordOrUser = userAuthed || passwordAuthed;

  if (nodeEnv === 'production' && !authedByPasswordOrUser) {
    return res.redirect('/404')
  }

  const domainName = req.hostname;

  const isFreeSubtitles = domainName === 'freesubtitles.ai';

  // transcribe frontend page
  res.render('index/index', {
    title: 'Transcribe File',
    uploadPath,
    forHumans,
    nodeEnv,
    siteStats: global.siteStats,
    isFreeSubtitles,
    uploadLimitInMB,
    modelsArray,
    languagesArray,
    decrementBySecond,
    ytdlp: true,
    user,
    skipToFront: skip
  });
});

router.get('/queue', function (req, res, next) {

  const { password } = req.query;

  if (nodeEnv === 'production' && password !== process.env.FILES_PASSWORD) {
    return res.redirect('/404')
  }

  const queueData = global.queueItems;

  const reversedQueueData = queueData.slice().reverse();

  res.render('queue', {
    title: 'Queue',
    queueData: reversedQueueData,
  })
});

// router.get("/transcriptions/:path/:filename" , async function(req, res, next) {
//   console.log(req.params);
//   res.sendFile(`${process.cwd()}/transcriptions/${req.params.path}/${req.params.filename}`);
// });

module.exports = router;
