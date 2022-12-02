const fs = require("fs-extra");
const createTranslatedFiles = require("./create-translated-files");
const {forHumans} = require("./helpers");

// TODO: move to another directory
const outputFileExtensions = ['.srt', '.vtt', '.txt']

const nodeEnvironment = process.env.NODE_ENV;
const libreTranslateHostPath = process.env.LIBRETRANSLATE;

l(`libreTranslateHostPath: ${libreTranslateHostPath}`)

const isProd = nodeEnvironment === 'production';

function buildArguments({
  uploadedFilePath,
  language,
  model,
  sixDigitNumber
}){
  /** INSTANTIATE WHISPER PROCESS **/
    // queue up arguments, path is the first one
  let arguments = [];

  // first argument is path to file
  arguments.push(uploadedFilePath);

  // these don't have to be defined
  if(language) arguments.push('--language', language);
  if(model) arguments.push('--model', model);

  // TODO: add the max GPUS thing here
  if(isProd){
    if(global.topLevelValue === 1){
      arguments.push('--device', 'cuda:0');
    } else if(global.topLevelValue === 2){
      arguments.push('--device', 'cuda:1');
    }
    toggleTopLevelValue();
  }

  // dont show the text output but show the progress thing
  arguments.push('--verbose', 'False');

  // folder to save .txt, .vtt and .srt
  arguments.push('-o', `transcriptions/${sixDigitNumber}`);

  l('transcribe arguments');
  l(arguments);

  return arguments
}

function toggleTopLevelValue(){
  if(global.topLevelValue === 1){
    global.topLevelValue = 2
  } else if(global.topLevelValue === 2){
    global.topLevelValue = 1
  }
}

function autoDetectLanguage(dataAsString){
  if(!dataAsString) return false
  if(dataAsString.includes('Detected language:')){
    // parse out the language from the console output
    return dataAsString.split(':')[1].substring(1).trimEnd();
  }
  return false;
}

/** write output to processing_data.json **/
async function writeToProcessingDataFile(processingDataPath, dataObject){
  // save data to the file
  const processingDataExists = await fs.exists(processingDataPath)

  l('processingDataExists')
  l(processingDataExists);
  if(processingDataExists){
    const fileData = await fs.readFile(processingDataPath, 'utf8')
    l('fileData');
    l(fileData);

    const existingProcessingData = JSON.parse(fileData);

    let merged = Object.assign({}, existingProcessingData, dataObject);

    await fs.writeFile(processingDataPath, JSON.stringify(merged), 'utf8');
  } else {
    await fs.writeFile(processingDataPath, JSON.stringify(dataObject), 'utf8');
  }
}

async function translateIfNeeded({ language, shouldTranslate, processingDataPath, directoryAndFileName}){
  const shouldTranslateFromLanguage = shouldTranslateFrom(language);
  l(`should translate from language: ${shouldTranslateFromLanguage}`)
  l(`libreTranslateHostPath: ${libreTranslateHostPath}`)
  l(`should translate: ${shouldTranslate}`)

  let translationStarted, translationFinished = false;
  /** AUTOTRANSLATE WITH LIBRETRANSLATE **/
  if(libreTranslateHostPath && shouldTranslateFromLanguage && shouldTranslate){
    l('hitting LibreTranslate');
    translationStarted = new Date();
    // hit libretranslate
    await createTranslatedFiles({
      directoryAndFileName,
      language,
    })

    await writeToProcessingDataFile(processingDataPath, {
      translationStartedAt: new Date(),
      status: 'translating',
    })
  }
}

async function saveTranscriptionCompletedInformation({
  startingDate,
  sixDigitNumber
}){
  function getUploadDurationInSeconds(){
    // FPROBE: get the duration
  }

  const processingDataPath = `./transcriptions/${sixDigitNumber}/processing_data.json`;

  // just post-processing, you can return the response
  const processingSeconds = Math.round((new Date() - startingDate) / 1000);

  await writeToProcessingDataFile(processingDataPath, {
    processingSeconds,
    processingSecondsHumanReadable: forHumans(processingSeconds),
    startedAt: startingDate.toUTCString(),
    finishedAT: new Date().toUTCString(),
    status: 'completed',
  })
}

async function moveAndRenameFilesAndFolder({
  originalUpload,
  uploadFileName,
  sixDigitNumber,
  originalFileExtension,
}){
  const originalUploadPath = originalUpload;

  // the directory with the output from whisper
  let currentContainingDir = `./transcriptions/${sixDigitNumber}`;

  const newUploadPath = `${currentContainingDir}/${sixDigitNumber}${originalFileExtension}`

  // rename original upload to use the original file upload name
  await fs.move(originalUploadPath, newUploadPath)

  // move each of the different output files
  for(const fileExtension of outputFileExtensions){
    // create the prepend thing to loop over
    const transcribedFilePath = `${currentContainingDir}/${uploadFileName}${fileExtension}`
    const newTranscribedFilePath = `${currentContainingDir}/${sixDigitNumber}${fileExtension}`

    // rename
    await fs.move(transcribedFilePath, newTranscribedFilePath)
  }

  // rename containing dir to the safe filename (from upload filename)
  // const renamedDirectory = `./transcriptions/${sixDigitNumber}`;
  // await fs.rename(currentContainingDir, renamedDirectory)
}

module.exports = {
  moveAndRenameFilesAndFolder,
  saveTranscriptionCompletedInformation,
  translateIfNeeded,
  buildArguments,
  autoDetectLanguage,
  writeToProcessingDataFile
}
