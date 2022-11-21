const translateText = require('./libreTranslateWrapper');
const fs = require('fs-extra');
const projectConstants = require('./constants');
const { languagesToTranscribe, translationLanguages } = projectConstants;

const convert = require("cyrillic-to-latin");

let l = console.log;

if(global.debug === 'false'){
  l = function(){}
}

// l('translationLanguages')
// l(translationLanguages);
//
// l('languagesToTranscribe')
// l(languagesToTranscribe);

function getCodeFromLanguageName(languageName){
  return translationLanguages.find(function(filteredLanguage){
    return languageName === filteredLanguage.name;
  }).code
}

l(getCodeFromLanguageName('English'))


/** for translation **/
async function createTranslatedSrts({
    directoryAndFileName,
    language,
}){

  const loopThrough = ['.srt', '.vtt', 'txt'];

  // TODO: translate the rest
  const srtData = await fs.readFile(`${directoryAndFileName}.vtt`, 'utf-8');
  l('srtData');
  l(srtData);

  for(const languageToConvertTo of languagesToTranscribe){
    l('languageToConvertTo');
    l(languageToConvertTo);

    l('language');
    l(language);

    try {
      // no need to translate just copy the file
      if(languageToConvertTo === language){
        l('copying file');
        await fs.copy(`${directoryAndFileName}.vtt`, `${directoryAndFileName}_${language}.vtt`)
      } else {
        // hit LibreTranslate backend
        l(`hitting libretranslate: ${language} -> ${languageToConvertTo}`);
        // TODO: to convert to thing
        const translatedText = await translateText({
          sourceLanguage: getCodeFromLanguageName(language), // before these were like 'EN', will full language work?
          targetLanguage: getCodeFromLanguageName(languageToConvertTo),
          text: srtData,
        })
        l('translatedText');
        l(translatedText);
        await fs.writeFile(`${directoryAndFileName}_${languageToConvertTo}.vtt`, translatedText, 'utf-8');
      }
    } catch (err){
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

module.exports = createTranslatedSrts;

