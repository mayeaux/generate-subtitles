const path = require('path');
const express = require('express');
const axios = require('axios');
const fs = require('fs-extra');
const FormData = require('form-data');
const multer = require('multer');
const router = express.Router();
const transcribe = require('../transcribe/transcribe-api-wrapped')
const constants = require('../constants/constants');
const filenamify = require('filenamify');
const createTranslatedFiles = require('../translate/translate-files-api');
const { downloadFileApi, getFilename} = require("../downloading/yt-dlp-download");
const { languagesToTranslateTo, newLanguagesMap, translationLanguages } = constants;
const { modelsArray, whisperLanguagesHumanReadableArray } = constants;
const { writeToProcessingDataFile, createFileNames, makeFileNameSafe } = require('../lib/transcribing');
const {addToJobProcessOrQueue, amountOfRunningJobs} = require("../queue/newQueue");
const ffprobe = require("ffprobe");
const which = require("which");
const ffprobePath = which.sync('ffprobe')
const maxConcurrentJobs = Number(process.env.CONCURRENT_AMOUNT);

const l = console.log;

const serverType = process.env.SERVER_TYPE || 'both';


l('serverType');
l(serverType)


// generate random 10 digit number
function generateRandomNumber () {
  return Math.floor(Math.random() * 10000000000).toString();
}

const storage = multer.diskStorage({ // notice  you are calling the multer.diskStorage() method here, not multer()
  destination: function (req, file, cb) {
    cb(null, './uploads/')
  },
});

let upload = multer({ storage });

router.post('/api', upload.single('file'), async function (req, res, next) {
  try {
    // fix body data
    const postBodyData = Object.assign({},req.body)

    // get file names
    const file = req.file;
    let originalFileName, uploadFileName, uploadFilePath;
    if(file){
      originalFileName = file.originalname;
      uploadFileName = file.filename;
      uploadFilePath = file.path;
    }

    l('originalFileName');
    l(originalFileName);

    l('uploadFileName');
    l(uploadFileName)

    l(req.file);

    // get language and model
    const { model, language, downloadLink, apiToken, websocketNumber } = postBodyData;

    const passedNumberToUse = postBodyData.numberToUse;

    let numberToUse;
    if(!passedNumberToUse){
      if(downloadLink){
        numberToUse = generateRandomNumber();
      } else {
        numberToUse = websocketNumber;
      }
    } else {
      numberToUse = passedNumberToUse
    }


    l('postBodyData');
    l(postBodyData);

    // get model values as array
    const validModelValues = modelsArray.map((model) => model.value);

    const authTokenString = await fs.readFile(`${process.cwd()}/constants/apiTokens.txt`, 'utf8');
    const authTokenStringsAsArray = authTokenString.split(',');
    const authedByToken = authTokenStringsAsArray.includes(apiToken);

    if(process.env.NODE_ENV === 'production' && !authedByToken){
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // nothing to transcribe
    if(!downloadLink && !file){
      return res.status(400).json({error: `Please pass either a 'file' or 'downloadLink'`});
    }

    // bad model name
    if(!validModelValues.includes(model)) {
      return res.status(400).send({error: `Your model of '${model}' is not valid. Please choose one of the following: ${validModelValues.join(', ')}`});
    }

    // bad language name
    if(!whisperLanguagesHumanReadableArray.includes(language)) {
      return res.status(400).send({error: `Your language of '${language}' is not valid. Please choose one of the following: ${whisperLanguagesHumanReadableArray.join(', ')}`});
    }

    if(downloadLink){
      // hit yt-dlp and get file title name
      originalFileName =  await getFilename(downloadLink);
    }

    const {
      originalFileNameWithExtension,
      originalFileExtension,
      originalFileNameWithoutExtension,
      directorySafeFileNameWithoutExtension,
      directorySafeFileNameWithExtension,
      fileSafeNameWithDateTimestamp,
      fileSafeNameWithDateTimestampAndExtension,
    } = createFileNames(originalFileName)

    const directoryName = makeFileNameSafe(originalFileName)

    l('directoryName');
    l(directoryName);

    l('originalFileName');
    l(originalFileName);

    // create directory for transcriptions
    await fs.mkdirp(`${process.cwd()}/transcriptions/${numberToUse}`);

    const newPath = `${process.cwd()}/transcriptions/${numberToUse}/${numberToUse}`;

    // setup path for processing data
    const processingDataPath = `${process.cwd()}/transcriptions/${numberToUse}/processing_data.json`;

    // save initial data
    await writeToProcessingDataFile(processingDataPath, {
      model,
      language,
      downloadLink,
      filename: originalFileName,
      apiToken
    })

    // build endpoint to hit
    const port = req.socket.remotePort;
    const endpoint  = req.protocol + '://' + req.hostname  + ( port === 80 || port === 443 ? '' : ':'+port );
    const transcribeDataEndpoint = `${endpoint}/api/${numberToUse}`;

    let matchingFile;
    if(downloadLink){

      res.send({
        message: 'starting-download',
        // where the data will be sent from
        transcribeDataEndpoint,
        fileTitle: originalFileName,
      });

      await writeToProcessingDataFile(processingDataPath, {
        status: 'downloading',
      })

      // download file with name as the random number
      await downloadFileApi({
        videoUrl: downloadLink,
        numberToUse,
      });

      // check uploads directory
      const files = await fs.promises.readdir(`${process.cwd()}/uploads`);

      // get matching file (I don't think we always know the extension)
      matchingFile = files.filter((file) => file.startsWith(numberToUse))[0];
      l(matchingFile);

      uploadFilePath = `${process.cwd()}/uploads/${matchingFile}`;
    } else {
      res.send({
        message: 'starting-transcription',
        // where the data will be sent from
        transcribeDataEndpoint,
        fileTitle: originalFileName,
      });
    }

    // move transcribed file to the correct location (TODO: do this before transcribing)
    await fs.move(uploadFilePath, newPath, { overwrite: true });

    await writeToProcessingDataFile(processingDataPath, {
      status: 'starting-transcription',
    })

    // TODO: push onto job processing
    // if serverType === 'both' or serverType === 'frontend'
    // add to queue
    // otherwise just run it because we don't have to worry about queue if it's coded correctly

    const ffprobeResponse = await ffprobe(newPath, { path: ffprobePath });

    const audioStream = ffprobeResponse.streams.filter(stream => stream.codec_type === 'audio')[0];
    const uploadDurationInSeconds = Math.round(audioStream.duration);

    const stats = await fs.promises.stat(newPath);
    const fileSizeInBytes = stats.size;
    const fileSizeInMB = Number(fileSizeInBytes / 1048576).toFixed(1);

    const currentlyRunningJobs = amountOfRunningJobs();
    const amountInQueue = global.newQueue.length
    const totalOutstanding = currentlyRunningJobs + amountInQueue - maxConcurrentJobs + 1;

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

    const shouldUseAQueue = serverType === 'both' || serverType === 'frontend';
    if(shouldUseAQueue){
      const transcriptionJobItem = {
        uploadedFilePath: newPath, // TODO: rename newPath
        language,
        model,
        directorySafeFileNameWithoutExtension,
        directorySafeFileNameWithExtension,
        originalFileNameWithExtension,
        fileSafeNameWithDateTimestamp,
        fileSafeNameWithDateTimestampAndExtension,
        uploadGeneratedFilename: numberToUse, // TODO: refactor to use number by default

        shouldTranslate: false, // not supported by API yet
        uploadDurationInSeconds,
        fileSizeInMB,
        ...(downloadLink && { downloadLink }),
        skipToFront: true,
        totalOutstanding,
        ip,

        uploadFilePath: newPath, // transcribe-api-wrapped
        filePath: newPath, // transcribe remote server

        websocketNumber,

        languagesToTranslateTo,
        apiToken,
        numberToUse
      }

      addToJobProcessOrQueue(transcriptionJobItem);
    } else {
      // todo: rename to transcribeAndTranslate
      await transcribe({
        language,
        model,
        originalFileExtension,
        uploadFileName: matchingFile || originalFileName, //
        uploadFilePath: newPath,
        originalFileName,
        numberToUse,
      })
    }

  } catch (err) {
    l('err')
    l(err);
    l(err.stack)
    return res.status(500).send({error: `Something went wrong: ${err}`});
  }
});

// get info about the transcription via api
router.get('/api/:sdHash', async function (req, res, next) {
  try {

    l('Getting info by SDHash');

    // TODO: should rename this
    const sdHash = req.params.sdHash;

    l('sd hash')
    l(sdHash);

    // if serverType === 'frontend'
    // check the queue

    // get processing data path
    const processingData = JSON.parse(await fs.readFile(`./transcriptions/${sdHash}/processing_data.json`, 'utf8'));

    // get data from processing data
    const {
      language,
      languageCode,
      translatedLanguages,
      status: transcriptionStatus,
      progress
    } = processingData;

    // TODO: if smart (local) endpoint, check the queue position

    // transcription processing or translating
    if (transcriptionStatus === 'processing' || transcriptionStatus === 'translating') {
      // send current processing data
      return res.send({
        status: transcriptionStatus,
        sdHash,
        progress,
        processingData
      })

    /** transcription successfully completed, attach VTT files **/
    } else if (transcriptionStatus === 'completed') {
      let subtitles = [];

      // add original vtt
      const originalVtt = await fs.readFile(`./transcriptions/${sdHash}/${sdHash}.vtt`, 'utf8');
      subtitles.push({
        language,
        languageCode,
        webVtt: originalVtt
      })

      // for (const translatedLanguage of translatedLanguages) {
      //   const originalVtt = await fs.readFile(`./transcriptions/${sdHash}/${sdHash}_${translatedLanguage}.vtt`, 'utf8');
      //   subtitles.push({
      //     language: translatedLanguage,
      //     languageCode: getCodeFromLanguageName(translatedLanguage),
      //     webVtt: originalVtt
      //   })
      // }

      // send response as json
      const responseObject = {
        status: 'completed',
        sdHash,
        processingData,
        subtitles
      }
      // l('responseObject');
      // l(responseObject);

      return res.send(responseObject)
    }



    return res.send(processingData);

    // res.send('ok');
  } catch (err) {
    l('err');
    l(err);
  }
})





/** UNFINISHED FUNCTIONALITY **/
// post file from backend
router.post('/post', async function (req, res, next) {
  try {
    l(req.body);
    l(req.params);

    const endpointToHit = 'http:localhost:3000'

    // Create a new form instance
    const form = new FormData();

    const file = await fs.readFile('./ljubav.srt');
    l('file');
    l(file);

    form.append('subtitles', file, 'subtitles');

    form.append('filename', 'ljubav.srt');


    l('form headers');
    l(form.getHeaders())

    const response = await axios.post(endpointToHit, form, {
      headers: {
        ...form.getHeaders(),
      },
      data: {
        foo: 'bar', // This is the body part
      }
    });

    // l('response');
    // l(response);

    // res.send('ok');
  } catch (err) {
    l('err');
    l(err);
  }
})

module.exports = router;
