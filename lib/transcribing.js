const fs = require('fs-extra');
const {autoDetectLanguage} = require('../lib/other-transcribing');
const {formatStdErr} = require('../helpers/formatStdErr');
const { getLanguageCodeForAllLanguages } = require('../constants/constants');
const filenamify = require('filenamify');
const path = require('path');
const moment = require('moment');
const createTranslatedFiles = require('../translate/create-translated-files');
const {stripOutTextAndTimestamps} = require('../translate/helpers');
const {forHumans} = require('../helpers/helpers');
const { exec } = require('child_process');
const cancelProcessByNumberToUse = require('./cancelProcessByNumberToUse');

const options = { encoding: 'utf8', overwrite: true, };

const serverType = process.env.SERVER_TYPE || 'both';

let storageFolder = `${process.cwd()}/transcriptions`;
if (serverType === 'transcribe') {
  storageFolder = `${process.cwd()}/api-transcriptions`;
}

async function writeToProcessingDataFile (processingDataPath, dataObject) {
  // save data to the file
  const processingDataExists = await fs.exists(processingDataPath)
  //
  // l('processingDataExists')
  // l(processingDataExists);
  if (processingDataExists) {
    const fileData = fs.readFileSync(processingDataPath, 'utf8')
    // l('fileData');
    // l(fileData);

    const existingProcessingData = JSON.parse(fileData);

    let merged = Object.assign({}, existingProcessingData, dataObject);

    // l('merged');
    // l(merged);

    fs.writeFileSync(processingDataPath, JSON.stringify(merged), options);

  } else {
    fs.writeFileSync(processingDataPath, JSON.stringify(dataObject), options);
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

function handleStdOut ({ data }) {
  l(`STDOUT: ${data}`)

  // save auto-detected language
  const parsedLanguage = autoDetectLanguage(data.toString());
  return parsedLanguage
}

// print the latest progress and save it to the processing data file
function handleStdOut ({
 processingDataPath
}) {
  return function (data) {
    (async function () {
      l(`STDOUT: ${data}`)

      const dataAsString = data.toString();

      if (dataAsString.includes('Detected language:')) {

        // parse out the language from the console output
        const foundLanguage = dataAsString.split(':')[1].substring(1).trimEnd();

        // save info to processing_data.json
        await writeToProcessingDataFile(processingDataPath, {
          language: foundLanguage,
          autoDetectedLanguage: true,
          languageCode: getLanguageCodeForAllLanguages(foundLanguage),
        });

        // process.exit(0);
      }
    })()
  }
}

// print the latest progress and save it to the processing data file
function handleStdErr ({
 originalFileName, processingDataPath
}) {
  return function (data) {
    (async function () {
      l(`STDERR: ${data}`)

      // get value from the whisper output string
      const formattedProgress = formatStdErr(data.toString());
      // l('formattedProgress');
      // l(formattedProgress);
      //
      // l('originalFileName');
      // l(originalFileName)

      const { percentDoneAsNumber, percentDone, speed, timeRemaining  } = formattedProgress;

      // TODO: add speed here and timeremaining

      // save info to processing_data.json
      await writeToProcessingDataFile(processingDataPath, {
        progress: percentDoneAsNumber,
        status: 'processing',
        originalFileName,
        formattedProgress
      })

    })()
  }
}

const outputFileExtensions = ['.srt', '.vtt', '.txt']

// rename files to proper names for api (remove file extension)
async function moveFiles (randomNumber, fileExtension) {
  const holderFolder = `${storageFolder}/${randomNumber}`;
  for (const extension of outputFileExtensions) {
    const oldLocation = `${holderFolder}/${randomNumber}.${fileExtension}${extension}`
    await fs.move(oldLocation, `${holderFolder}/${randomNumber}${extension}`)
  }
}

async function getOriginalFilesObject (numberToUse) {
  const originalFileOutputs = ['.srt', '.vtt', '.txt']

  const originalFileObject = {
    srtData: '',
    vttData: '',
    txtData: ''
  }

  // containingFolder
  const containingFolder = `${storageFolder}/${numberToUse}`;

  // loop through extensions
  for (const fileExtension of originalFileOutputs) {
    const filePath = `${containingFolder}/${numberToUse}${fileExtension}`
    if (fileExtension === '.txt') {
      const textFile = await fs.readFile(filePath, 'utf8')
      originalFileObject.txtData = textFile;
    }
    if (fileExtension === '.srt') {
      const srtFile = await fs.readFile(filePath, 'utf8')
      originalFileObject.srtData = srtFile;
    }
    if (fileExtension === '.vtt') {
      const vttFile = await fs.readFile(filePath, 'utf8');
      originalFileObject.vttData = vttFile;
    }
  }

  return originalFileObject
}

// when whisper process finishes
function handleProcessClose ({ processingDataPath, originalUpload, numberToUse }) {
  return function (code) {
    (async function () {
      l(`PROCESS FINISHED WITH CODE: ${code}`)

      const getProcessingData = await fs.readFile(processingDataPath, 'utf8')
      const processingData = JSON.parse(getProcessingData);

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

        const { srtData, txtData, vttData } = await getOriginalFilesObject(numberToUse)

        const fullPathWithoutExtension = `${storageFolder}/${numberToUse}/${numberToUse}`;

        const vttFile = `${storageFolder}/${numberToUse}/${numberToUse}.vtt`;

        const { strippedText, timestampsArray } = await stripOutTextAndTimestamps(vttFile)

        const { language, shouldTranslate } = processingData;
        l('shouldTranslate', shouldTranslate)
        l('language', language)

        let translatedFiles = [];
        let translatedLanguages = [];
        if (shouldTranslate) {
          await writeToProcessingDataFile(processingDataPath, {
            status: 'translating',
          })

          // save data to the file
          translatedFiles = await createTranslatedFiles({
            directoryAndFileName: fullPathWithoutExtension,
            language, // languages is not currently used now
            strippedText,
            timestampsArray,
            vttData
          })

          if (translatedFiles) {
            translatedLanguages = translatedFiles.map(file => file.language)

            // TODO: technically wrong, needs this:
            // if (translationStartedAndCompleted) {
            //   // TODO: this is named wrong, should be languagesToTranslateTo
            //   // remove the original language from languagesToTranslateTo
            //   translatedLanguages = languagesToTranscribe.filter(e => e !== language);
            // }

          }
        }

        // TODO: pull out into function
        const { startedAt, uploadDurationInSeconds } = processingData;

        // just post-processing, you can return the response
        const processingSeconds = Math.round((new Date() - new Date(startedAt)) / 1000);
        const processingRatio = (uploadDurationInSeconds/processingSeconds).toFixed(2);

        const wordCount = strippedText.split(' ').length;
        const wordsPerMinute = Math.round(wordCount / (uploadDurationInSeconds / 60));

        const postProcessingData = {
          processingSeconds,
          processingSecondsHumanReadable: forHumans(processingSeconds),
          uploadDurationInSecondsHumanReadable: forHumans(uploadDurationInSeconds),
          processingRatio,
          finishedAt: new Date().toUTCString(),
          status: 'completed',

          wordCount,
          wordsPerMinute,
          characterCount: strippedText.length,
          strippedText,
          timestampsArray,
        }

        // save mark upload as completed transcribing
        await writeToProcessingDataFile(processingDataPath, {
          status: 'completed',
          srtData,
          txtData,
          vttData,
          translatedFiles,
          translatedLanguages,
          ...postProcessingData
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

  const originalFileExtension = path.parse(originalFileName).ext;

  const directorySafeFileNameWithoutExtension = makeFileNameSafe(originalFileNameWithoutExtension) // safe file name for directory name

  // used for the final media resting place
  const directorySafeFileNameWithExtension = `${directorySafeFileNameWithoutExtension}${originalFileExtension}`

  const timestampString = moment(new Date()).format('DD-MMMM-YYYY_HH_mm_ss');

  const separator = '--'

  const fileSafeNameWithDateTimestamp = `${directorySafeFileNameWithoutExtension}${separator}${timestampString}`;

  const fileSafeNameWithDateTimestampAndExtension = `${directorySafeFileNameWithoutExtension}${separator}${timestampString}${originalFileExtension}`;


  return {
    originalFileNameWithExtension: originalFileName, // original file name
    originalFileExtension, // file extension
    originalFileNameWithoutExtension, // file name with extension removed
    directorySafeFileNameWithExtension,
    fileSafeNameWithDateTimestamp,
    fileSafeNameWithDateTimestampAndExtension,
    directorySafeFileNameWithoutExtension, // safe file name for directory name
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
  createFileNames,

  getOriginalFilesObject,
}