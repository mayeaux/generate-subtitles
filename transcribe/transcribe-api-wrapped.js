const which = require("which");
const spawn = require('child_process').spawn;
const fs = require('fs-extra');
const ffprobe = require('ffprobe');
const WebSocket = require('ws');
var convert = require('cyrillic-to-latin')
const projectConstants = require('../constants/constants');
const { shouldTranslateFrom, languagesToTranscribe, translationLanguages, getLanguageCodeForAllLanguages } = projectConstants;
const forHumans = require('../helpers/helpers').forHumans;
const createTranslatedFiles = require('../translate/translate-files-api');
const {formatStdErr} = require("../helpers/formatStdErr");
const LTHost = process.env.LIBRETRANSLATE;

function getCodeFromLanguageName(languageName){
  return translationLanguages.find(function(filteredLanguage){
    return languageName === filteredLanguage.name;
  }).code
}


const {
  autoDetectLanguage,
  buildArguments,
  moveAndRenameFilesAndFolder,
  saveTranscriptionCompletedInformation,
  writeToProcessingDataFile,
  translateIfNeeded
} = require('../lib/transcribing');

l = console.log;

const libreTranslateHostPath = process.env.LIBRETRANSLATE;
l(`libreTranslateHostPath: ${libreTranslateHostPath}`)

const whisperPath = which.sync('whisper')

global.topLevelValue = 1;

async function transcribe({
  language,
  model,
  originalFileExtension,
  uploadFileName,
  originalFileName,
  sdHash // standin for claimId or something like that
}){
  return new Promise(async (resolve, reject) => {
    try {
      const originalUpload = `./uploads/${uploadFileName}`;
      const processingDataPath = `./transcriptions/${sdHash}/processing_data.json`;

      await fs.mkdirp(`./transcriptions/${sdHash}`);

      l('transcribe arguments');
      l(arguments);

      // save date when starting to see how long it's taking
      const startingDate = new Date();
      l(startingDate);

      // todo: should probably rename since Whisper doesn't like special chars in folder path
      const whisperProcess = spawn(whisperPath, buildArguments({
        uploadedFilePath: originalUpload, // file to use
        language, //
        model,
        sdHash,
      }));

      // allow you to find the language
      // TODO: how to pull these out?
      let foundLanguage, responseSent;

      function holder({
        model, language, originalFileName, processingDataPath, resolve
      }){
        return function(data){
          (async function(){
            l(`STDERR: ${data}`)

            // get value from the whisper output string
            const formattedProgress = formatStdErr(data.toString());
            l('formattedProgress');
            l(formattedProgress);

            const { percentDoneAsNumber, percentDone, speed, timeRemaining  } = formattedProgress;

            // save info to processing_data.json
            await writeToProcessingDataFile(processingDataPath, {
              progress: percentDoneAsNumber,
              status: 'processing',
              model,
              language,
              languageCode: getCodeFromLanguageName(language),
              originalFileName
            })

            // when over 0%, mark as started successfully
            if(!responseSent){
              responseSent = true;
              resolve('started')
            }
          })()
        }
      }

      /**  console output from stdoutt **/
      async function handleStdOut(data){
        l(`STDOUT: ${data}`)

        // save auto-detected language
        const parsedLanguage = autoDetectLanguage(data.toString());
        if(parsedLanguage) foundLanguage = parsedLanguage;
      }

      /** after whisper completes **/
      async function handleProcessSuccess(){
        // move to the sixDigitNumber directory
        await moveAndRenameFilesAndFolder({
          originalUpload,
          uploadFileName,
          sdHash,
          originalFileExtension,
        })

        // save processing data with info
        await saveTranscriptionCompletedInformation({
          startingDate,
          sdHash,
        })

        const directoryAndFileName = `./transcriptions/${sdHash}/${sdHash}`

        const shouldTranslate = true;
        if(shouldTranslate && LTHost){
          l('hitting LibreTranslate');
          await writeToProcessingDataFile(processingDataPath, {
            status: 'translating'
          })

          await createTranslatedFiles({
            directoryAndFileName,
            language,
            // TODO: I prefer to pass languagesToTranscribe here
          })

          await writeToProcessingDataFile(processingDataPath, {
            translatedLanguages: languagesToTranscribe.filter(filteredLanguage => language !== filteredLanguage)
          })
        }

        await writeToProcessingDataFile(processingDataPath, {
          status: 'completed'
        })
      }

      async function handleProcessClose(code){
          const processFinishedSuccessfully = code === 0;
          l(`child process exited with code ${code}`);

          // use auto-detected language
          if(!language) language = foundLanguage;

          // successful output
          if(processFinishedSuccessfully){
            await handleProcessSuccess()
          } else {
            // process returned with non-0 response
            l('FAILED!');
            reject();
            throw new Error('Transcription has been ended')
          }
      }

      whisperProcess.stdout.on('data', handleStdOut);

      /** console output from stderr **/ // (progress comes through stderr for some reason)
      whisperProcess.stderr.on('data', holder({ model, language, originalFileName, processingDataPath, resolve}));

      /** whisper responds with 0 or 1 process code **/
      whisperProcess.on('close', handleProcessClose)


    } catch (err){
      l('error from transcribe')
      l(err);

      reject(err);

      throw new Error(err)
    }

  });

}

module.exports = transcribe;
