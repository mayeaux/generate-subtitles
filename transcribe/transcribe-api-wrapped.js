const which = require('which');
const spawn = require('child_process').spawn;
const { handleStdErr, handleStdOut, handleProcessClose } = require('../lib/transcribing')

const {
  buildArguments,
} = require('./transcribing');

l = console.log;

const whisperPath = which.sync('whisper')

async function transcribe ({
  language,
  model,
  originalFileExtension,
  uploadFileName,
  originalFileName,
  uploadFilePath,
  numberToUse, // random or websocket number (websocket if being used from frontend)
}) {
  return new Promise(async (resolve, reject) => {
    try {
      // where app.js is running from
      const processDir = process.cwd()

      // original upload file path
      const originalUpload = `${processDir}/uploads/${uploadFileName}`;

      //
      const processingDataPath = `${processDir}/transcriptions/${numberToUse}/processing_data.json`

      // save date when starting to see how long it's taking
      const startingDate = new Date();
      l(startingDate);

      const whisperArguments = buildArguments({
        uploadedFilePath: uploadFilePath, // file to use
        language, //
        model,
        numberToUse,
      })

      l('whisperArguments');
      l(whisperArguments);

      // start whisper process
      const whisperProcess = spawn(whisperPath, whisperArguments);

      // TODO: implement foundLanguagae here
      // let foundLanguage;
      whisperProcess.stdout.on('data',  (data) => l(`STDOUT: ${data}`));

      /** console output from stderr **/ // (progress comes through stderr for some reason)
      whisperProcess.stderr.on('data', handleStdErr({ model, language, originalFileName, processingDataPath }));

      /** whisper responds with 0 or 1 process code **/
      whisperProcess.on('close', handleProcessClose({ processingDataPath, originalUpload, numberToUse }))


    } catch (err) {
      l('error from transcribe')
      l(err);

      reject(err);

      throw new Error(err)
    }

  });

}

module.exports = transcribe;
