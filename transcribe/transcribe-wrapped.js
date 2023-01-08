const which = require('which');
const {spawn} = require('child_process');
const fs = require('fs-extra');
const ffprobe = require('ffprobe');
const WebSocket = require('ws');
const path = require('path');

const {shouldTranslateFrom, languagesToTranscribe, translationLanguages, getLanguageCodeForAllLanguages} = require('../constants/constants');
const {forHumans, getamountOfRunningJobs, sendToWebsocket} = require('../helpers/helpers');
const {formatStdErr} = require('../helpers/formatStdErr');
const createTranslatedFiles = require('../translate/create-translated-files');
const {buildWhisperArguments, convertLanguageText, updateFileDetails, removeFromArrayByWsNumber} = require('../lib/transcribing');
const {stripOutTextAndTimestamps} = require('../translate/helpers');
const {updateQueueItemStatus} = require('../queue/queue');

const maxConcurrentJobs = Number(process.env.CONCURRENT_AMOUNT);
const concurrentAmount = process.env.CONCURRENT_AMOUNT;
const libreTranslateHostPath = process.env.LIBRETRANSLATE;

const l = console.log;

// l(`libreTranslateHostPath: ${libreTranslateHostPath}`)


const whisperPath = which.sync('whisper');

global.transcriptions = [];

async function transcribe ({
  uploadedFilePath,
  language,
  model,
  websocketConnection,
  websocketNumber,
  directorySafeFileNameWithoutExtension,
  directorySafeFileNameWithExtension,
  originalFileNameWithExtension,
  fileSafeNameWithDateTimestamp,
  fileSafeNameWithDateTimestampAndExtension,
  uploadGeneratedFilename,
  shouldTranslate,
  uploadDurationInSeconds,
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
      let uploadFolderFileName = uploadedFilePath.split(osSpecificPathSeparator).pop();
      const originalUpload = `./uploads/${uploadFolderFileName}`;
      
      const uploadDurationInSecondsHumanReadable = forHumans(uploadDurationInSeconds);
      let displayLanguage = language === 'auto-detect' ? 'Auto-Detect' : language;

      const fileDetailsJSON = {
        filename: directorySafeFileNameWithExtension,
        language: displayLanguage,
        model,
        uploadDurationInSeconds,
        uploadDurationInSecondsHumanReadable,
      }

      // just do JSON, then loop through properties on the frontend
      updateFileDetails({
        websocketConnection, language: displayLanguage, model, duration: uploadDurationInSecondsHumanReadable, filename: directorySafeFileNameWithExtension
      });

      /** INSTANTIATE WHISPER PROCESS **/
      const whisperArguments = buildWhisperArguments({
        filePath: uploadedFilePath, language, model, randomNumber: uploadGeneratedFilename
      });
      l({whisperArguments});
      
      const whisperProcess = spawn(whisperPath, whisperArguments);

      // add process globally to kill it when user leaves
      const process = {
        websocketNumber,
        spawnedProcess: whisperProcess,
        processNumber,
        type: 'transcription',
      }
      
      global.transcriptions.push(process);

      // find auto-detected language
      let foundLanguage;

      //  console output from stdoutt
      whisperProcess.stdout.on('data', data => {
        sendToWebsocket(websocketConnection, `stdout: ${data}`);
        l(`STDOUT: ${data}`);

        // TODO: pull this out into own function
        // check if language is autodetected)
        const dataAsString = data.toString();
        if (dataAsString.includes('Detected language:')) {

          // parse out the language from the console output
          foundLanguage = dataAsString.split(':')[1].substring(1).trimEnd();

          l(`DETECTED LANGUAGE FOUND: ${foundLanguage}`);
          if (language === 'auto-detect' && foundLanguage) {
            language = foundLanguage;
            displayLanguage = `${language} (Auto-Detected)`;
          }

          // send data to frontend with updated language
          // TODO: when it's JSON, just add the detected language here as a property
          updateFileDetails({
            websocketConnection, language: displayLanguage, model, duration: uploadDurationInSecondsHumanReadable, filename: directorySafeFileNameWithExtension
          });
        }
      });

      // log output from bash (it all comes through stderr for some reason?)
      whisperProcess.stderr.on('data', data => {
        const currentlyRunningJobs = getamountOfRunningJobs();
        const amountInQueue = global.newQueue.length;
        const totalOutstanding = currentlyRunningJobs + amountInQueue;

        let outputString = `
         STDERR: ${data},
         Duration: ${uploadDurationInSecondsHumanReadable},
         Model: ${model}, 
         Language: ${displayLanguage},
         Filename: ${directorySafeFileNameWithExtension}, 
         Queue: ${totalOutstanding}, 
         Translating: ${shouldTranslate}`;

        outputString = outputString.replace(/\s+/g, ' ');
        l({outputString});
        // loop through and do with websockets
        global.webSocketData.forEach(({websocket: websocketConnection, websocketNumber: clientWebsocketNumber}) => {
          const ownershipPerson = clientWebsocketNumber === websocketNumber ? 'you' : 'others';
          const formattedProgress = formatStdErr(data.toString());

          const {percentDoneAsNumber, percentDone, speed, timeRemaining} = formattedProgress;

          const processingString = timeRemaining ? `[${percentDone}] ${timeRemaining.string} Remaining, Speed ${speed}f/s` : '';

          // TODO: pull into function
          // pass latest data to all the open sockets
          if (websocketConnection.readyState === WebSocket.OPEN) {
            /** websocketData message **/
            sendToWebsocket(websocketConnection, {
              message: 'websocketData',
              processingData: processingString,
              // processingData: data.toString(),
              ownershipPerson,
              processNumber, // on the frontend we'll react different if it's on server 1 or two
              formattedProgress,
              percentDone: percentDoneAsNumber,
              timeRemaining,
              speed,
            });
          }
        });
      });

      // save date when starting to see how long it's taking
      const startingDate = new Date();
      l({startingDate});

      /** AFTER WHISPER FINISHES, DO THE FILE MANIPULATION / TRANSLATION **/
      whisperProcess.on('close', async code => {
        try {
          l({code});
          
          if (!language || language === 'auto-detect') {
            language = foundLanguage;
          }

          const processFinishedSuccessfully = code === 0;

          // successful output
          if (processFinishedSuccessfully) {
            // TODO: pull out all this moving stuff into its own function
            
            const originalContainingDir = `./transcriptions/${uploadGeneratedFilename}`;
            
            const originalDirectoryAndNewFileName = `${originalContainingDir}/${directorySafeFileNameWithoutExtension}`;
            
            l({originalUpload, originalContainingDir, directorySafeFileNameWithExtension});
            await fs.move(originalUpload, `${originalContainingDir}/${directorySafeFileNameWithExtension}`, {overwrite: true});

            // turn this to a loop
            /** COPY TO BETTER NAME, SRT, VTT, TXT **/
            const fileTypes = ['srt', 'vtt', 'txt'];
            // doesn't work
            // fileTypes.forEach(async fileType => {
            // await fs.move(`${originalContainingDir}/${uploadFolderFileName}.${fileType}`, `${originalDirectoryAndNewFileName}.${fileType}`, { overwrite: true });
            // });
            const srtPath = `${originalDirectoryAndNewFileName}.srt`;

            const vttPath = `${originalDirectoryAndNewFileName}.vtt`;

            const txtPath = `${originalDirectoryAndNewFileName}.txt`;

            // copy srt with the original filename
            // SOURCE, ORIGINAL
            // TODO: could probably move here instead of copy
            await fs.move(`${originalContainingDir}/${uploadFolderFileName}.srt`, srtPath, { overwrite: true })

            await fs.move(`${originalContainingDir}/${uploadFolderFileName}.vtt`, vttPath, { overwrite: true })

            await fs.move(`${originalContainingDir}/${uploadFolderFileName}.txt`, txtPath, { overwrite: true })

            await convertLanguageText(language, originalDirectoryAndNewFileName);

            updateQueueItemStatus(websocketNumber, 'completed');

            // return await so queue moves on, don't need to wait for translations
            resolve(code);

            l({shouldTranslate});

            // copy original as copied
            await fs.copy(vttPath, `${originalDirectoryAndNewFileName}_${language}.vtt`)

            // strip out text and timestamps here to save in processing_data.json
            const { strippedText, timestampsArray } = await stripOutTextAndTimestamps(vttPath)

            let translationStarted, translationFinished = false;
            /** TRANSLATION FUNCTIONALITY **/
            if (libreTranslateHostPath, shouldTranslate) {
              // tell frontend that we're translating now
              sendToWebsocket(websocketConnection, {
                languageUpdate: 'Doing translations with LibreTranslate',
                message: 'languageUpdate'
              });
              l('hitting LibreTranslate');
              translationStarted = true;
              // hit libretranslate
              await createTranslatedFiles({
                directoryAndFileName: originalDirectoryAndNewFileName,
                language,
                websocketConnection,
                strippedText,
                timestampsArray
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
            sendToWebsocket(websocketConnection, {
              status: 'Completed',
              urlSrt: srtPath,
              urlVtt: vttPath,
              urlTxt: txtPath,
              filename: fileSafeNameWithDateTimestamp,
              detailsString: outputText
            });

            const translationStartedAndCompleted = translationStarted && translationFinished;

            let translatedLanguages = [];
            if (translationStartedAndCompleted) {
              // TODO: this is named wrong, should be languagesToTranslateTo
              // remove the original language from languagesToTranslateTo
              translatedLanguages = languagesToTranscribe.filter(e => e !== language);
            }

            const wordCount = strippedText.split(' ').length;
            const wordsPerMinute = Math.round(wordCount / (uploadDurationInSeconds / 60));

            // data to save to processing_data.json
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
              directoryFileName: directorySafeFileNameWithoutExtension,
              strippedText,
              timestampsArray,
              wordCount,
              wordsPerMinute,
              fileSizeInMB,
              characterCount: strippedText.length,
              user,
              downloadLink,
            }

            // save processing_data.json
            await fs.appendFile(`${originalContainingDir}/processing_data.json`, JSON.stringify(fileDetailsObject), 'utf8');

            // TODO: if no link passed, because if link was passed no need to rename directory
            const renamedDirectory = `./transcriptions/${fileSafeNameWithDateTimestamp}`;
            await fs.rename(originalContainingDir, renamedDirectory)

            // remove from global.transcriptions
            global.transcriptions = removeFromArrayByWsNumber(global.transcriptions, websocketNumber);

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
          l('err here');
          l(err.stack);
          l(err);
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
