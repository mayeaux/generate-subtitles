const which = require("which");
const spawn = require('child_process').spawn;
const fs = require('fs-extra');
const ffprobe = require('ffprobe');
const WebSocket = require('ws');
var convert = require('cyrillic-to-latin')
const projectConstants = require('./constants');
const { shouldTranslateFrom, languagesToTranscribe, translationLanguages, getLanguageCodeForAllLanguages } = projectConstants;
const forHumans = require('./helpers').forHumans;
const createTranslatedFiles = require('./translate-files-api');
const {formatStdErr} = require("./formatStdErr");
const LTHost = process.env.LIBRETRANSLATE;

const {
  autoDetectLanguage,
  buildArguments,
  moveAndRenameFilesAndFolder,
  saveTranscriptionCompletedInformation,
  writeToProcessingDataFile,
} = require('./transcribing');

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
  sixDigitNumber // standin for claimId or something like that
}){
  return new Promise(async (resolve, reject) => {
    try {
      const originalUpload = `./uploads/${uploadFileName}`;
      const processingDataPath = `./transcriptions/${sixDigitNumber}/processing_data.json`;

      await fs.mkdirp(`./transcriptions/${sixDigitNumber}`);

      l('transcribe arguments');
      l(arguments);

      // save date when starting to see how long it's taking
      const startingDate = new Date();
      l(startingDate);

      const whisperProcess = spawn(whisperPath, buildArguments({
        uploadedFilePath: originalUpload, // file to use
        language, //
        model,
        sixDigitNumber,
      }));

      // allow you to find the language
      let foundLanguage;

      /**  console output from stdoutt **/
      async function handleStdOut(data){
        l(`STDOUT: ${data}`)

        // save auto-detected language
        const parsedLanguage = autoDetectLanguage(data.toString());
        if(parsedLanguage) foundLanguage = parsedLanguage;
      }

      async function handleStdErr(data){
        l(`STDERR: ${data}`)

        // get value from the whisper output string
        const formattedProgress = formatStdErr(data.toString());
        l('formattedProgress');
        l(formattedProgress);

        const { percentDoneAsNumber, percentDone, speed, timeRemaining  } = formattedProgress;

        await writeToProcessingDataFile(processingDataPath, {
          progress: percentDoneAsNumber,
          status: 'processing',
          model,
          language,
          originalFileName
        })

        // when over 0%, mark as started successfully
        if(percentDoneAsNumber > 0 && !responseSent){
          responseSent = true;
          resolve('started')
        }
      }

      whisperProcess.stdout.on('data', handleStdOut);

      let responseSent = false;

      /** console output from stderr **/ // (progress comes through stderr for some reason)
      whisperProcess.stderr.on('data', handleStdErr);

      async function handleProcessSuccess(){
        // move to the sixDigitNumber directory
        await moveAndRenameFilesAndFolder({
          originalUpload,
          uploadFileName,
          sixDigitNumber,
          originalFileExtension,
        })

        // save processing data with info
        await saveTranscriptionCompletedInformation({
          startingDate,
          sixDigitNumber,
        })

        const directoryAndFileName = `./transcriptions/${sixDigitNumber}/${sixDigitNumber}`

        const shouldTranslate = true;
        if(shouldTranslate && LTHost){
          l('hitting LibreTranslate');
          await createTranslatedFiles({
            directoryAndFileName,
            language,
          })
        }
      }

      async function handleProcessClose(code){
          const processFinishedSuccessfully = code === 0;
          l(`code: ${code}`);

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

          l(`child process exited with code ${code}`);
      }

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
