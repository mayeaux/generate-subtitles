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

const l = console.log;

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
    let originalFileName, uploadFileName;
    if(file){
      originalFileName = file.originalname;
      uploadFileName = file.filename;
    }

    // get language and model
    const { model, language, downloadLink } = postBodyData;

    l('postBodyData');
    l(postBodyData);

    // get model values as array
    const validModelValues = modelsArray.map((model) => model.value);

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

    // TODO: implement this
    let originalFileNameWithExtension, originalFileExtension, originalFileNameWithoutExtension, directorySafeFileNameWithoutExtension;
    if(file){
      ({
        originalFileNameWithExtension,
        originalFileExtension,
        originalFileNameWithoutExtension,
        directorySafeFileNameWithoutExtension
      } = createFileNames(originalFileName));
    }

    // random ten digit number
    const randomNumber = generateRandomNumber();

    // hit yt-dlp and get file title name
    const filename =  await getFilename(downloadLink);


    const directoryName = makeFileNameSafe(filename)

    l('directoryName');
    l(directoryName);

    l('filename');
    l(filename);

    // build this properly
    const host = process.env.NODE_ENV === 'production' ? 'https://freesubtitles.ai' : 'http://localhost:3001';

    // create directory for transcriptions
    await fs.mkdirp(`${process.cwd()}/transcriptions/${randomNumber}`);

    // setup path for processing data
    const processingDataPath = `${process.cwd()}/transcriptions/${randomNumber}/processing_data.json`;

    // save initial data
    await writeToProcessingDataFile(processingDataPath, {
      model,
      language,
      downloadLink,
      filename
    })

    res.send({
      message: 'starting-download',
      // where the data will be sent from
      transcribeDataEndpoint: `${host}/api/${randomNumber}`,
      fileTitle: filename,
    });

    await writeToProcessingDataFile(processingDataPath, {
      status: 'downloading',
    })

    // download file with name as the random number
    await downloadFileApi({
      videoUrl: downloadLink,
      randomNumber,
    });

    // check uploads directory
    const files = await fs.promises.readdir(`${process.cwd()}/uploads`);

    // get matching file (I don't think we always know the extension)
    const matchingFile = files.filter((file) => file.startsWith(randomNumber))[0];
    l(matchingFile);

    await writeToProcessingDataFile(processingDataPath, {
      status: 'starting-transcription',
    })

    // todo: rename to transcribeAndTranslate
    await transcribe({
      language,
      model,
      originalFileExtension,
      uploadFileName: matchingFile,
      originalFileName,
      randomNumber
    })

    // tell the client it's started
    // if (response === 'started') {
    //   const port = req.socket.localPort;
    //   let apiPath = req.protocol + '://' + req.hostname  + ( port === 80 || port === 443 ? '' : ':'+port ) + req.path;
    //   if (process.env.NODE_ENV === 'production') {
    //     apiPath = req.protocol + '://' + req.hostname + req.path;
    //   }
    //
    //   // return res.redirect(`/api/${sixDigitNumber}`)
    //   res.send({
    //     status: 'started',
    //     url: `${apiPath}/${sdHash}`,
    //   });
    // }
  } catch (err) {
    l('err')
    l(err);
    return res.status(500).send({error: `Something went wrong: ${err}`});
  }
});

// get info about the transcription via api
router.get('/api/:sdHash', async function (req, res, next) {
  try {

    l('Getting info by SDHash');

    // TODO: should rename this
    const sdHash = req.params.sdHash;

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
