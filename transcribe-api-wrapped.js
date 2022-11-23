const which = require("which");
const spawn = require('child_process').spawn;
const fs = require('fs-extra');
const ffprobe = require('ffprobe');
const WebSocket = require('ws');
var convert = require('cyrillic-to-latin')
const filenamify = require('filenamify')
const path = require('path');
const projectConstants = require('./constants');
const { shouldTranslateFrom, languagesToTranscribe, translationLanguages, getLanguageCodeForAllLanguages } = projectConstants;
const forHumans = require('./helpers').forHumans;
const createTranslatedFiles = require('./create-translated-files');

const makeFileNameSafe = function(string){
  return filenamify(string, {replacement: '_' }).replace(/ /g,"_")
    .replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, '');
}

l = console.log;

const concurrentAmount = process.env.CONCURRENT_AMOUNT;
const nodeEnvironment = process.env.NODE_ENV;
const libreTranslateHostPath = process.env.LIBRETRANSLATE;

l(`libreTranslateHostPath: ${libreTranslateHostPath}`)

const isProd = nodeEnvironment === 'production';

const whisperPath = which.sync('whisper')
const ffprobePath = which.sync('ffprobe')

let topLevelValue = 1;

function buildArguments({
   uploadedFilePath,
   language,
   model,
   uploadGeneratedFilename,
   topLevelValue
}){
  /** INSTANTIATE WHISPER PROCESS **/
    // queue up arguments, path is the first one
  let arguments = [];

  arguments.push(uploadedFilePath);
  if(language) arguments.push(language);
  if(model) arguments.push(model);

  if(isProd){
    if(topLevelValue === 1){
      arguments.push('--device', 'cuda:0');
    } else if(topLevelValue === 2){
      arguments.push('--device', 'cuda:1');
    }
  }

  // dont show the text output but show the progress thing
  arguments.push('--verbose', 'False');

  // folder to save .txt, .vtt and .srt
  arguments.push('-o', "transcriptions/" + uploadGeneratedFilename);
  return arguments
}

function toggleTopLevelValue(){
  if(topLevelValue === 1){
    topLevelValue = 2
  } else if(topLevelValue === 2){
    topLevelValue = 1
  }
}

function autoDetectLanguage(dataAsString){
  if(dataAsString.includes('Detected language:')){
    // parse out the language from the console output
    return dataAsString.split(':')[1].substring(1).trimEnd();
  }
  return false;
}

async function writeToProcessingDataFile(processingDataPath, dataObject){
  // save data to the file
  const processingDataExists = await fs.exists(processingDataPath)
  if(processingDataExists){
    const existingProcessingData = JSON.parse(await fs.readFile(processingDataPath, 'utf8'));
    let merged = {...existingProcessingData, ...dataObject};
    await fs.appendFile(processingDataPath, JSON.stringify(merged), 'utf8');
  } else {
    await fs.appendFile(processingDataPath, JSON.stringify(dataObject), 'utf8');
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

async function transcribe({
  uploadedFilePath,
  language,
  model,
  originalFileNameWithExtension,
  fileSafeNameWithDateTimestamp,
  fileSafeNameWithDateTimestampAndExtension,
  uploadGeneratedFilename,
  shouldTranslate
}){
  return new Promise(async (resolve, reject) => {
    try {
      l('directorySafeFileNameWithoutExtension')
      l(fileSafeNameWithDateTimestamp);
      l('directorySafeFileNameWithExtension')
      l(fileSafeNameWithDateTimestampAndExtension)

      // get the upload file name
      // the ugly generated file id made the during the upload (for moving the upload over)
      let uploadFolderFileName = uploadedFilePath.split("/").pop();

      const originalUpload = `./uploads/${uploadFolderFileName}`;
      const ffprobeResponse = await ffprobe(originalUpload, { path: ffprobePath });

      const audioStream = ffprobeResponse.streams.filter(stream => stream.codec_type === 'audio')[0];
      const uploadDurationInSeconds = Math.round(audioStream.duration);

      const uploadDurationInSecondsHumanReadable = forHumans(uploadDurationInSeconds);

      l('transcribe arguments');
      l(arguments);

      const arguments = buildArguments({
        uploadedFilePath,
        language,
        model,
        uploadGeneratedFilename,
        topLevelValue
      })

      const whisperProcess = spawn(whisperPath, arguments);

      toggleTopLevelValue();

      let foundLanguage;
      //  console output from stdoutt
      whisperProcess.stdout.on('data', data => {
        l(`STDOUT: ${data}`)
        const parsedLanguage = autoDetectLanguage(data);
        if(parsedLanguage){
          foundLanguage = parsedLanguage
        }
      });

      // log output from bash (it all comes through stderr for some reason?)
      whisperProcess.stderr.on('data', data => {
        // TODO: parse out progress
      });


      // save date when starting to see how long it's taking
      const startingDate = new Date();
      l(startingDate);

      let containingDir = `./transcriptions/${uploadGeneratedFilename}`;

      /** AFTER WHISPER FINISHES, DO THE FILE MANIPULATION / TRANSLATION **/
      whisperProcess.on('close', async (code) => {
        try {
          l('code');
          l(code);

          // to-do transcription time ended

          if(!language){
            language = foundLanguage;
          }

          const processFinishedSuccessfully = code === 0;

          // successful output
          if(processFinishedSuccessfully){
            // move original upload
            await fs.move(originalUpload, `${containingDir}/${fileSafeNameWithDateTimestampAndExtension}`, { overwrite: true })

            const directoryAndFileName = `${containingDir}/${fileSafeNameWithDateTimestamp}`

            // rename to give the files better display name
            const outputFileExtensions = ['.srt', '.vtt', '.txt']
            for(const fileExtension of outputFileExtensions){
              const transcribedFilePath = `${directoryAndFileName}${fileExtension}`
              await fs.move(`${containingDir}/${uploadFolderFileName}${fileExtension}`, transcribedFilePath, { overwrite: true })
            }

            const processingDataPath = `${containingDir}/processing_data.json`;

            const response = await translateIfNeeded({ language, shouldTranslate, directoryAndFileName, processingDataPath})

            // just post-processing, you can return the response
            const processingSeconds = Math.round((new Date() - startingDate) / 1000);

            const processingRatio = (uploadDurationInSeconds/processingSeconds).toFixed(2);

            await writeToProcessingDataFile(processingDataPath, {
              processingSeconds,
              processingSecondsHumanReadable: forHumans(processingSeconds),
              processingRatio,
              startedAt: startingDate.toUTCString(),
              finishedAT: new Date().toUTCString(),
              status: 'completed',
            })

            // rename containing dir for easier debugging
            const renamedDirectory = `./transcriptions/${fileSafeNameWithDateTimestamp}`;
            await fs.rename(containingDir, renamedDirectory)
            containingDir = `./transcriptions/${fileSafeNameWithDateTimestamp}`;

            resolve(code);

          } else {
            // console returned with failed response
            l('FAILED!');
            reject();
            throw new Error('Transcription has been ended')
          }

          l(`child process exited with code ${code}`);
        } catch (err){
          reject(err);
          l('err here');
          l(err.stack);
          l(err);
          throw new Error(err);
        }
      });
    } catch (err){
      l('error from transcribe')
      l(err);

      reject(err);

      throw new Error(err)
    }

  });

}

module.exports = transcribe;
