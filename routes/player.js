const { stripOutTextAndTimestamps, reformatVtt } = require ('../translate/helpers')
const { Readable } = require('stream');
const fs = require('fs-extra');
const {newLanguagesMap, languagesToTranscribe} = require('../constants/constants');
const express = require('express');
let router = express.Router();

const nodeEnv = process.env.NODE_ENV || 'development';

/** PLYR PLAYER **/
router.get('/player/:timestampedFileName' , async function (req, res, next) {
  try {
    const { password } = req.query;

    const userAuthed = password === process.env.FILES_PASSWORD

    const fileNameWithoutExtension = req.params.timestampedFileName

    const timestampedFileName = req.params.timestampedFileName

    const processDirectory = process.cwd();

    const containingFolder = `${processDirectory}/transcriptions/${fileNameWithoutExtension}`

    const processingDataPath = `${containingFolder}/processing_data.json`;

    const processingData = JSON.parse(await fs.readFile(processingDataPath, 'utf8'));

    const safeFileNameWithoutExtension = processingData.directorySafeFileNameWithoutExtension

    const filePathWithoutExtension = `/transcriptions/${timestampedFileName}/${safeFileNameWithoutExtension}`;

    // l('filePathWithoutExtension')
    // l(filePathWithoutExtension);

    const translatedLanguages = processingData.translatedLanguages;

    const mediaFile = `/transcriptions/${fileNameWithoutExtension}/${processingData.directorySafeFileNameWithExtension}`;

    const vttFilePath = `/transcriptions/${timestampedFileName}/${safeFileNameWithoutExtension}.vtt`

    // TODO: check that it doesn't include the original language? or it never will?
    const languagesToLoop = newLanguagesMap.filter(function (language) {
      return translatedLanguages.includes(language.name)
    });

    delete processingData.strippedText;
    delete processingData.timestampsArray;

    // l('processing data');
    // l(processingData);
    //
    l('languages to loop');
    l(languagesToLoop);

    let allLanguages = languagesToLoop.slice();

    allLanguages.push({
      name: processingData.language,
      languageCode: processingData.languageCode
    })

    // l('all languages');
    // l(allLanguages);



    res.render('player/player', {
      filePath: filePathWithoutExtension,
      languages: languagesToTranscribe,
      fileNameWithoutExtension,
      filePathWithoutExtension,
      processingData,
      title: timestampedFileName,
      languagesToLoop: allLanguages,
      allLanguages,
      renderedFilename: timestampedFileName,
      userAuthed,
      password,
      mediaFile,
      vttFilePath,
      translatedLanguages,
      nodeEnv
      // vttPath,
      // fileSource
    })
  } catch (err) {
    l('err');
    l(err);
    res.send(err);
    // res.redirect('/404')
  }
});

/** player route to add translation  **/
router.get('/player/:timestampedFileName/add' , async function (req, res, next) {
  try {

    const timestampedFileName = req.params.timestampedFileName

    const processDirectory = process.cwd();

    const containingFolder = `${processDirectory}/transcriptions/${timestampedFileName}`

    const processingDataPath = `${containingFolder}/processing_data.json`;

    const processingData = JSON.parse(await fs.readFile(processingDataPath, 'utf8'));

    const originalFileNameWithoutExtension = processingData.directorySafeFileNameWithoutExtension

    const originalVtt = await fs.readFile(`${containingFolder}/${originalFileNameWithoutExtension}.vtt`, 'utf8');

    res.render('addTranslation/addTranslation', {
      title: 'Add Translation',
      renderedFilename: timestampedFileName,
      originalVtt
      // vttPath,
      // fileSource
    })
  } catch (err) {
    l('err');
    l(err);
    res.send(err);
  }
});

/** PLYR PLAYER **/
router.post('/player/:timestampedFileName/add' , async function (req, res, next) {
  try {

    const { language } = req.body;

    const timestampedFileName = req.params.timestampedFileName

    const newVtt = req.body.message;

    const processDirectory = process.cwd();

    const containingFolder = `${processDirectory}/transcriptions/${timestampedFileName}`

    const processingDataPath = `${containingFolder}/processing_data.json`;

    const processingData = JSON.parse(await fs.readFile(processingDataPath, 'utf8'));

    const originalFileNameWithoutExtension = processingData.directorySafeFileNameWithoutExtension

    const originalVttPath = `${containingFolder}/${originalFileNameWithoutExtension}.vtt`;

    const originalVtt = await fs.readFile(originalVttPath, 'utf8');

    const inputStream = new Readable(newVtt);

    inputStream.push(newVtt);

    inputStream.push(null);

    l(inputStream)

    const { strippedText } = await stripOutTextAndTimestamps(inputStream, true);

    l('stripped text');
    l(strippedText);

    const { timestampsArray } = await stripOutTextAndTimestamps(originalVttPath);

    l('timestamps array');
    l(timestampsArray);

    const reformatted = reformatVtt(timestampsArray, strippedText);

    l(reformatted);
    l('refomatted');

    const newVttPath = `${containingFolder}/${originalFileNameWithoutExtension}_${language}.vtt`;

    // copy language name
    const originalFileVtt = `${containingFolder}/${originalFileNameWithoutExtension}_${processingData.language}.vtt`;

    await fs.writeFile(newVttPath, reformatted, 'utf-8');

    processingData.translatedLanguages.push(language);

    processingData.keepMedia = true;

    await fs.writeFile(processingDataPath, JSON.stringify(processingData), 'utf-8');

    await fs.writeFile(originalFileVtt, originalVtt, 'utf-8');

    return res.redirect(`/player/${timestampedFileName}`)

  } catch (err) {
    l('err');
    l(err);
    res.send(err);
  }
});

/** CHANGE KEEP MEDIA **/
router.post('/player/:timestampedFileName/keepMedia' , async function (req, res, next) {
  try {
    const { password } = req.query;

    const keepMedia = req.query.keepMedia;

    const shouldKeepMedia = keepMedia === 'true';

    l('keep media');
    l(keepMedia);

    l('password');
    l(password);

    const fileNameWithoutExtension = timestampedFileName

    const processDirectory = process.cwd();

    const containingFolder = `${processDirectory}/transcriptions/${fileNameWithoutExtension}`

    const processingDataPath = `${containingFolder}/processing_data.json`;

    const processingData = JSON.parse(await fs.readFile(processingDataPath, 'utf8'));

    if (shouldKeepMedia) {
      processingData.keepMedia = true;
    } else {
      processingData.keepMedia = false;
    }

    await fs.writeFile(processingDataPath, JSON.stringify(processingData), 'utf-8');

    return res.redirect(`/player/${timestampedFileName}`)

  } catch (err) {
    l('err');
    l(err);
    res.send(err);
  }
});


module.exports = router;
