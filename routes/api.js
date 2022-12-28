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
const { languagesToTranslateTo, newLanguagesMap, translationLanguages } = constants;

const makeFileNameSafe = function (string) {
  return filenamify(string, {replacement: '_' })
    .split('：').join(':')
    .replace(/[&\/\\#,+()$~%.'":*?<>{}!]/g, '')
    .replace(/\s+/g,'_')
}

function getCodeFromLanguageName (languageName) {
  return translationLanguages.find(function (filteredLanguage) {
    return languageName === filteredLanguage.name;
  }).code
}


const storage = multer.diskStorage({ // notice  you are calling the multer.diskStorage() method here, not multer()
  destination: function (req, file, cb) {
    cb(null, './uploads/')
  },
});

let upload = multer({ storage });

// file
// {
//   fieldname: 'file',
//   originalname: 'dutch_language.mp3',
//   encoding: '7bit',
//   mimetype: 'audio/mpeg',
//   destination: './uploads/',
//   filename: '572fa0ecb660b1d0eb489b879c2e2310',
//   path: 'uploads/572fa0ecb660b1d0eb489b879c2e2310',
//   size: 22904865
// }

router.post('/api', upload.single('file'), async function (req, res, next) {
  try {
    const postBodyData = Object.assign({},req.body)
    const file = req.file;
    const { originalname: originalFileName, filename: uploadFileName } = file;

    const { model, language, sdHash } = postBodyData;

    const processingDataFile = `./transcriptions/${sdHash}/processing_data.json`

    let processingFileExists = false;
    try {
      processingFileExists = await fs.promises.stat(processingDataFile)
    } catch (error) {}

    if (processingFileExists) {
      const completedProcessingData = await fs.readFile(processingDataFile, 'utf8')

      if (completedProcessingData) {
        l = console.log;
        return res.redirect(`/api/${sdHash}`)
      }
    }

    // TODO: move this stuff to transcribe function
    // something.mp4
    let originalFileNameWithExtension = originalFileName;

    // .mp4 (includes leading period)
    const originalFileExtension = path.parse(originalFileNameWithExtension).ext;

    const originalFileNameWithoutExtension = path.parse(originalFileNameWithExtension).name;
    l('originalFileNameWithoutExtension')
    l(originalFileNameWithoutExtension)

    // something
    const directorySafeFileNameWithoutExtension = makeFileNameSafe(originalFileNameWithoutExtension)

    l('directorySafeFileNameWithoutExtension')
    l(directorySafeFileNameWithoutExtension)

    l = console.log;

    // todo: rename to transcribeAndTranslate
    const response = await transcribe({
      language,
      model,
      originalFileExtension,
      uploadFileName,
      originalFileName,
      sdHash // standin for claimId or something like that
    })

    // tell the client it's started
    if (response === 'started') {
      const port = req.socket.localPort;
      let apiPath = req.protocol + '://' + req.hostname  + ( port === 80 || port === 443 ? '' : ':'+port ) + req.path;
      if (process.env.NODE_ENV === 'production') {
        apiPath = req.protocol + '://' + req.hostname + req.path;
      }

      // return res.redirect(`/api/${sixDigitNumber}`)
      res.send({
        status: 'started',
        sdHash,
        url: `${apiPath}/${sdHash}`,
      });
    }
  } catch (err) {
    l('err')
    l(err);
    throw (err);
  }
});

// get info about the transcription via api
router.get('/api/:sdHash', async function (req, res, next) {
  try {

    l('Getting info by SDHash');

    const sdHash = req.params.sdHash;

    const processingData = JSON.parse(await fs.readFile(`./transcriptions/${sdHash}/processing_data.json`, 'utf8'));

    const transcriptionStatus = processingData.status;

    // todo: should be a number
    const progress = processingData.progress;

    const { language, languageCode, translatedLanguages } = processingData;

    /** transcription successfully completed **/
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

      for (const translatedLanguage of translatedLanguages) {
        const originalVtt = await fs.readFile(`./transcriptions/${sdHash}/${sdHash}_${translatedLanguage}.vtt`, 'utf8');
        subtitles.push({
          language: translatedLanguage,
          languageCode: getCodeFromLanguageName(translatedLanguage),
          webVtt: originalVtt
        })
      }

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
