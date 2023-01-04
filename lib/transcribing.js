const fs = require("fs-extra");
const {autoDetectLanguage} = require("../transcribe/transcribing");
const {formatStdErr} = require("../helpers/formatStdErr");
const { getLanguageCodeForAllLanguages } = require("../constants/constants");

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

async function moveFiles(randomNumber, fileExtension){
  const holderFolder = `${process.cwd()}/transcriptions/${randomNumber}`;
  for(const extension of outputFileExtensions){
    const oldLocation = `${holderFolder}/${randomNumber}.${fileExtension}${extension}`
    await fs.move(oldLocation, `${holderFolder}/${randomNumber}${extension}`)
  }
}

function handleProcessClose ({ processingDataPath, originalUpload, randomNumber }) {
  return function (code) {
    (async function () {
      l(`STDERR: ${code}`)

      const processFinishedSuccessfully = code === 0;

      if(processFinishedSuccessfully) {
        // save info to processing_data.json
        await writeToProcessingDataFile(processingDataPath, {
          status: 'completed',
        })

        const fileExtension = originalUpload.split('.').pop();

        await fs.move(originalUpload, `${process.cwd()}/transcriptions/${randomNumber}/${randomNumber}.${fileExtension}`)
        await moveFiles(randomNumber, fileExtension)
      } else {
        throw new Error('Whisper process did not exit successfully')
      }

    })()
  }
}

module.exports = {
  writeToProcessingDataFile,
  detectLanguageFromString,
  handleStdOut,
  handleStdErr,
  handleProcessClose,
}