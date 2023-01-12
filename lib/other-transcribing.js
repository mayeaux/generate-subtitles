const fs = require('fs-extra');
const createTranslatedFiles = require('../translate/create-translated-files');
const {forHumans} = require('../helpers/helpers');

// TODO: move to another directory
const outputFileExtensions = ['.srt', '.vtt', '.txt']

const nodeEnvironment = process.env.NODE_ENV;
const libreTranslateHostPath = process.env.LIBRETRANSLATE;

const isProd = nodeEnvironment === 'production';

function buildArguments ({
  uploadedFilePath,
  language,
  model,
  numberToUse
}) {
  /** INSTANTIATE WHISPER PROCESS **/
    // queue up arguments, path is the first one
  let arguments = [];

  // first argument is path to file
  arguments.push(uploadedFilePath);

  // these don't have to be defined
  if (language) arguments.push('--language', language);
  if (model) arguments.push('--model', model);

  // dont show the text output but show the progress thing
  arguments.push('--verbose', 'False');

  // folder to save .txt, .vtt and .srt
  arguments.push('-o', `transcriptions/${numberToUse}`);

  l('transcribe arguments');
  l(arguments);

  return arguments
}

async function translateIfNeeded ({ language, shouldTranslate, processingDataPath, directoryAndFileName}) {
  const shouldTranslateFromLanguage = shouldTranslateFrom(language);
  l(`should translate from language: ${shouldTranslateFromLanguage}`)
  l(`libreTranslateHostPath: ${libreTranslateHostPath}`)
  l(`should translate: ${shouldTranslate}`)

  let translationStarted, translationFinished = false;
  /** AUTOTRANSLATE WITH LIBRETRANSLATE **/
  if (libreTranslateHostPath && shouldTranslateFromLanguage && shouldTranslate) {
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

async function saveTranscriptionCompletedInformation ({
  startingDate,
  sdHash
}) {
  const processingDataPath = `./transcriptions/${sdHash}/processing_data.json`;

  // just post-processing, you can return the response
  const processingSeconds = Math.round((new Date() - startingDate) / 1000);

  await writeToProcessingDataFile(processingDataPath, {
    processingSeconds,
    processingSecondsHumanReadable: forHumans(processingSeconds),
    startedAt: startingDate.toUTCString(),
    finishedAT: new Date().toUTCString(),
  })
}

async function moveAndRenameFilesAndFolder ({
  originalUpload,
  uploadFileName,
  sdHash,
  originalFileExtension,
}) {
  const originalUploadPath = originalUpload;

  // the directory with the output from whisper
  let currentContainingDir = `./transcriptions/${sdHash}`;

  const newUploadPath = `${currentContainingDir}/${sdHash}${originalFileExtension}`

  // rename original upload to use the original file upload name
  await fs.move(originalUploadPath, newUploadPath)

  // move each of the different output files
  for (const fileExtension of outputFileExtensions) {
    // create the prepend thing to loop over
    const transcribedFilePath = `${currentContainingDir}/${uploadFileName}${fileExtension}`
    const newTranscribedFilePath = `${currentContainingDir}/${sdHash}${fileExtension}`

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
  // autoDetectLanguage,
  // writeToProcessingDataFile
}
