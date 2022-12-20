const which = require('which');
const spawn = require('child_process').spawn;
const fs = require('fs-extra');
const ffprobe = require('ffprobe');
const WebSocket = require('ws');
let convert = require('cyrillic-to-latin')
const path = require('path');
const projectConstants = require('../constants/constants');
const { shouldTranslateFrom, languagesToTranscribe, translationLanguages, getLanguageCodeForAllLanguages } = projectConstants;
const forHumans = require('../helpers/helpers').forHumans;
const createTranslatedFiles = require('../translate/create-translated-files');
const multipleGpusEnabled = process.env.MULTIPLE_GPUS === 'true';
const { formatStdErr } = require('../helpers/formatStdErr')

const nodeEnvironment = process.env.NODE_ENV;
const libreTranslateHostPath = process.env.LIBRETRANSLATE;

l(`libreTranslateHostPath: ${libreTranslateHostPath}`)

const isProd = nodeEnvironment === 'production';

const whisperPath = which.sync('whisper')

global.transcriptions = [];

function sendToWebsocket (websocketConnection, data) {
  websocketConnection.send(JSON.stringify(data), function () {});
}


let topLevelValue = 1;
async function transcribe ({
  uploadedFilePath,
  language,
  model,
  websocketConnection,
  websocketNumber,
  queue,
  directorySafeFileNameWithoutExtension,
  directorySafeFileNameWithExtension,
  originalFileNameWithExtension,
  fileSafeNameWithDateTimestamp,
  fileSafeNameWithDateTimestampAndExtension,
  uploadGeneratedFilename,
  shouldTranslate,
  uploadDurationInSeconds,
}) {
  return new Promise(async (resolve, reject) => {

    // if the upload was removed from the queue, don't run it
    if (!global.queueData.includes(websocketNumber)) {
      l('DIDNT HAVE THE QUEUE DATA MATCH, ABORTING');
      // if they're not in the queue, cut them off
      // TODO: change to reject?
      return resolve(true);
    }

    try {

      // TODO: fix this
      directorySafeFileNameWithoutExtension = fileSafeNameWithDateTimestamp
      directorySafeFileNameWithExtension = fileSafeNameWithDateTimestampAndExtension

      // l('directorySafeFileNameWithoutExtension')
      // l(directorySafeFileNameWithoutExtension);
      // l('directorySafeFileNameWithExtension')
      // l(directorySafeFileNameWithExtension)

      // todo: refactor this a bit
      websocketConnection.send(JSON.stringify('Whisper initializing, updates to come...'), function () {});

      const osSpecificPathSeparator = path.sep;

      // get the upload file name
      // the ugly generated file id made the during the upload (for moving the upload over)
      let uploadFolderFileName = uploadedFilePath.split(osSpecificPathSeparator).pop();

      const originalUpload = `./uploads/${uploadFolderFileName}`;

      const uploadDurationInSecondsHumanReadable = forHumans(uploadDurationInSeconds);

      const fileDetailsJSON = {
        filename: directorySafeFileNameWithoutExtension,
        language,
        model,
        uploadDurationInSeconds,
        uploadDurationInSecondsHumanReadable,
      }

      // just do JSON, then loop through properties on the frontend
      let fileDetails = `
            filename: ${directorySafeFileNameWithExtension}
            language: ${language}
            model: ${model}
            uploadDurationInSeconds: ${uploadDurationInSeconds}
            uploadDurationInSecondsHumanReadable: ${uploadDurationInSecondsHumanReadable}
      `.replace(/^ +/gm, ''); // remove indentation

      // update filedetails
      websocketConnection.send(JSON.stringify({
        message: 'fileDetails',
        fileDetails
      }), function () {});

      /** INSTANTIATE WHISPER PROCESS **/
      // queue up arguments, path is the first one
      let arguments = [uploadedFilePath];

      // set the language for whisper (if undefined with auto-detect and translate off that)
      if (language) {
        arguments.push('--language', language);
      }

      // set the language for whisper (if undefined with auto-detect and translate off that)
      if (model) {
        arguments.push('--model', model);
      }

      // alternate
      // todo: do an 'express' queue and a 'large files' queue
      if (isProd && multipleGpusEnabled) {
        if (topLevelValue === 1) {
          arguments.push('--device', 'cuda:0');
        } else if (topLevelValue === 2) {
          arguments.push('--device', 'cuda:1');
        }
      }

      // dont show the text output but show the progress thing
      arguments.push('--verbose', 'False');

      // folder to save .txt, .vtt and .srt
      arguments.push('-o', 'transcriptions/' + uploadGeneratedFilename);

      l('transcribe arguments');
      l(arguments);

      const whisperProcess = spawn(whisperPath, arguments);

      let serverNumber = topLevelValue;

      if (serverNumber === 1) {
        topLevelValue = 2
      } else if (serverNumber === 2) {
        topLevelValue = 1
      }

      // add process globally to kill it when user leaves
      const process = {
        websocketNumber,
        spawnedProcess: whisperProcess,
        serverNumber,
      }
      global['transcriptions'].push(process)

      /** FIND AUTO-DETECTED LANGUAGE **/
      let foundLanguage;
      let displayLanguage = language;

      //  console output from stdoutt
      whisperProcess.stdout.on('data', data => {
        websocketConnection.send(JSON.stringify(`stdout: ${data}`), function () {});
        l(`STDOUT: ${data}`);

        // TODO: pull this out into own function
        // check if language is autodetected)
        const dataAsString = data.toString();
        if (dataAsString.includes('Detected language:')) {

          // parse out the language from the console output
          foundLanguage = dataAsString.split(':')[1].substring(1).trimEnd();

          l(`DETECTED LANGUAGE FOUND: ${foundLanguage}`);
          if (!language && foundLanguage) {
            language = foundLanguage
            displayLanguage = `${language} (Auto-Detected)`
          }

          // send data to frontend with updated language
          // TODO: when it's JSON, just add the detected language here as a property
          fileDetails = `
            filename: ${directorySafeFileNameWithoutExtension}
            language: ${displayLanguage}
            model: ${model}
            uploadDurationInSeconds: ${uploadDurationInSeconds}
            uploadDurationInSecondsHumanReadable: ${uploadDurationInSecondsHumanReadable}
          `.replace(/^ +/gm, ''); // remove indentation

          // update file details
          websocketConnection.send(JSON.stringify({
            message: 'fileDetails',
            fileDetails
          }), function () {});
        }
      });

      // log output from bash (it all comes through stderr for some reason?)
      whisperProcess.stderr.on('data', data => {
        // figure out how many people currently transcribing
        const amountOfCurrentPending = queue.getPendingLength()
        const amountinQueue = queue.getQueueLength()

        const totalOutstanding = amountOfCurrentPending + amountinQueue;
        // websocketConnection.send(JSON.stringify(`stderr: ${data}`), function () {});
        l(`STDERR: ${data},
         Duration: ${uploadDurationInSecondsHumanReadable} Model: ${model}, Language ${language}, Filename: ${directorySafeFileNameWithoutExtension}, Queue: ${totalOutstanding}, Translating: ${shouldTranslate}  `);

        // loop through and do with websockets
        for (let [, websocket] of global['webSocketData'].entries() ) {
          const websocketConnection = websocket.websocket;
          const clientWebsocketNumber = websocket.websocketNumber;
          const websocketFromProcess = websocketNumber;

          let ownershipPerson = 'others'
          if (clientWebsocketNumber === websocketFromProcess) {
            ownershipPerson = 'you'
          }

          const formattedProgress = formatStdErr(data.toString());
          // l('formattedProgress');
          // l(formattedProgress);

          const { percentDoneAsNumber, percentDone, speed, timeRemaining  } = formattedProgress;

          let processingString = '';
          if (timeRemaining) {
            processingString = `[${percentDone}] ${timeRemaining.string} Remaining, Speed ${speed}f/s`
          }

          // TODO: pull into function
          // pass latest data to all the open sockets
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
      });


      // save date when starting to see how long it's taking
      const startingDate = new Date();
      l(startingDate);

      /** AFTER WHISPER FINISHES, DO THE FILE MANIPULATION / TRANSLATION **/
      whisperProcess.on('close', async (code) => {
        try {
          l('code');
          l(code);

          if (!language) {
            language = foundLanguage;
          }

          const processFinishedSuccessfully = code === 0;

          // successful output
          if (processFinishedSuccessfully) {
            // TODO: pull out all this moving stuff into its own function

            const containingDir = `./transcriptions/${uploadGeneratedFilename}`;

            await fs.move(originalUpload, `${containingDir}/${directorySafeFileNameWithExtension}`, { overwrite: true })

            // const fileNameWithLanguage = `${directorySafeFileNameWithoutExtension}_${language}`;

            const directoryAndFileName = `${containingDir}/${directorySafeFileNameWithoutExtension}`

            // turn this to a loop
            /** COPY TO BETTER NAME, SRT, VTT, TXT **/
            const transcribedSrtFile = `${directoryAndFileName}.srt`;

            const transcribedVttFile = `${directoryAndFileName}.vtt`;

            const transcribedTxtFile = `${directoryAndFileName}.txt`;

            // copy srt with the original filename
            // SOURCE, ORIGINAL
            // TODO: could probably move here instead of copy
            await fs.move(`${containingDir}/${uploadFolderFileName}.srt`, transcribedSrtFile, { overwrite: true })

            await fs.move(`${containingDir}/${uploadFolderFileName}.vtt`, transcribedVttFile, { overwrite: true })

            await fs.move(`${containingDir}/${uploadFolderFileName}.txt`, transcribedTxtFile, { overwrite: true })

            // TODO: convert to loop
            // convert Cyrillic to latin
            if (language === 'Serbian') {
              let data = await fs.readFile(transcribedSrtFile, 'utf-8');
              let latinCharactersText = convert(data);
              await fs.writeFile(transcribedSrtFile, latinCharactersText, 'utf-8');

              data = await fs.readFile(transcribedVttFile, 'utf-8');
              latinCharactersText = convert(data);
              await fs.writeFile(transcribedVttFile, latinCharactersText, 'utf-8');

              data = await fs.readFile(transcribedTxtFile, 'utf-8');
              latinCharactersText = convert(data);
              await fs.writeFile(transcribedTxtFile, latinCharactersText, 'utf-8');

            }

            // return await so queue moves on, don't need to wait for translations
            resolve(code);

            // TODO: pull out into own function
            const shouldTranslateFromLanguage = shouldTranslateFrom(language);
            l(`should translate from language: ${shouldTranslateFromLanguage}`)

            l(`libreTranslateHostPath: ${libreTranslateHostPath}`)

            l(`should translate: ${shouldTranslate}`)

            let translationStarted, translationFinished = false;
            /** AUTOTRANSLATE WITH LIBRETRANSLATE **/
            if (libreTranslateHostPath && shouldTranslateFromLanguage && shouldTranslate) {
              // tell frontend that we're translating now
              websocketConnection.send(JSON.stringify({
                languageUpdate: 'Doing translations with LibreTranslate',
                message: 'languageUpdate'
              }), function () {});
              l('hitting LibreTranslate');
              translationStarted = true;
              // hit libretranslate
              await createTranslatedFiles({
                directoryAndFileName,
                language,
                websocketConnection,
              })
              translationFinished = true;
            }

            // just post-processing, you can return the response
            const processingSeconds = Math.round((new Date() - startingDate) / 1000);

            const processingRatio = (uploadDurationInSeconds/processingSeconds).toFixed(2);

            // TODO: just have a function called "sendFileInfoToClient(fileInfoJSON)"

            const outputText = `
            filename: ${originalFileNameWithExtension}
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

            // tell frontend upload is done
            websocketConnection.send(JSON.stringify({
              status: 'Completed',
              urlSrt: transcribedSrtFile,
              urlVtt: transcribedVttFile,
              urlTxt: transcribedTxtFile,
              filename: directorySafeFileNameWithoutExtension,
              detailsString: outputText
            }), function () {});

            const translationStartedAndCompleted = translationStarted && translationFinished;

            let translatedLanguages = [];
            if (translationStartedAndCompleted) {
              const trimmedLanguagesToTranscribe = languagesToTranscribe.filter(e => e !== language);
              translatedLanguages = trimmedLanguagesToTranscribe
            }

            const fileDetailsObject = {
              filename: originalFileNameWithExtension,
              processingSeconds,
              processingSecondsHumanReadable: forHumans(processingSeconds),
              language,
              languageCode: getLanguageCodeForAllLanguages(language),
              model,
              upload: uploadFolderFileName,
              uploadDurationInSeconds,
              uploadDurationInSecondsHumanReadable,
              processingRatio,
              startedAt: startingDate.toUTCString(),
              finishedAT: new Date().toUTCString(),
              status: 'completed',
              translatedLanguages,
              fileExtension: path.parse(originalFileNameWithExtension).ext,
              directoryFileName: directorySafeFileNameWithoutExtension
            }

            // save data to the file
            await fs.appendFile(`${containingDir}/processing_data.json`, JSON.stringify(fileDetailsObject), 'utf8');

            // TODO: rename directory here
            const renamedDirectory = `./transcriptions/${directorySafeFileNameWithoutExtension}`;
            await fs.rename(containingDir, renamedDirectory)

          } else {
            l('FAILED!');
            reject();
            throw new Error('Transcription has been ended')
          }

          l(`child process exited with code ${code}`);
        } catch (err) {
          reject(err);
          sendToWebsocket({
            message: 'error',
            text: 'The transcription failed, please try again or try again later'
          })
          websocketConnection.terminate()
          l('err here');
          l(err.stack);
          l(err);
          throw new Error(err);
        }
      });
    } catch (err) {
      l('error from transcribe')
      l(err);

      reject(err);

      throw new Error(err)
    }

  });

}

module.exports = transcribe;
