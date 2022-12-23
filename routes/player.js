const express = require('express');
const fs = require('fs-extra');

const router = express.Router();

const { newLanguagesMap } = require('../constants/constants');
const { languagesToTranscribe } = require('../constants/constants');

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

    let allLanguages = languagesToLoop.slice();

    allLanguages.push({
      name: processingData.language,
      languageCode: processingData.languageCode
    })

    l('all languages');
    l(allLanguages);

    res.render('player/player', {
      filePath: filePathWithoutExtension,
      languages: languagesToTranscribe,
      fileNameWithoutExtension,
      filePathWithoutExtension,
      processingData,
      title: processingData.filename,
      languagesToLoop,
      allLanguages,
      renderedFilename: req.params.filename
      // vttPath,
      // fileSource
    })
  } catch (err){
    l('err');
    l(err);
    res.send(err);
  }
});

router.get("/player/:filename/add" , async function(req, res, next){
  try {

    const fileNameWithoutExtension = req.params.filename

    const processDirectory = process.cwd();

    const containingFolder = `${processDirectory}/transcriptions/${fileNameWithoutExtension}`

    const processingDataPath = `${containingFolder}/processing_data.json`;

    const processingData = JSON.parse(await fs.readFile(processingDataPath, 'utf8'));

    const originalVtt = await fs.readFile(`${containingFolder}/${processingData.directoryFileName}.vtt`, 'utf8');

    res.render('addTranslation/addTranslation', {
      title: 'Add Translation',
      renderedFilename: fileNameWithoutExtension,
      originalVtt
      // vttPath,
      // fileSource
    })
  } catch (err){
    l('err');
    l(err);
    res.send(err);
  }
});

const { Readable } = require('stream');


/** PLYR PLAYER **/
router.post("/player/:filename/add" , async function(req, res, next){
  try {

    const { language } = req.body;

    const fileNameWithoutExtension = req.params.filename

    const newVtt = req.body.message;

    const processDirectory = process.cwd();

    const containingFolder = `${processDirectory}/transcriptions/${fileNameWithoutExtension}`

    const processingDataPath = `${containingFolder}/processing_data.json`;

    const processingData = JSON.parse(await fs.readFile(processingDataPath, 'utf8'));

    const originalVttPath = `${containingFolder}/${processingData.directoryFileName}.vtt`;

    const originalVtt = await fs.readFile(`${containingFolder}/${processingData.directoryFileName}.vtt`, 'utf8');

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

    const newVttPath = `${containingFolder}/${processingData.directoryFileName}_${language}.vtt`;

    const originalFileVtt = `${containingFolder}/${processingData.directoryFileName}_${processingData.language}.vtt`;

    await fs.writeFile(newVttPath, reformatted, 'utf-8');

    processingData.translatedLanguages.push(language);

    processingData.keepMedia = true;

    await fs.writeFile(processingDataPath, JSON.stringify(processingData), 'utf-8');

    await fs.writeFile(originalFileVtt, originalVtt, 'utf-8');

    return res.redirect(`/player/${req.params.filename}`)

  } catch (err){
    l('err');
    l(err);
    res.send(err);
  }
});

module.exports = router;
