const FormData = require('form-data');
const fs = require('fs-extra');
const axios = require('axios');
const {cu} = require('language-name-map/map');
const { createFileNames } = require('../lib/transcribing');
const { formatStdErr } = require('../lib/transcribing');
const path = require('path');
const WebSocket = require('ws');
const convert = require('cyrillic-to-latin');
const extraAudioFromVideoIfNeeded = require('../scripts/extractAudioFfmpeg');
const {
  delayPromise,
  createFile,
  createOrUpdateProcessingData,
  getWebsocketConnectionByNumberToUse,
  generateRandomNumber,
} = require('../helpers/utils');
const {
  createTranslatedVtts,
  saveOriginalProcessingDataJson,
  generateProcessingDataString
} = require('../lib/transcribe-api');

const l = console.log;

// post to server to start process
async function hitRemoteApiEndpoint (form, apiEndpoint) {
  // use passed if available
  l(`Endpoint to use: ${apiEndpoint}`);

  const options = {
    headers: {
      ...form.getHeaders(),
    }
  }

  // send form data to endpoint
  const response = await axios.post(apiEndpoint, form, options)

  return response
}

// get latest data and log it
async function getNewData (dataUrl) {
  let dataResponse = await axios.get(dataUrl);
  return dataResponse.data
}


/**
 * Transcribe a file on a remote server
 * @param pathToAudioFile - Will read this and post it
 * @param language
 * @param model
 * @param numberToUse - Websocket or auto-generated
 * @param fullApiEndpoint - server endpoint like http://remoteaddress:remoteIP/api
 * @param jobObject - object with job data
 */
async function transcribeRemoteServer ({
 pathToAudioFile, // it's called pathToAudioFile, though it's not guaranteed to be audio right now
 language,
 model,
 numberToUse,
 apiEndpoint,
 jobObject
}) {

  // log input
  l({
    pathToAudioFile,
    language,
    model,
    numberToUse,
    apiEndpoint
  })

  // Create a new form instance
  const form = new FormData();

  // add the audio to the form as 'file'
  form.append('file', fs.createReadStream(pathToAudioFile));

  // load in language, model, and websocket number (which we have from the frontend)
  form.append('language', language);
  form.append('model', model);
  form.append('numberToUse', numberToUse);
  form.append('jobObject', JSON.stringify(jobObject))

  // model endpoint
  // todo: pass key
  form.append('apiEndpoint', apiEndpoint)

  // post to server to start process and get data link
  const response = await hitRemoteApiEndpoint(form, apiEndpoint);

  l('response'); // will include data link
  l(response.data);

  // the get endpoint you can call to get transcription data
  const dataEndpoint = response.data.transcribeDataEndpoint;

  // return the endpoint to call recurring gets until fail or completion
  return dataEndpoint;

}

/***
 * Allows a frontend to transcribe to via the API of a remote server
 * @param jobObject - object with job data
 * @returns {Promise<void>}
 */
async function transcribeViaRemoteApi (jobObject) {
  const { filePath, language, model, numberToUse, remoteServerApiUrl } = jobObject;

  // file will be without extension
  const whereWeWantAudio = `${process.cwd()}/transcriptions/${numberToUse}/${numberToUse}`;

  // extract audio from video (if audio, just copy to audio path)
  const fileType = await extraAudioFromVideoIfNeeded({
    videoInputPath: filePath,
    audioOutputPath: whereWeWantAudio
  });

  const processingDataPath = `${process.cwd()}/transcriptions/${numberToUse}/processing_data.json`;

  await createOrUpdateProcessingData(processingDataPath,
    { fileType }
  )

  // hit backend to start transcription and get data endpoint
  const dataEndpoint = await transcribeRemoteServer({
    pathToAudioFile: whereWeWantAudio, // path to file to send (in future should always be audio)
    numberToUse, // websocket number or auto-generated
    apiEndpoint: remoteServerApiUrl, // URL to run against (such as http://host:port/api)

    language, // TODO: support auto-detect
    model, //
    jobObject
  });

  l('dataEndpoint');
  l(dataEndpoint);

  l('remove server api url');
  l(remoteServerApiUrl);

  // const endpoint = `${remoteServerApiUrl}/${dataEndpoint}`;

  // repeatedly check endpoint until failure/completion
  return await checkLatestData(dataEndpoint)
}

const delayInMillisecondsBetweenChecks = 5000;

// check repeatedly and return when completed or failed
async function checkLatestData (dataEndpoint, latestProgress) {
  // get first data
  l(`getting data from: ${dataEndpoint}`)

  let postResponse = await axios.get(dataEndpoint);
  const apiData = postResponse.data;


  // delete this because it's messing up logs
  delete apiData.websocketConnection

  // l('apiData')
  // l(apiData)

  // data from api
  const {
    numberToUse,
    status,
    language,
    model,
    formattedProgress
  } = apiData || {};


  // const remoteProcessingData = apiData.processingData;

  // local directory for this transcription
  const containingFolder = `${process.cwd()}/transcriptions/${numberToUse}`;

  await fs.mkdirp(containingFolder);

  const processingJsonFile = `${containingFolder}/processing_data.json`;
  let localProcessingData = await fs.readFile(processingJsonFile);
  localProcessingData = JSON.parse(localProcessingData);


  const transcriptionDir = `${process.cwd()}/transcriptions`;

  const transcriptionIsProcessing = status === 'processing'
  const transcriptionIsCompleted = status === 'completed'

  // data from local processing
  const {
    websocketNumber,
    originalFileNameWithExtension: filename,
    fileType,
    uploadDurationInSeconds,
  } = localProcessingData;

  const {percentDoneAsNumber, timeElapsed, timeRemaining, speed} = formattedProgress || {};

  const {string: timeRemainingString} = timeRemaining || {};

  l(`${language} ${model} ${percentDoneAsNumber} ${timeRemainingString} ${filename}`.green);

  const timeElapsedString = timeElapsed;

  // percentDoneAsNumber: 0,

  const loadingModel = apiData?.status === 'starting-transcription';

  const transcriptionFailed = apiData?.status === 'error';

  const transcriptionIsTranslating = apiData?.status === 'translating';

  const transcriptionIsStarting = apiData?.status === 'starting';


  // l('localProcessingData');
  // l(localProcessingData);

  // l('remoteProcessingData');
  // l(remoteProcessingData);

  // l('websocket number');
  // l(websocketNumber)


  let websocketConnection;
  if (websocketNumber) {
    websocketConnection = getWebsocketConnectionByNumberToUse(websocketNumber);
  } else {
    l('NO WEBSOCKET');
  }

  // transcription received by backend and starting
  if (transcriptionIsStarting || loadingModel) {
    l('checked remote backend and failed')
    await createOrUpdateProcessingData(processingJsonFile, {
      status: 'starting'
    })

    // TODO: pull out here
    // send websocket progress
    if (websocketConnection) {
      // l('websocket connection exists');

      if (websocketConnection) {
        // tell frontend upload is done
        websocketConnection.send(JSON.stringify({
          status: 'progress',
          // TODO: add GB amount to string
          processingDataString: 'Whisper is loading.. (loading model in GPU)',
        }), function () {
        });
      }
    }

    // wait 5 seconds and hit remote API endpoint again
    await delayPromise(delayInMillisecondsBetweenChecks);
    return await checkLatestData(dataEndpoint);
  // TRANSCRIPTION IS PROCESSING
  } else if (transcriptionIsProcessing) {
    l('checked remote backend and processing')


    // TODO: copy existing processingData
    // TODO: pass progress as a parameter to the function
    // note processing_data as processing
    await createOrUpdateProcessingData(processingJsonFile, {
      status: 'processing',
    })

    // TODO: pull out into function
    // send progress to websocket
    if (websocketConnection) {
      // l('websocket connection exists');

      const processingDataString = generateProcessingDataString({
        timeRemaining: timeRemainingString,
        timeElapsed: timeElapsedString,
        // totalTimeEstimated: 'TODO',
        speed,
        title: filename,
        duration: uploadDurationInSeconds,
        fileType,
        language,
        model
      });

      if(latestProgress !== percentDoneAsNumber) {
        websocketConnection.send(JSON.stringify({
          status: 'progress',
          processingDataString,
          percentDoneAsNumber,
          progressData: {
            timeRemaining,
            timeElapsed: timeElapsedString,
            // totalTimeEstimated: 'TODO',
            speed,
            title: filename,
            duration: uploadDurationInSeconds,
            fileType,
            language,
            model
          }
        }), function () {});
      }
    }

    // wait 5 seconds and hit remote API endpoint again
    await delayPromise(delayInMillisecondsBetweenChecks);
    return await checkLatestData(dataEndpoint, percentDoneAsNumber);

    /** TRANSCRIPTION COMPLETED SUCCESSFULLY **/
  } else if (transcriptionIsTranslating){
    l('checked remote backend and completed')

    websocketConnection.send(JSON.stringify({
      status: 'progress',
      processingDataString: 'Translating..',
    }), function () {});

    // wait 5 seconds and hit remote API endpoint again
    await delayPromise(delayInMillisecondsBetweenChecks);
    return await checkLatestData(dataEndpoint, latestProgress);

  } else if (transcriptionIsCompleted) {
    l('checked remote backend and completed')


    const originalFileNameWithoutExtension = localProcessingData.directorySafeFileNameWithoutExtension;
    const originalFileName = localProcessingData.directorySafeFileNameWithExtension

    let { srtData, vttData, txtData } = apiData;

    l('language');
    l(language)

    // convert cyrillic to latin characters
    if (language === 'Serbian') {
      srtData = convert(srtData)
      vttData = convert(vttData)
      txtData = convert(txtData)
    }

    // load number to use
    const numberToUse = localProcessingData.numberToUse

    const directoryBasedOnNumber = `${transcriptionDir}/${numberToUse}`;

    const srtPath = `${directoryBasedOnNumber}/${originalFileNameWithoutExtension}.srt`;
    const vttPath = `${directoryBasedOnNumber}/${originalFileNameWithoutExtension}.vtt`;
    const txtPath = `${directoryBasedOnNumber}/${originalFileNameWithoutExtension}.txt`;

    l('writing files')
    l({ srtPath, vttPath, txtPath })

    // TODO: these are redundant, should just be createFile
    await createFile(srtPath, srtData)
    await createFile(vttPath, vttData)
    await createFile(txtPath, txtData)

    const { directorySafeFileNameWithoutExtension, directorySafeFileNameWithExtension } = localProcessingData

    const clonedVttPath = `${directoryBasedOnNumber}/${directorySafeFileNameWithoutExtension}_${language}.vtt`;

    // clone the vtt to _$language anyways
    await createFile(clonedVttPath, vttData)

    // create translated vtt files
    if (apiData.translatedFiles?.length) {
      await createTranslatedVtts({
        prependPath: `${directoryBasedOnNumber}/${directorySafeFileNameWithoutExtension}`,
        translatedFiles: apiData.translatedFiles
      })
    }

    const originalFileExtension = path.parse(directorySafeFileNameWithExtension).ext;

    // update processing_data.json
    // TODO: bug here, could overwrite better data
    await createOrUpdateProcessingData(processingJsonFile, {
      status: 'completed',
      ...apiData,
      originalFileExtension // why do I have to do this
    })

    // send completed message to frontend
    // TODO: this should be a function
    if (websocketNumber) {
      // get the websocket connection for relevant upload
      const websocketConnection = getWebsocketConnectionByNumberToUse(websocketNumber);

      //
      if (websocketConnection && websocketConnection.readyState === WebSocket.OPEN) {
        // tell frontend upload is done
        websocketConnection.send(JSON.stringify({
          status: 'Completed',
          filename: localProcessingData.fileSafeNameWithDateTimestamp
        }), function () {});
      }
    }

    const newDirectoryName = localProcessingData.fileSafeNameWithDateTimestamp

    const renamedDirectory = `${transcriptionDir}/${newDirectoryName}`

    // rename directory if it came from the frontend
    if (websocketNumber) {
      await fs.rename(directoryBasedOnNumber, renamedDirectory)
    }

    return {
      status: 'completed'
      // TODO: attach all the data
    }
  } else if (transcriptionFailed) {

    l('detected that failed')
    // TODO: throw an error here instead
    await createOrUpdateProcessingData(processingJsonFile, {
      status: 'failed'
    })
    throw new Error('Transcription failed from remote call')

    // TODO: send message to frontend


    // WHEN TRANSCRIPTION COMPLETED
  } else {
    // TODO: this shouldn't happen
    l('UNDETECTED STATUS TYPE')
    l(apiData.status)

    await delayPromise(delayInMillisecondsBetweenChecks);
    return await checkLatestData(dataEndpoint, latestProgress);

  }
}

async function runRemoteTranscriptionJob (jobObject) {
  delete jobObject.websocketConnection
  // save original processing, maybe not the best place to do it
  await saveOriginalProcessingDataJson(jobObject)

  // hit remote endpoint to start, and then continually get to check
  await transcribeViaRemoteApi(jobObject);
}


module.exports = runRemoteTranscriptionJob;




/** TESTING **/

// test run
async function realMain () {
  const filePath = './output-audio.aac';
  const language = 'Serbian';
  const model = 'tiny';
  const websocketNumber = generateRandomNumber()
  const remoteServerApiUrl = 'http://localhost:3001/api'
  await transcribeViaRemoteApi({
    filePath,
    language,
    model,
    websocketNumber,
    remoteServerApiUrl
  });

  // DECREMENT THING FROM QUEUE

  // HANDLE RESPONSE

  // TODO: build files locally based on response
  l('completed response');
  // l(response);
}

// realMain()