const translateText = require('./translate');
const fs = require('fs');
const convert = require("cyrillic-to-latin");

let l = console.log;

if(global.debug === 'false'){
  l = function(){}
}

const transcribeDirectory = './transcriptions';

async function createTranslatedSrts({
  uploadDirectoryName,
  transcribedFileName,
  languageToConvertFrom,
  languagesToConvertTo
}){
  const transcribedFilePath =
    `${transcribeDirectory}/${uploadDirectoryName}/${transcribedFileName}`;
  // without .srt at the end

  l('transcribedFilePath');
  l(transcribedFilePath);

  const data = fs.readFileSync(`${transcribedFilePath}.srt`, 'utf-8');
  l('data');
  l(data);

  for(const languageToConvertTo of languagesToConvertTo){
    l('languageToConvertTo');
    l(languageToConvertTo);

    // hit LibreTranslate backend
    l('hitting libretranslate');
    const translatedText = await translateText({
      sourceLanguage: languageToConvertFrom,
      targetLanguage: languageToConvertTo,
      text: data,
    })

    l('translatedText');
    l(translatedText);
    fs.writeFileSync(`${transcribedFilePath}_${languageToConvertTo}.srt`, translatedText, 'utf-8');
  }

  return true;

}

const uploadDirectoryName = 'ef56767d5cba0ae421a9f6f570443205';
const transcribedFileName = 'ef56767d5cba0ae421a9f6f570443205';

const languageToConvertFrom = 'en';
const languagesToConvertTo = ['es', 'fr'];

async function main(){
  const completed = await createTranslatedSrts({
    uploadDirectoryName: uploadDirectoryName,
    transcribedFileName: transcribedFileName,
    languageToConvertFrom: languageToConvertFrom,
    languagesToConvertTo: languagesToConvertTo
  });

  l('completed');
  l(completed);
}

main();

module.exports = createTranslatedSrts;

