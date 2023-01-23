const fs = require('fs-extra');
const {autoDetectLanguage} = require('../transcribe/transcribing');
const {formatStdErr} = require('../helpers/formatStdErr');
const { getLanguageCodeForAllLanguages } = require('../constants/constants');
const filenamify = require('filenamify');
const path = require('path');

async function writeToProcessingDataFile (processingDataPath, dataObject) {
  // save data to the file
  const processingDataExists = await fs.exists(processingDataPath)

  l('processingDataExists')
  l(processingDataExists);
  if (processingDataExists) {
    const fileData = await fs.readFile(processingDataPath, 'utf8')
    l('fileData');
    l(fileData);

    const existingProcessingData = JSON.parse(fileData);

    let merged = Object.assign({}, existingProcessingData, dataObject);

    l('merged');
    l(merged);

    await fs.writeFile(processingDataPath, JSON.stringify(merged), 'utf8');
  } else {
    await fs.writeFile(processingDataPath, JSON.stringify(dataObject), 'utf8');
  }
}

function detectLanguageFromString (dataAsString) {
  if (!dataAsString) return false
  if (dataAsString.includes('Detected language:')) {
    // parse out the language from the console output
    return dataAsString.split(':')[1].substring(1).trimEnd();
  }
  return false;
}

function handleStdOut (data) {
  l(`STDOUT: ${data}`)

  // save auto-detected language
  const parsedLanguage = autoDetectLanguage(data.toString());
  return parsedLanguage
}

// print the latest progress and save it to the processing data file
function handleStdErr ({
 model, language, originalFileName, processingDataPath
}) {
  return function (data) {
    (async function () {
      l(`STDERR: ${data}`)

      // get value from the whisper output string
      const formattedProgress = formatStdErr(data.toString());
      l('formattedProgress');
      l(formattedProgress);

      const { percentDoneAsNumber, percentDone, speed, timeRemaining  } = formattedProgress;

      // TODO: add speed here and timeremaining

      // save info to processing_data.json
      await writeToProcessingDataFile(processingDataPath, {
        progress: percentDoneAsNumber,
        status: 'processing',
        model,
        language,
        languageCode: getLanguageCodeForAllLanguages(language),
        originalFileName
      })

    })()
  }
}

const outputFileExtensions = ['.srt', '.vtt', '.txt']

// rename files to proper names for api (remove file extension)
async function moveFiles (randomNumber, fileExtension) {
  const holderFolder = `${process.cwd()}/transcriptions/${randomNumber}`;
  for (const extension of outputFileExtensions) {
    const oldLocation = `${holderFolder}/${randomNumber}.${fileExtension}${extension}`
    await fs.move(oldLocation, `${holderFolder}/${randomNumber}${extension}`)
  }
}

// when whisper process finishes
function handleProcessClose ({ processingDataPath, originalUpload, numberToUse }) {
  return function (code) {
    (async function () {
      l(`PROCESS FINISHED WITH CODE: ${code}`)

      const processFinishedSuccessfullyBasedOnStatusCode = code === 0;

      // if process failed
      if (!processFinishedSuccessfullyBasedOnStatusCode) {
        // if process errored out
        await writeToProcessingDataFile(processingDataPath, {
          status: 'error',
          error: 'whisper process failed'
        })

        // throw error if failed
        throw new Error('Whisper process did not exit successfully');
      } else {
        // // TODO: pass file extension to this function
        // const fileExtension = originalUpload.split('.').pop();
        //
        // // rename whisper created files
        // await moveFiles(numberToUse, fileExtension)

        // save mark upload as completed transcribing
        await writeToProcessingDataFile(processingDataPath, {
          status: 'completed',
        })

      }
    })()
  }
}

// example file from multer
// {
//   fieldname: 'file',
//   originalname: 'dutch_language.mp3',
//   encoding: '7bit',
//   mimetype: 'audio/mpeg',
//   destination: './uploads/',
//   filename: '572fa0ecb660b1d0eb489b879c2e2310',
//   path: 'uploads/572fa0ecb660b1d0eb489b879c2e2310',
//   size: 22904865
// }

// make sure the file name is safe for the file system
const makeFileNameSafe = function (string) {
  return filenamify(string, {replacement: '_' }) // replace all non-URL-safe characters with an underscore
    .split('：').join(':') // replace chinese colon with english colon
    .replace(/[&\/\\#,+()$~%.'":*?<>{}!]/g, '') // remove special characters
    .replace(/\s+/g,'_') // replace spaces with underscores
}

//
function createFileNames (originalFileName) {
  // name of file without extension
  const originalFileNameWithoutExtension = path.parse(originalFileName).name;

  return {
    originalFileNameWithExtension: originalFileName, // original file name
    originalFileExtension: path.parse(originalFileName).ext, // file extension
    originalFileNameWithoutExtension, // file name with extension removed
    directorySafeFileNameWithoutExtension: makeFileNameSafe(originalFileNameWithoutExtension), // safe file name for directory name
  }
}

module.exports = {
  // handle processing data file
  writeToProcessingDataFile,

  detectLanguageFromString,

  // handle output from the whisper process
  handleStdOut,
  handleStdErr,
  handleProcessClose,

  // file name helpers
  makeFileNameSafe,
  createFileNames
}