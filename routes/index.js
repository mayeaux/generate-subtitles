var express = require('express');
var router = express.Router();
const fs = require('fs-extra');

const {global} = require("../lib/state")
const file = require("./files")

const {languagesToTranscribe} = require("../constants/constants");
const filenamify = require("filenamify");
const { forHumans, forHumansNoSeconds } = require('../helpers/helpers')
const moment = require('moment');
const { newLanguagesMap, modelsArray, whisperLanguagesHumanReadableArray } = require('../constants/constants');
const _ = require('lodash');

//file router 
router.use(file)

const uploadPath =  process.env.UPLOAD_PATH || 'localhost:3000';


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
    languages: whisperLanguagesHumanReadableArray
  });
});

global.queueData = [];

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
