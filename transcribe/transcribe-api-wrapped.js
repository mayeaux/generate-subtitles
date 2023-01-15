const which = require('which');
const spawn = require('child_process').spawn;
const { handleStdErr, handleStdOut, handleProcessClose } = require('../lib/transcribing')
const { buildArguments } = require('../lib/other-transcribing');
const {forHumans} = require("../helpers/helpers");
const fs = require("fs-extra");

l = console.log;

const whisperPath = which.sync('whisper')

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
      // save date when starting to see how long it's taking
      const startedAt = new Date().toUTCString();
      await createOrUpdateProcessingData(processingDataPath, {
        startedAt
      })

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
