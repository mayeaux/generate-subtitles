const fs = require('fs-extra');
const multer = require('multer');
const WebSocket = require('ws');

const createTranslatedFiles = require('../translate/create-translated-files');
const { forHumans } = require('../helpers/helpers');
const projectConstants = require('../constants/constants');
const { shouldTranslateFrom } = projectConstants;

// TODO: move to another directory
const outputFileExtensions = ['.srt', '.vtt', '.txt'];

const nodeEnvironment = process.env.NODE_ENV;
const libreTranslateHostPath = process.env.LIBRETRANSLATE;

l(`libreTranslateHostPath: ${libreTranslateHostPath}`);

const isProd = nodeEnvironment === 'production';

const storage = multer.diskStorage({
  // notice  you are calling the multer.diskStorage() method here, not multer()
  destination: function (req, file, cb) {
    cb(null, './uploads/');
  },
});

var upload = multer({ storage });

function buildArguments({ uploadedFilePath, language, model, sdHash }) {
  /** INSTANTIATE WHISPER PROCESS **/
  // queue up arguments, path is the first one
  let arguments = [];

  // first argument is path to file
  arguments.push(uploadedFilePath);

  // these don't have to be defined
  if (language) arguments.push('--language', language);
  if (model) arguments.push('--model', model);

  // TODO: add the max GPUS thing here
  if (isProd) {
    if (global.topLevelValue === 1) {
      arguments.push('--device', 'cuda:0');
    } else if (global.topLevelValue === 2) {
      arguments.push('--device', 'cuda:1');
    }
    toggleTopLevelValue();
  }

  // dont show the text output but show the progress thing
  arguments.push('--verbose', 'False');

  // folder to save .txt, .vtt and .srt
  arguments.push('-o', `transcriptions/${sdHash}`);

  l('transcribe arguments');
  l(arguments);

  return arguments;
}

function toggleTopLevelValue() {
  if (global.topLevelValue === 1) {
    global.topLevelValue = 2;
  } else if (global.topLevelValue === 2) {
    global.topLevelValue = 1;
  }
}

function autoDetectLanguage(dataAsString) {
  if (!dataAsString) return false;
  if (dataAsString.includes('Detected language:')) {
    // parse out the language from the console output
    return dataAsString.split(':')[1].substring(1).trimEnd();
  }
  return false;
}

/** write output to processing_data.json **/
async function writeToProcessingDataFile(processingDataPath, dataObject) {
  // save data to the file
  const processingDataExists = await fs.exists(processingDataPath);

  l('processingDataExists');
  l(processingDataExists);
  if (processingDataExists) {
    const fileData = await fs.readFile(processingDataPath, 'utf8');
    l('fileData');
    l(fileData);

    const existingProcessingData = JSON.parse(fileData);

    let merged = Object.assign({}, existingProcessingData, dataObject);

    await fs.writeFile(processingDataPath, JSON.stringify(merged), 'utf8');
  } else {
    await fs.writeFile(processingDataPath, JSON.stringify(dataObject), 'utf8');
  }
}

async function translateIfNeeded({
  language,
  shouldTranslate,
  processingDataPath,
  directoryAndFileName,
}) {
  const shouldTranslateFromLanguage = shouldTranslateFrom(language);
  l(`should translate from language: ${shouldTranslateFromLanguage}`);
  l(`libreTranslateHostPath: ${libreTranslateHostPath}`);
  l(`should translate: ${shouldTranslate}`);

  let translationStarted,
    translationFinished = false;
  /** AUTOTRANSLATE WITH LIBRETRANSLATE **/
  if (
    libreTranslateHostPath &&
    shouldTranslateFromLanguage &&
    shouldTranslate
  ) {
    l('hitting LibreTranslate');
    translationStarted = new Date();
    // hit libretranslate
    await createTranslatedFiles({
      directoryAndFileName,
      language,
    });

    await writeToProcessingDataFile(processingDataPath, {
      translationStartedAt: new Date(),
      status: 'translating',
    });
  }
}

async function saveTranscriptionCompletedInformation({ startingDate, sdHash }) {
  const processingDataPath = `./transcriptions/${sdHash}/processing_data.json`;

  // just post-processing, you can return the response
  const processingSeconds = Math.round((new Date() - startingDate) / 1000);

  await writeToProcessingDataFile(processingDataPath, {
    processingSeconds,
    processingSecondsHumanReadable: forHumans(processingSeconds),
    startedAt: startingDate.toUTCString(),
    finishedAT: new Date().toUTCString(),
  });
}

async function moveAndRenameFilesAndFolder({
  originalUpload,
  uploadFileName,
  sdHash,
  originalFileExtension,
}) {
  const originalUploadPath = originalUpload;

  // the directory with the output from whisper
  let currentContainingDir = `./transcriptions/${sdHash}`;

  const newUploadPath = `${currentContainingDir}/${sdHash}${originalFileExtension}`;

  // rename original upload to use the original file upload name
  await fs.move(originalUploadPath, newUploadPath);

  // move each of the different output files
  for (const fileExtension of outputFileExtensions) {
    // create the prepend thing to loop over
    const transcribedFilePath = `${currentContainingDir}/${uploadFileName}${fileExtension}`;
    const newTranscribedFilePath = `${currentContainingDir}/${sdHash}${fileExtension}`;

    // rename
    await fs.move(transcribedFilePath, newTranscribedFilePath);
  }

  // rename containing dir to the safe filename (from upload filename);
  // const renamedDirectory = `./transcriptions/${sixDigitNumber}`;
  // await fs.rename(currentContainingDir, renamedDirectory);
}

function generateFileDetailsString(
  directorySafeFileNameWithExtension,
  displayLanguage,
  model,
  uploadDurationInSeconds,
  uploadDurationInSecondsHumanReadable
) {
  return `
  filename: ${directorySafeFileNameWithExtension}
  language: ${displayLanguage}
  model: ${model}
  uploadDurationInSeconds: ${uploadDurationInSeconds}
  uploadDurationInSecondsHumanReadable: ${uploadDurationInSecondsHumanReadable}
`.replace(/^ +/gm, ''); // remove indentation
}

function passDataToAllOpenSocket (websocketConnection,processingString,ownershipPerson,serverNumber,formattedProgress,percentDoneAsNumber,timeRemaining,speed){
  if (websocketConnection.readyState === WebSocket.OPEN) {
    /** websocketData message **/
    websocketConnection.send(JSON.stringify({
      message: 'websocketData',
      processingData: processingString,
      // processingData: data.toString(),
      ownershipPerson,
      serverNumber, // on the frontend we'll react different if it it's on server 1 or two
      formattedProgress,
      percentDone: percentDoneAsNumber,
      timeRemaining,
      speed,
    }));
  }
}

function sendToWebsocket(websocketConnection, data) {
  websocketConnection.send(JSON.stringify(data), function () {});
}

function sendFileInfoToClient(originalFileNameWithExtension,processingSeconds,language,model,uploadFolderFileName,uploadDurationInSeconds,uploadDurationInSeconds,processingRatio,startingDate){
  return ` filename: ${originalFileNameWithExtension}
    processingSeconds: ${processingSeconds}
    processingSecondsHumanReadable: ${forHumans(processingSeconds)}
    language: ${language}
    model: ${model}
    upload: ${uploadFolderFileName}
    uploadDurationInSeconds: ${uploadDurationInSeconds}
    uploadDurationInSecondsHumanReadable: ${forHumans(uploadDurationInSeconds)}
    processingRatio: ${processingRatio}
    startedAt: ${startingDate.toUTCString()}
    finishedAT: ${new Date().toUTCString()}
  `.replace(/^ +/gm, ''); // remove indentation
}

module.exports = {
  moveAndRenameFilesAndFolder,
  saveTranscriptionCompletedInformation,
  translateIfNeeded,
  buildArguments,
  autoDetectLanguage,
  writeToProcessingDataFile,
  sendToWebsocket,
  generateFileDetailsString,
  passDataToAllOpenSocket,
  sendFileInfoToClient,
  upload,
};
