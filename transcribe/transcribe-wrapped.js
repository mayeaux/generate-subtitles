const which = require('which');
const {spawn} = require('child_process');
const fs = require('fs-extra');
const ffprobe = require('ffprobe');
const WebSocket = require('ws');
const path = require('path');

const {languagesToTranscribe, getLanguageCodeForAllLanguages} = require('../constants/constants');
const {forHumans, getamountOfRunningJobs, sendToWebsocket} = require('../helpers/helpers');
const {formatStdErr} = require('../helpers/formatStdErr');
const {buildWhisperArguments, convertLanguageText, removeFromArrayByWsNumber, updateDetectedLanguage, handleTranslation, moveSubtitleFiles, generateCompletionDataHTML, generateFileDetailsHTML} = require('../lib/transcribing');
const {stripOutTextAndTimestamps} = require('../translate/helpers');
const {updateQueueItemStatus} = require('../queue/queue');

const maxConcurrentJobs = Number(process.env.CONCURRENT_AMOUNT);
const concurrentAmount = process.env.CONCURRENT_AMOUNT;
const libreTranslateHostPath = process.env.LIBRETRANSLATE;

const l = console.log;

const whisperPath = which.sync('whisper');

global.transcriptions = [];

async function transcribe ({
  uploadedFilePath,
  language,
  model,
  websocketConnection,
  websocketNumber,
  fileNameWithExtension,
  fileNameNoExtension,
  fileExtension,
  safeDirNameNoExtension,
  safeFileNameWithExtension,
  safeFileNameWithDateTimestamp,
  safeFileNameWithDateTimestampAndExtension,
  uploadGeneratedFilename,
  shouldTranslate,
  uploadDurationInSeconds,
  uploadDuration,
  fileSizeInMB,
  user,
  downloadLink,
  // totalOutstanding, // not actually useful
  processNumber,
}) {
  return new Promise(async (resolve, reject) => {

    const webSocketIsStillAlive = num => global.webSocketData.some(item => item.websocketNumber === num);

    // if the upload was removed from the queue, don't run it
    if (!webSocketIsStillAlive(websocketNumber)) {
      l('DIDNT HAVE THE QUEUE DATA MATCH, ABORTING');
      // if they're not in the queue, cut them off
      // TODO: change to reject?
      updateQueueItemStatus(websocketNumber, 'abandoned');
      return reject('WEBSOCKET DISCONNECTED');
    }

    try {
      // inform frontend their processing has started
      sendToWebsocket(websocketConnection, {
        message: 'starting',
        text: 'Whisper initializing, updates to come...'
      });

      updateQueueItemStatus(websocketNumber, 'processing');

      // fixes bug with windows
      const osSpecificPathSeparator = path.sep;

      // get the upload file name
      // the ugly generated file id made the during the upload (for moving the upload over)
      const uploadFolderFileName = uploadedFilePath.split(osSpecificPathSeparator).pop();
      const originalUpload = `./uploads/${uploadFolderFileName}`;
      
      const fileInfo = {
        filename: fileNameWithExtension,
        fileNameNoExtension,
        fileExtension,
        safeFileNameWithExtension,
        safeFileNameWithDateTimestamp,
        fileSizeInMB,
        safeDirNameNoExtension,
        language,
        languageCode: getLanguageCodeForAllLanguages(language),
        model,
        upload: uploadFolderFileName,
        uploadGeneratedFilename,
        originalContainingDir: `./transcriptions/${uploadGeneratedFilename}`,
        originalDirectoryAndNewFileName: `./transcriptions/${uploadGeneratedFilename}/${safeDirNameNoExtension}`,
        uploadDurationInSeconds,
        uploadDuration,
        originalUpload,
        user,
        downloadLink,
        processNumber,
        shouldTranslate,
        translationStarted: false,
        translationFinished: false,
      }

      fileInfo.fileDetailsHTML = generateFileDetailsHTML(fileInfo);
      sendToWebsocket(websocketConnection, {message: 'fileDetails', ...fileInfo});

      /** INSTANTIATE WHISPER PROCESS **/
      const whisperArguments = buildWhisperArguments({
        filePath: uploadedFilePath, language: fileInfo.language, model, randomNumber: uploadGeneratedFilename
      });
      l({whisperArguments});
      
      const whisperProcess = spawn(whisperPath, whisperArguments);

      // add process globally to kill it when user leaves
      global.transcriptions.push({
        websocketNumber,
        spawnedProcess: whisperProcess,
        processNumber,
        type: 'transcription',
      });

      //  console output from stdout
      whisperProcess.stdout.on('data', data => {
        sendToWebsocket(websocketConnection, `stdout: ${data}`);
        l(`STDOUT: ${data}`);
        updateDetectedLanguage({data, fileInfo, websocketConnection});
      });

      // log output from bash (it all comes through stderr for some reason?)
      whisperProcess.stderr.on('data', data => {
        const currentlyRunningJobs = getamountOfRunningJobs();
        const amountInQueue = global.newQueue.length;
        const totalOutstanding = currentlyRunningJobs + amountInQueue; // what for?

        l({STDERR: data, ...fileInfo, queue: totalOutstanding, translating: shouldTranslate});

        // loop through and do with websockets
        global.webSocketData.forEach(({websocket: websocketConnection, websocketNumber: clientWebsocketNumber}) => {

          const ownershipPerson = clientWebsocketNumber === websocketNumber ? 'you' : 'others';
          fileInfo.ownershipPerson = ownershipPerson;
          const formattedProgress = formatStdErr(data.toString());
          fileInfo.formattedProgress = formattedProgress;
          const {percentDoneAsNumber, percentDone, speed, timeRemaining} = formattedProgress;
          fileInfo.percentDone = percentDoneAsNumber;
          fileInfo.timeRemaining = timeRemaining;
          fileInfo.speed = speed;
          fileInfo.processingData = timeRemaining ? `[${percentDone}] ${timeRemaining.string} Remaining, Speed ${speed}f/s` : '';

          // pass latest data to all the open sockets
          if (websocketConnection.readyState === WebSocket.OPEN) {
            /** websocketData message **/
            sendToWebsocket(websocketConnection, {
              message: 'websocketData',
              ...fileInfo
            });
          }
        });
      });

      // save date when starting to see how long it's taking
      const startingDate = new Date();
      fileInfo.startedAt = startingDate.toUTCString();

      /** AFTER WHISPER FINISHES, DO THE FILE MANIPULATION / TRANSLATION **/
      whisperProcess.on('close', async code => {
        try {
          l({code});
          
          const processFinishedSuccessfully = code === 0;

          // successful output
          if (processFinishedSuccessfully) {

            await moveSubtitleFiles(fileInfo);            

            await convertLanguageText(fileInfo.language, fileInfo.originalDirectoryAndNewFileName);

            updateQueueItemStatus(websocketNumber, 'completed');

            // return await so queue moves on, don't need to wait for translations
            resolve(code);

            // copy original as copied
            await fs.copy(fileInfo.vttPath, `${fileInfo.originalDirectoryAndNewFileName}_${fileInfo.language}.vtt`)

            // strip out text and timestamps here to save in processing_data.json
            const {strippedText, timestampsArray} = await stripOutTextAndTimestamps(fileInfo.vttPath);
            fileInfo.strippedText = strippedText;
            fileInfo.characterCount = strippedText.length;
            fileInfo.timestampsArray = timestampsArray;
            const wordCount = strippedText.split(' ').length;
            fileInfo.wordCount = wordCount;
            const wordsPerMinute = Math.round(wordCount / (uploadDurationInSeconds / 60));
            fileInfo.wordsPerMinute = wordsPerMinute;

            /** TRANSLATION FUNCTIONALITY **/
            if (libreTranslateHostPath, shouldTranslate) {
              await handleTranslation(fileInfo, websocketConnection);
            }

            // just post-processing, you can return the response
            const processingSeconds = Math.round((new Date() - startingDate) / 1000);
            fileInfo.processingSeconds = processingSeconds;
            fileInfo.processingTime = forHumans(processingSeconds);

            const processingRatio = (uploadDurationInSeconds/processingSeconds).toFixed(2);
            fileInfo.processingRatio = processingRatio;
            fileInfo.finishedAt = new Date().toUTCString();
            fileInfo.status = 'Completed';

            const translationStartedAndCompleted = fileInfo.translationStarted && fileInfo.translationFinished;

            if (translationStartedAndCompleted) {
              // remove the original language from targetLanguages
              fileInfo.targetLanguages = languagesToTranscribe.filter(lang => lang !== fileInfo.language);
            }

            fileInfo.completionDataHTML = generateCompletionDataHTML(fileInfo);

            l({fileInfo});
            // save processing_data.json
            await fs.appendFile(`${fileInfo.originalContainingDir}/processing_data.json`, JSON.stringify(fileInfo), 'utf8');

            // TODO: if no link passed, because if link was passed no need to rename directory
            const renamedDirectory = `./transcriptions/${safeFileNameWithDateTimestamp}`;
            await fs.rename(fileInfo.originalContainingDir, renamedDirectory)

            // remove from global.transcriptions
            global.transcriptions = removeFromArrayByWsNumber(global.transcriptions, websocketNumber);
            // tell frontend upload is done
            sendToWebsocket(websocketConnection, {
              status: 'Completed',
              ...fileInfo
            });

          } else {
            l('FAILED!');
            reject();
            throw new Error('Transcription has been ended')
          }

          // l(`child process exited with code ${code}`);
        } catch (err) {
          updateQueueItemStatus(websocketNumber, 'errored');

          reject(err);
          l('websocket connection');
          // if websocket is still connected
          if (websocketConnection.readyState === 1) {
            sendToWebsocket({
              message: 'error',
              text: 'The transcription failed, please try again or try again later'
            })
            websocketConnection.terminate()
          }
          l(err.stack);
          l({err});
          throw err;
        }
      });
      // TODO: this doesn't seem to actually work (errors never seem to land here)
    } catch (err) {
      l('error from transcribe-wrapped')
      l(err);

      updateQueueItemStatus(websocketNumber, 'errored');

      sendToWebsocket(websocketConnection, {
        message: 'error',
        text: 'The transcription failed, please try again or try again later'
      });
      reject(err);

      throw err;
    }
  });
}

module.exports = transcribe;
