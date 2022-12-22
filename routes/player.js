const express = require('express');
const fs = require('fs-extra');

const router = express.Router();

const { newLanguagesMap } = require('../constants/constants');
const { languagesToTranscribe } = require('../constants/constants');

/** PLYR PLAYER **/
router.get('/player/:filename', async function (req, res, next) {
  try {
    const fileNameWithoutExtension = req.params.filename;

    const processDirectory = process.cwd();

    const filePathWithoutExtension = `/transcriptions/${fileNameWithoutExtension}/${fileNameWithoutExtension}`;

    l('filePathWithoutExtension');
    l(filePathWithoutExtension);

    const containingFolder = `${processDirectory}/transcriptions/${fileNameWithoutExtension}`;

    const processingDataPath = `${containingFolder}/processing_data.json`;

    const processingData = JSON.parse(
      await fs.readFile(processingDataPath, 'utf8')
    );

    const translatedLanguages = processingData.translatedLanguages;

    // TODO: check that it doesn't include the original language? or it never will?
    const languagesToLoop = newLanguagesMap.filter(function (language) {
      return translatedLanguages.includes(language.name);
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
    });
  } catch (err) {
    l('err');
    l(err);
    res.send(err);
  }
});

module.exports = router;
