const which = require('which');
const spawn = require('child_process').spawn;
const fs = require('fs-extra');
const ffprobe = require('ffprobe');
const WebSocket = require('ws');
let convert = require('cyrillic-to-latin')
const projectConstants = require('../constants/constants');
const { shouldTranslateFrom, languagesToTranscribe, translationLanguages, getLanguageCodeForAllLanguages } = projectConstants;
const forHumans = require('../helpers/helpers').forHumans;
const createTranslatedFiles = require('../translate/translate-files-api');
const {formatStdErr} = require('../helpers/formatStdErr');
const LTHost = process.env.LIBRETRANSLATE;
const { handleStdErr, handleStdOut, handleProcessClose } = require('../lib/transcribing')

function getCodeFromLanguageName (languageName) {
  return translationLanguages.find(function (filteredLanguage) {
    return languageName === filteredLanguage.name;
  }).code
}


const {
  // autoDetectLanguage,
  buildArguments,
  // moveAndRenameFilesAndFolder,
  // saveTranscriptionCompletedInformation,
  // writeToProcessingDataFile,
} = require('./transcribing');

l = console.log;

const whisperPath = which.sync('whisper')

async function transcribe ({
  language,
  model,
  originalFileExtension,
  uploadFileName,
  originalFileName,
  randomNumber // standin for claimId or something like that
}) {
  return new Promise(async (resolve, reject) => {
    try {
      const originalUpload = `${process.cwd()}/uploads/${uploadFileName}`;
      const processingDataPath = `${process.cwd()}/transcriptions/${randomNumber}/processing_data.json`

      // save date when starting to see how long it's taking
      const startingDate = new Date();
      l(startingDate);

      const whisperArguments = buildArguments({
        uploadedFilePath: originalUpload, // file to use
        language, //
        model,
        randomNumber,
      })

      l('whisperArguments');
      l(whisperArguments);

      // todo: should probably rename since Whisper doesn't like special chars in folder path
      const whisperProcess = spawn(whisperPath, whisperArguments);

      whisperProcess.stdout.on('data',  (data) => l(`STDOUT: ${data}`));

      /** console output from stderr **/ // (progress comes through stderr for some reason)
      whisperProcess.stderr.on('data', handleStdErr({ model, language, originalFileName, processingDataPath }));

      /** whisper responds with 0 or 1 process code **/
      whisperProcess.on('close', handleProcessClose({ processingDataPath, originalUpload, randomNumber }))


    } catch (err) {
      l('error from transcribe')
      l(err);

      reject(err);

      throw new Error(err)
    }

  });

}

module.exports = transcribe;
