// const translateText = require('./libreTranslateWrapper');
const fs = require('fs-extra');
// TODO: this is named wrong, should be languagesToTranslateTo
const { languagesToTranscribe, allLanguages } = require('../constants/constants');;
const { reformatVtt } = require('./helpers')
const { simplified } = require('zh-convert');
const translateText = require('./google-translate-browser')

const convert = require('cyrillic-to-latin');

let l = console.log;

if (global.debug === 'false') {
  l = function () {}
}

// l('translationLanguages')
// l(translationLanguages);

// l('all languages');
// l(allLanguages);

function getCodeFromLanguageName (languageName) {
  return allLanguages.find(function (filteredLanguage) {
    return languageName === filteredLanguage.name;
  }).code
}

// l(getCodeFromLanguageName('English'))
// TODO: pass processing path
/** for translation **/
async function createTranslatedFiles ({
    directoryAndFileName,
    language,
    websocketConnection,
    strippedText,
    timestampsArray,
    targetLangs,
}) {

  const loopThrough = ['.srt', '.vtt', 'txt'];

  const vttPath = `${directoryAndFileName}.vtt`;

  // TODO: translate the rest
  const vttData = await fs.readFile(vttPath, 'utf-8');
  l('vttData');
  l(vttData);

  // TODO: pass this in from controller?
  // const { strippedText, timestampsArray } = await stripOutTextAndTimestamps(vttPath)

  // save stripped and timestamps to processing data

  l({languagesToTranscribe, targetLangs});

  for (const targetLang of targetLangs) {
    const {name: targetName, code: targetCode} = targetLang;
    l({language, targetName, targetCode});

    try {
      // no need to translate just copy the file
      if (targetName !== language) {
        websocketConnection.send(JSON.stringify({
          languageUpdate: `Translating into ${targetName}..`,
          message: 'languageUpdate'
        }), function () {});

        // hit translating backend
        l(`Translating: ${language} -> ${targetName}`);
        // TODO: to convert to thing
        // let translatedText = await translateText({
        //   sourceLanguage: sourceLanguageCode, // before these were like 'EN', will full language work?
        //   targetLanguage: targetCode,
        //   text: strippedText,
        // })

        let translatedText = await translateText({
          text: strippedText,
          targetLanguageCode: targetCode, // before these were like 'EN', will full language work?
        })
        // l(translatedText);

        if (!translatedText) {
          continue
        }

        if (targetName === 'Chinese') {
          translatedText = simplified(translatedText);
        }

        if (targetName === 'Serbian') {
          translatedText = convert(translatedText);
        }

        const reformattedVtt = reformatVtt(timestampsArray, translatedText);

        await fs.writeFile(`${directoryAndFileName}_${targetName}.vtt`, reformattedVtt, 'utf-8');
      }
    } catch (err) {
      l(err);
      l('error in translation');
      return err
    }
  }
}

// const uploadDirectoryName = 'ef56767d5cba0ae421a9f6f570443205';
// const transcribedFileName = 'ef56767d5cba0ae421a9f6f570443205';
//
// const languageToConvertFrom = 'en';
// const languagesToConvertTo = ['es', 'fr'];

// async function main(){
//   const completed = await createTranslatedSrts({
//     uploadDirectoryName: uploadDirectoryName,
//     transcribedFileName: transcribedFileName,
//     languageToConvertFrom: languageToConvertFrom,
//     languagesToConvertTo: languagesToConvertTo
//   });
//
//   l('completed');
//   l(completed);
// }

// main();

module.exports = createTranslatedFiles;

