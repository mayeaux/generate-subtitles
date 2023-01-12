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
//
// l('languagesToTranscribe')
// l(languagesToTranscribe);

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
    vttData
}) {

  // const loopThrough = ['.srt', '.vtt', 'txt'];

  const vttPath = `${directoryAndFileName}.vtt`;

  // TODO: translate the rest
  if(!vttData){
    vttData = await fs.readFile(vttPath, 'utf-8');
  }

  l('vttData');
  l(vttData);

  l({languagesToTranscribe})

  const translatedFiles = [];

  // TODO: this is misnamed: it's not the languages to transcribe, it's the languages to translate to
  for (const languageToConvertTo of languagesToTranscribe) {
    l('languageToConvertTo');
    l(languageToConvertTo);

    l('language');
    l(language);

    try {
      if(languageToConvertTo === language){
        l('skipping language');
        continue;
      }



      // no need to translate just copy the file
      if (languageToConvertTo !== language) {

        // cool language frontend functionality
        if(websocketConnection){
          websocketConnection.send(JSON.stringify({
            languageUpdate: `Translating into ${languageToConvertTo}..`,
            message: 'languageUpdate'
          }), function () {});
        }


        const sourceLanguageCode = getCodeFromLanguageName(language);
        const targetLanguageCode = getCodeFromLanguageName(languageToConvertTo);

        // l('sourceLanguageCode');
        // l(sourceLanguageCode);
        // l('targetLanguageCode');
        // l(targetLanguageCode);

        // hit LibreTranslate backend
        l(`hitting libretranslate: ${language} -> ${languageToConvertTo}`);
        // TODO: to convert to thing
        // let translatedText = await translateText({
        //   sourceLanguage: sourceLanguageCode, // before these were like 'EN', will full language work?
        //   targetLanguage: targetLanguageCode,
        //   text: strippedText,
        // })

        let translatedText = await translateText({
          text: strippedText,
          targetLanguageCode, // before these were like 'EN', will full language work?
        })
        // l('translatedText');
        // l(translatedText);

        if (!translatedText) {
          continue
        }

        if (languageToConvertTo === 'Chinese') {
          translatedText = simplified(translatedText);
        }

        if (languageToConvertTo === 'Serbian') {
          translatedText = convert(translatedText);
        }

        const reformattedVtt = reformatVtt(timestampsArray, translatedText);

        // write them to a file
        await fs.writeFile(`${directoryAndFileName}_${languageToConvertTo}.vtt`, reformattedVtt, 'utf-8');

        // but also format for response
        translatedFiles.push({
          language: languageToConvertTo,
          translatedText: reformattedVtt
        });

      }
    } catch (err) {
      l(err);
      l('error in translation');
      return err
    }
  }

  return translatedFiles
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

