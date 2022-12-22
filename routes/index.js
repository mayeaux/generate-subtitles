let express = require('express');
const _ = require('lodash');

const { global } = require('../lib/stats');
const fileRouter = require('./files');
const playerRouter = require('./player');
const transcribeRouter = require('./transcribe');
const { forHumans } = require('../helpers/helpers');
const { uploadFileSizeLimitInMB } = require('../lib/transcribing');

const {
  modelsArray,
  whisperLanguagesHumanReadableArray,
} = require('../constants/constants');

let router = express.Router();
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
