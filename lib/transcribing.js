const fs = require('fs-extra');
const filenamify = require('filenamify');
const path = require('path');
const mpvAPI = require('node-mpv');
const moment = require('moment/moment');

const {autoDetectLanguage} = require('../transcribe/transcribing');
const {formatStdErr} = require('../helpers/formatStdErr');
const {getLanguageCodeForAllLanguages} = require('../constants/constants');
const { stripOutTextAndTimestamps } = require('../translate/helpers');
const { convertSerbianCyrillicToLatin, convertChineseTraditionalToSimplified } = require('./convertText');
const {sendToWebsocket, forHumansNoSeconds, toTitleCase} = require('../helpers/helpers');
const createTranslatedFiles = require('../translate/create-translated-files');


const isProd = process.env.NODE_ENV === 'production';
const multipleGpusEnabled = process.env.MULTIPLE_GPUS === 'true';

async function writeToProcessingDataFile (processingDataPath, dataObject) {
  // save data to the file
  const processingDataExists = await fs.exists(processingDataPath)

  l({processingDataExists});
  if (processingDataExists) {
    const fileData = await fs.readFile(processingDataPath, 'utf8')
    l({fileData});

    const existingProcessingData = JSON.parse(fileData);

    let merged = Object.assign({}, existingProcessingData, dataObject);

    await fs.writeFile(processingDataPath, JSON.stringify(merged), 'utf8');
  } else {
    await fs.writeFile(processingDataPath, JSON.stringify(dataObject), 'utf8');
  }
}

function handleStdOut (data) {
  l(`STDOUT: ${data}`)

  // save auto-detected language
  const parsedLanguage = autoDetectLanguage(data.toString());
  return parsedLanguage
}

function handleStdErr ({
 model, language, fileNameWithExtension, processingDataPath
}) {
  return function (data) {
    (async function () {
      l(`STDERR: ${data}`)

      // get value from the whisper output string
      const formattedProgress = formatStdErr(data.toString());
      l({formattedProgress});

      const { percentDoneAsNumber, percentDone, speed, timeRemaining  } = formattedProgress;

      // save info to processing_data.json
      await writeToProcessingDataFile(processingDataPath, {
        progress: percentDoneAsNumber,
        status: 'processing',
        model,
        language,
        languageCode: getLanguageCodeForAllLanguages(language),
        fileNameWithExtension
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
function handleProcessClose ({ processingDataPath, originalUpload, randomNumber }) {
  return function (code) {
    (async function () {
      l(`STDERR: ${code}`)


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
        // TODO: pass file extension to this function
        const fileExtension = originalUpload.split('.').pop();

        // move transcribed file to the correct location (TODO: do this before transcribing)
        await fs.move(originalUpload, `${process.cwd()}/transcriptions/${randomNumber}/${randomNumber}.${fileExtension}`)

        // rename whisper created files
        await moveFiles(randomNumber, fileExtension)

        // save mark upload as completed transcribing
        await writeToProcessingDataFile(processingDataPath, {
          status: 'completed',
        })

      }
    })()
  }
}

const generateFileDetailsHTML = data => `
  <p>Filename: ${data.filename}</p>
  <p>Language: ${toTitleCase(data.language)}${data.isAutoDetected ? ' (Auto-Detected)' : ''}</p>
  <p>Model: ${toTitleCase(data.model)}</p>
  <p>Translating: ${data.shouldTranslate ? 'Yes' : 'No'}</p>
  <p>Upload Duration: ${data.uploadDuration}</p>
  <p>Started At: ${data.niceDate}</p>
`;

const generateCompletionDataHTML = data => `
  <p>Filename: ${data.filename}</p>
  <p>Processing Time: ${data.processingTime}</p>
  <p>Language: ${toTitleCase(data.language)}${data.isAutoDetected ? ' (Auto-Detected)' : ''}</p>
  <p>Model: ${toTitleCase(data.model)}</p>
  <p>Translating: ${data.shouldTranslate ? 'Yes' : 'No'}</p>
  <p>Upload Name: ${data.upload}</p>
  <p>Upload Duration: ${data.uploadDuration}</p>
  <p>Processing Ratio: ${data.processingRatio}</p>
  <p>Started At: ${data.startedAt}</p>
  <p>Finished At: ${data.finishedAt}</p>
`;

// Alternative method to get duration due to ffprobe limitation
const getDurationByMpv = async filePath => {
  const mpv = new mpvAPI({audio_only: true});
  await mpv.start();
  await mpv.load(filePath);
  await mpv.volume(0);
  const duration = await mpv.getDuration();
  mpv.stop();
  return duration;
};

const throwOffLimitsErrors = (res, duration, fileSize) => {
  const secondsInHour = 60 * 60;
  if (duration > secondsInHour) {
    const uploadLengthErrorMessage = `Your upload length is ${forHumansNoSeconds(duration)}, but currently the maximum length allowed is only 1 hour`;
    return res.status(400).send(uploadLengthErrorMessage);
  }
  if (fileSize > uploadLimitInMB) {
    const uploadSizeErrorMessage = `Your upload size is ${fileSize} MB, but the maximum size currently allowed is ${uploadLimitInMB} MB.`;
    return res.status(400).send(uploadSizeErrorMessage);
  }
}

const buildWhisperArguments = ({filePath, language, model, randomNumber}) => {
  // queue up arguments, path is the first one
  const arguments = [filePath];
      
  const languageIsAutoDetect = /auto-detect/i.test(language);
  
  // don't pass a language to use auto-detect
  !languageIsAutoDetect && arguments.push('--language', language);

  arguments.push(...[
    // model to use
    '--model', model,
    // dont show the text output but show the progress thing
    '--verbose', 'False',
    // folder to save .txt, .vtt and .srt
    '-o', 'transcriptions/' + randomNumber
  ]);

  // alternate
  // todo: do an 'express' queue and a 'large files' queue
  if (isProd && multipleGpusEnabled) {
    if (topLevelValue === 1) {
      arguments.push('--device', 'cuda:0');
    } else if (topLevelValue === 2) {
      arguments.push('--device', 'cuda:1');
    }
  }
  
  return arguments;
}

const convertLanguageText = async (language, path) => {
  // convert Serbian text from Cyrillic to Latin
  if (language === 'Serbian') {
    await convertSerbianCyrillicToLatin(path);
  }

  // convert Chinese characters to Simplified
  if (language === 'Chinese') {
    await convertChineseTraditionalToSimplified(path);
  }
}

const removeFromArrayByWsNumber = (array, wsNumber) => {
  return array.filter(item => item.websocketNumber !== wsNumber);
}

const updateDetectedLanguage = ({data, fileInfo, websocketConnection}) => {
  const dataAsString = data.toString();
  if (!dataAsString.includes('Detected language:')) return;
  const detectedLang = dataAsString.match(/Detected language: ([a-z]+)\b/i)[1];
  l(`DETECTED LANGUAGE FOUND: ${detectedLang}`);
  fileInfo.language = detectedLang;
  fileInfo.languageCode = getLanguageCodeForAllLanguages(detectedLang);
  fileInfo.isAutoDetected = true;
  fileInfo.fileDetailsHTML = generateFileDetailsHTML(fileInfo);
  sendToWebsocket(websocketConnection, {message: 'fileDetails', ...fileInfo});
  return detectedLang;
}

const handleTranslation = async (fileInfo, websocketConnection) => {
  sendToWebsocket(websocketConnection, {
    languageUpdate: 'Doing translations with LibreTranslate',
    message: 'languageUpdate'
  });
  l('hitting LibreTranslate');
  fileInfo.translationStarted = true;
  // hit libretranslate
  await createTranslatedFiles({
    directoryAndFileName: fileInfo.originalDirectoryAndNewFileName,
    language: fileInfo.language,
    websocketConnection,
    strippedText: fileInfo.strippedText,
    timestampsArray: fileInfo.timestampsArray,
  });
  
  fileInfo.translationFinished = true;
}

// need a better name?
const moveSubtitleFiles = async fileInfo => {
  
  await fs.move(fileInfo.originalUpload, `${fileInfo.originalContainingDir}/${fileInfo.safeFileNameWithExtension}`, {overwrite: true});

  fileInfo.srtPath = `${fileInfo.originalDirectoryAndNewFileName}.srt`;
  fileInfo.vttPath = `${fileInfo.originalDirectoryAndNewFileName}.vtt`;
  fileInfo.txtPath = `${fileInfo.originalDirectoryAndNewFileName}.txt`;

  /** COPY TO BETTER NAME, SRT, VTT, TXT **/
  const fileTypes = ['srt', 'vtt', 'txt'];

  // copy srt with the original filename
  for (const fileType of fileTypes) {
    await fs.move(`${fileInfo.originalContainingDir}/${fileInfo.upload}.${fileType}`, `${fileInfo.originalDirectoryAndNewFileName}.${fileType}`, {overwrite: true});
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
  return filenamify(string, {replacement: '_' }) // replace non-URL-safe characters with an underscore
    .split('：').join(':') // replace chinese colon with english colon
    .replace(/[&\/\\#,+()$~%.'":*?<>{}!]/g, '') // remove special characters
    .replace(/\s+/g,'_') // replace spaces with underscores
}

//
const createFileNames = fileNameWithExtension => {
  const {name: fileNameNoExtension, ext: fileExtension} = path.parse(fileNameWithExtension);
  const safeDirNameNoExtension = makeFileNameSafe(fileNameNoExtension);
  const timestampString = moment(new Date()).format('DD-MMMM-YYYY_HH_mm_ss');

  return {
    fileNameNoExtension,
    fileExtension,
    safeDirNameNoExtension,
    safeFileNameWithExtension: `${safeDirNameNoExtension}${fileExtension}`,
    safeFileNameWithDateTimestamp: `${safeDirNameNoExtension}--${timestampString}`,
    safeFileNameWithDateTimestampAndExtension: `${safeDirNameNoExtension}--${timestampString}${fileExtension}`,
  }
}

module.exports = {
  // handle processing data file
  writeToProcessingDataFile,
  moveSubtitleFiles,
  getDurationByMpv,
  throwOffLimitsErrors,

  // handle output from the whisper process
  handleStdOut,
  handleStdErr,
  handleProcessClose,
  buildWhisperArguments,
  convertLanguageText,
  removeFromArrayByWsNumber,
  updateDetectedLanguage,
  handleTranslation,
  generateFileDetailsHTML,
  generateCompletionDataHTML,

  // file name helpers
  makeFileNameSafe,
  createFileNames
}