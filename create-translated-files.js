const translateText = require('./libreTranslateWrapper');
const fs = require('fs-extra');
const projectConstants = require('./constants');
const { languagesToTranscribe } = projectConstants;

const convert = require("cyrillic-to-latin");

let l = console.log;

if(global.debug === 'false'){
  l = function(){}
}


/** for translation **/
async function createTranslatedSrts({
    directoryAndFileName,
    language,
}){

  const loopThrough = ['.srt', '.vtt', 'txt'];

  // TODO: translate the rest
  const srtData = fs.readFileSync(`${directoryAndFileName}.srt`, 'utf-8');
  l(srtData);
  l(srtData);

  for(const languageToConvertTo of languagesToTranscribe){
    // no need to translate just copy the file
    if(languageToConvertTo === language){
      await fs.copy(`${directoryAndFileName}_${language}.srt`)
    } else {
      // hit LibreTranslate backend
      l(`hitting libretranslate: ${language}`);
      const translatedText = await translateText({
        sourceLanguage: language, // before these were like 'EN', will full language work?
        targetLanguage: languageToConvertTo,
        text: srtData,
      })
      l('translatedText');
      l(translatedText);
      await fs.writeFile(`${directoryAndFileName}_${languageToConvertTo}.srt`, translatedText, 'utf-8');
    }
  }

  return true;

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

