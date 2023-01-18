const which = require('which');
const spawn = require('child_process').spawn;
const { handleStdErr, handleStdOut, handleProcessClose } = require('../lib/transcribing')
const { buildArguments } = require('../lib/other-transcribing');
const {forHumans} = require("../helpers/helpers");
const fs = require("fs-extra");
const { getLanguageCodeForAllLanguages } = require("../constants/constants");

l = console.log;

const serverType = process.env.SERVER_TYPE || 'both';
let storageFolder = `${process.cwd()}/transcriptions`;

if(serverType === 'transcribe'){
  storageFolder = `${process.cwd()}/api-transcriptions`;
}

async function createOrUpdateProcessingData(processingPath, objectToMerge){
  l('processinGPath');
  l(processingPath)

  const dataExists = fs.existsSync(processingPath)

  let originalObject;
  if(dataExists){
    // read the original JSON file
    const originalData = fs.readFileSync(processingPath, 'utf8');
    // parse the JSON string into an object
    originalObject = JSON.parse(originalData);
  } else {
    originalObject = {};
  }

  // merge the updateObject into originalObject
  let mergedObject = Object.assign(originalObject, objectToMerge);

//stringify the updated object
  let updatedData = JSON.stringify(mergedObject);

  fs.writeFileSync(processingPath, updatedData);
}


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
      const processingDataPath = `${storageFolder}/${numberToUse}/processing_data.json`

      // TODO: pull into function
      const initialWriteData = {
        startedAt: new Date().toUTCString(), // save date when starting to see how long it's taking
        model,
        numberToUse,
        language
      }

      if(language !== 'auto-detect'){
        initialWriteData.languageCode = getLanguageCodeForAllLanguages(language);
      }

      await createOrUpdateProcessingData(processingDataPath, initialWriteData)

      const whisperArguments = buildArguments({
        uploadedFilePath: uploadFilePath, // file to use
        language, //
        model,
        numberToUse,
      })

      l('whisperArguments');
      l(whisperArguments);

      // const thing = {
      //   processingSeconds,
      //   processingSecondsHumanReadable: forHumans(processingSeconds),
      //   upload: uploadFolderFileName, // used?
      //   uploadDurationInSecondsHumanReadable,
      //   processingRatio,
      //   startedAt: startingDate.toUTCString(),
      //   finishedAT: new Date().toUTCString(),
      //   status: 'completed',
      //   wordCount,
      //   wordsPerMinute,
      //   characterCount: strippedText.length,
      // }

      const whisperPath = which.sync('whisper')

      // start whisper process
      const whisperProcess = spawn(whisperPath, whisperArguments);

      whisperProcess.stdout.on('data',  handleStdOut({ processingDataPath }));

      /** console output from stderr **/ // (progress comes through stderr for some reason)
      whisperProcess.stderr.on('data', handleStdErr({ originalFileName, processingDataPath }));

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
