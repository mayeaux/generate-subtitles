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
const { downloadFileApi, getFilename} = require('../downloading/yt-dlp-download');
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
    let originalFileName, uploadFileName, uploadFilePath;
    if (file) {
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

    let numberToUse;
    if (downloadLink) {
      numberToUse = generateRandomNumber();
    } else {
      numberToUse = websocketNumber;
    }

    l('postBodyData');
    l(postBodyData);

    // get model values as array
    const validModelValues = modelsArray.map((model) => model.value);

    const authTokenString = await fs.readFile(`${process.cwd()}/constants/apiTokens.txt`, 'utf8');
    const authTokenStringsAsArray = authTokenString.split(',');
    const authedByToken = authTokenStringsAsArray.includes(apiToken);

    if (process.env.NODE_ENV === 'production' && !authedByToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // nothing to transcribe
    if (!downloadLink && !file) {
      // eslint-disable-next-line quotes
      return res.status(400).json({error: `Please pass either a 'file' or 'downloadLink'`});
    }

    // bad model name
    if (!validModelValues.includes(model)) {
      return res.status(400).send({error: `Your model of '${model}' is not valid. Please choose one of the following: ${validModelValues.join(', ')}`});
    }

    // bad language name
    if (!whisperLanguagesHumanReadableArray.includes(language)) {
      return res.status(400).send({error: `Your language of '${language}' is not valid. Please choose one of the following: ${whisperLanguagesHumanReadableArray.join(', ')}`});
    }

    // TODO: implement this
    let originalFileNameWithExtension, originalFileExtension, originalFileNameWithoutExtension, directorySafeFileNameWithoutExtension;
    if (file) {
      ({
        originalFileNameWithExtension,
        originalFileExtension,
        originalFileNameWithoutExtension,
        directorySafeFileNameWithoutExtension
      } = createFileNames(originalFileName));
    }

    let filename;
    if (downloadLink) {
      // hit yt-dlp and get file title name
      filename =  await getFilename(downloadLink);
    } else {
      filename = originalFileNameWithExtension
    }

    const directoryName = makeFileNameSafe(filename)

    l('directoryName');
    l(directoryName);

    l('filename');
    l(filename);

    // build this properly
    const host = process.env.NODE_ENV === 'production' ? 'https://freesubtitles.ai' : 'http://localhost:3001';

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
      filename,
      apiToken
    })

    let matchingFile;
    if (downloadLink) {

      res.send({
        message: 'starting-download',
        // where the data will be sent from
        transcribeDataEndpoint: `${host}/api/${numberToUse}`,
        fileTitle: filename,
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
        transcribeDataEndpoint: `${host}/api/${numberToUse}`,
        fileTitle: filename,
      });
    }

    // move transcribed file to the correct location (TODO: do this before transcribing)
    await fs.move(uploadFilePath, newPath)

    await writeToProcessingDataFile(processingDataPath, {
      status: 'starting-transcription',
    })

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

    l('sd hash')
    l(sdHash);

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
