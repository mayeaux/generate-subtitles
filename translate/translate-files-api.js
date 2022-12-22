const translateText = require('./libreTranslateWrapper');
const fs = require('fs-extra');
const projectConstants = require('../constants/constants');
const { languagesToTranscribe, translationLanguages } = projectConstants;

// const languagesToTranscribe = {}

let l = console.log;

// l('languages to transcribe');
// l(languagesToTranscribe)
// [ 'English', 'French', 'German', 'Spanish', 'Russian', 'Japanese' ]

if (global.debug === 'false') {
  l = function () {}
}

function getCodeFromLanguageName (languageName) {
  return translationLanguages.find(function (filteredLanguage) {
    return languageName === filteredLanguage.name;
  }).code
}

/** for translation **/
async function createTranslatedFiles ({
  directoryAndFileName,
  language,
}) {
  const webVttData = await fs.readFile(`${directoryAndFileName}.vtt`, 'utf-8');

  // copy original as copied
  await fs.copy(`${directoryAndFileName}.vtt`, `${directoryAndFileName}_${language}.vtt`)

  for (const languageToConvertTo of languagesToTranscribe) {
    l('languageToConvertTo');
    l(languageToConvertTo);

    l('language');
    l(language);

    try {
      // no need to translate just copy the file
      if (languageToConvertTo !== language) {
        // hit LibreTranslate backend
        l(`hitting libretranslate: ${language} -> ${languageToConvertTo}`);

        let translatedText = await translateText({
          sourceLanguage: getCodeFromLanguageName(language), // before these were like 'EN', will full language work?
          targetLanguage: getCodeFromLanguageName(languageToConvertTo),
          text: webVttData,
        })

        // do the regexp here
        translatedText.replace(/^(\d[\d:.]+\d) .*?( \d[\d:.]+\d)$/gm, '$1 -->$2');

        translatedText = 'WEBVTT' + translatedText.slice(6);

        await fs.writeFile(`${directoryAndFileName}_${languageToConvertTo}.vtt`, translatedText, 'utf-8');
      }
    } catch (err) {
      l(err);
      l('error in translation');
      return err
    }
  }
}

module.exports = createTranslatedFiles;

