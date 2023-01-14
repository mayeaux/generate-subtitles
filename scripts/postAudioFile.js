const FormData = require("form-data");
const fs = require("fs-extra");
const axios = require("axios");
const {cu} = require("language-name-map/map");
const { createFileNames } = require('../lib/transcribing');
const { formatStdErr } = require('../lib/transcribing');
const path = require("path");
const WebSocket = require('ws');
const convert = require('cyrillic-to-latin');
const extraAudioFromVideoIfNeeded = require('../scripts/extractAudioFfmpeg');

const l = console.log;

// TODO: should be able to hit any remote API
// TODO load it in like a list
const endpointToHit = 'http:localhost:3001/api'

const options = {
  overwrite: true,
  encoding: 'utf8'
}

async function createOriginalSrt({ srtPath, srtData }){
  fs.writeFileSync(srtPath, srtData, options);
}

async function createOrUpdateProcessingData(processingPath, objectToMerge){
  l('processinGPath');
  l(processingPath)

  const dataExists = fs.existsSync(processingPath)

  let originalObject;
  if(dataExists){
    // read the original JSON file
    const originalData = fs.readFileSync(processingPath, 'utf8');
    // parse the JSON string into an object
    originalObject = JSON.parse(originalData);
  } else {
    originalObject = {};
  }

  // merge the updateObject into originalObject
  let mergedObject = Object.assign(originalObject, objectToMerge);

//stringify the updated object
  let updatedData = JSON.stringify(mergedObject);

  fs.writeFileSync(processingPath, updatedData);
}

async function createTranslatedVtts({
  prependPath,
  translatedFiles
}){
  for(const translatedFile of translatedFiles){
    const { language, translatedText } = translatedFile;
    const translatedPath = `${prependPath}_${language}.vtt`;

    await createOriginalVtt({
      vttPath: translatedPath,
      vttData: translatedText
    });
  }
  // TODO: write
}

async function changeFolderName(){
  // TODO: rename
}

// post to server to start process
async function hitRemoteApiEndpoint(form, fullApiEndpoint){
  // use passed if available
  const endpointToUse = fullApiEndpoint || endpointToHit;
  l(`Endpoint to use: ${endpointToUse}`);

  const options = {
    headers: {
      ...form.getHeaders(),
    }
  }

  // send form data to endpoint
  const response = await axios.post(endpointToUse, form, options)

  return response
}

// get latest data and log it
async function getNewData(dataUrl){
  let dataResponse = await axios.get(dataUrl);
  return dataResponse.data
}


const machineApiKey = '';


/**
 * Transcribe a file on a remote server
 * @param pathToAudioFile - Will read this and post it
 * @param language
 * @param model
 * @param numberToUse - Websocket or auto-generated
 * @param fullApiEndpoint - server endpoint like http://remoteaddress:remoteIP/api
 */
async function transcribeRemoteServer({
  pathToAudioFile, // it's called pathToAudioFile, though it's not guaranteed to be audio right now
  language,
  model,
  numberToUse,
  fullApiEndpoint,
  jobObject
}){

  // log input
  l({
    pathToAudioFile,
    language,
    model,
    numberToUse,
    fullApiEndpoint
  })

  // TODO: extract audio here

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
  form.append('apiEndpoint', fullApiEndpoint)

  // post to server to start process and get data link
  const response = await hitRemoteApiEndpoint(form, fullApiEndpoint);

  l('response'); // will include data link
  l(response.data);

  // the get endpoint you can call to get transcription data
  const dataEndpoint = response.data.transcribeDataEndpoint;

  // return the endpoint to call recurring gets until fail or completion
  return dataEndpoint;

}

async function saveOriginalProcessingDataJson(jobObject){
  const { numberToUse } = jobObject;

  // processing_data.json path
  const holdingFolder = `${process.cwd()}/transcriptions/${numberToUse}`;

  await fs.mkdirp(holdingFolder);

  const processingPath = `${holdingFolder}/processing_data.json`;

  await createOrUpdateProcessingData(processingPath, jobObject)
}

/***
 * Allows a frontend to transcribe to via the API of a remote server
 * @param filePath
 * @param language
 * @param model
 * @param websocketNumber
 * @param fullApiEndpoint
 * @returns {Promise<void>}
 */
async function transcribeViaRemoteApi(jobObject){
  const { filePath, language, model, numberToUse, remoteServerApiUrl } = jobObject;

  const whereWeWantAudio = `${process.cwd()}/transcriptions/${numberToUse}/${numberToUse}`;

  await extraAudioFromVideoIfNeeded({
    videoInputPath: filePath,
    audioOutputPath: whereWeWantAudio
  });

  // hit backend to start transcription and get data endpoint
  const dataEndpoint = await transcribeRemoteServer({
    pathToAudioFile: whereWeWantAudio, // path to file to send (in future should always be audio)
    numberToUse, // websocket number or auto-generated
    fullApiEndpoint: remoteServerApiUrl, // URL to run against (such as http://host:port/api)

    language, // TODO: support auto-detect
    model, //
    jobObject
  });

  // repeatedly check endpoint until failure/completion
  return await checkLatestData(dataEndpoint, remoteServerApiUrl)
}

// function sendLatestData(formattedStdErr, numberToUse){
//   for (let websocket of global.webSocketData ) {
//     const websocketConnection = websocket.websocket;
//     const clientWebsocketNumber = websocket.websocketNumber;
//
//     const websocketFromProcess = numberToUse
//
//     let ownershipPerson = 'others'
//     if (clientWebsocketNumber === websocketFromProcess) {
//       ownershipPerson = 'you'
//     }
//
//     const formattedProgress = formattedStdErr
//
//     // we don't have the progress string, maybe pass it?
//     const { percentDoneAsNumber, percentDone, speed, timeRemaining  } = formattedProgress;
//
//     let processingString = '';
//     if (timeRemaining) {
//       processingString = `[${percentDone}] ${timeRemaining.string} Remaining, Speed ${speed}f/s`
//     }
//     l(processingString)
//
//     // TODO: pull into function
//     // pass latest data to all the open sockets
//     if (websocketConnection.readyState === WebSocket.OPEN) {
//       /** websocketData message **/
//       // TODO: only relevant to websocket that are in queue and involved people
//       websocketConnection.send(JSON.stringify({
//         message: 'websocketData',
//         processingData: processingString,
//         // processingData: data.toString(),
//         ownershipPerson,
//         formattedProgress,
//         percentDone: percentDoneAsNumber,
//         timeRemaining,
//         speed,
//       }));
//     }
//   }
// }






// main();

// parse json object that's returned from API
function parseData(dataResponse, latestProgress) {
  // get the status
  const transcriptionStatus = dataResponse?.status;

  const numberToUse = dataResponse?.numberToUse;

  // l('dataResponse');
  // l(dataResponse)

  // TODO: just return if it's undefined?

  const transcriptionCompleted = transcriptionStatus === 'completed';
  const transcriptionErrored = transcriptionStatus === 'errored';
  const transcriptionIsTranslating = transcriptionStatus === 'translating';

  // transcriptionStatus === 'starting-transcription'
  // TODO: this isn't really a status, more of a stage

  const transcriptionIsProcessing = transcriptionStatus === 'starting-transcription' ||
    transcriptionStatus === 'transcribing' || transcriptionStatus === 'processing' || transcriptionIsTranslating;

  // transcription is completed
  if (transcriptionCompleted) {
    const transcription = dataResponse?.transcription;
    const sdHash = dataResponse?.sdHash;
    const subtitles = dataResponse?.subtitles;
    const processingData = dataResponse?.processingData;

    const { srtData, vttData, txtData } = dataResponse.processingData;

    const processingDataNumberToUse = processingData.numberToUse;

    delete processingData.srtData;
    delete processingData.vttData;
    delete processingData.txtData;

    // TODO: add translations here

    return {
      status: 'completed',
      transcription,
      sdHash,
      subtitles,
      processingData,
      srtData,
      vttData,
      txtData,
      numberToUse: processingDataNumberToUse,
    }
  }

  // transaction is processing
  if(transcriptionIsProcessing){
    const { percentDone, timeRemaining, timeElapsed, speed, percentDoneAsNumber } = dataResponse?.processingData?.formattedProgress || {};

    const { string, hoursRemaining, secondsRemaining, } = timeRemaining || {};

    let processingString = '';
    if (timeRemaining) {
      processingString = `[${percentDone}] ${timeRemaining.string} Remaining, Speed ${speed}f/s`
    }

    // formattedProgress: {
    //   progressBar: '█▍        ',
    //     percentDone: '14%',
    //     timeElapsed: '07:38',
    //     speed: '126.96',
    //     percentDoneAsNumber: 14,
    //     timeRemaining: {
    //     string: '46:28',
    //       hoursRemaining: 0,
    //       minutesRemaining: 46,
    //       secondsRemaining: 28
    //   }
    // }

    // only do on change, otherwise you push out a new one every 5s
    // sendLatestData(percentDone, numberToUse);

    // TODO: add better data here for frontend
    return {
      status: 'processing',
      percentDone,
      numberToUse
    }
  }

  // transcription errored
  if(transcriptionErrored){
    return {
      status: 'failed',
      numberToUse
    }
  }

  return false
}

async function createOriginalTxt({ txtPath, txtData }){
  fs.writeFileSync(txtPath, txtData, options);
}

async function createOriginalVtt({ vttPath, vttData }){
  fs.writeFileSync(vttPath, vttData, options);
}

const delayInMillisecondsBetweenChecks = 5000;

function getWebsocketConnectionByNumberToUse(numberToUse){
  const foundWebsocketConnection = (global.webSocketData.find(connection => connection.websocketNumber === numberToUse))?.websocket
  if(foundWebsocketConnection.readyState === WebSocket.OPEN){
    return foundWebsocketConnection
  }
}

// check repeatedly and return when completed or failed
async function checkLatestData(dataEndpoint, latestProgress){
  // get first data
  let dataResponse = await getNewData(dataEndpoint);
  delete dataResponse.websocketConnection

  // l('dataResponse');
  // l(dataResponse);

  // status: 'starting-transcription',

  // get target progress here
  // parse and analyze data
  // TODO: remove this, just annoying
  let organizedData = parseData(dataResponse);

  // l('response data');
  // l(organizedData);

  const { status, percentDone, numberToUse } = organizedData;

  const containingFolder = `${process.cwd()}/transcriptions/${numberToUse}`;
  await fs.mkdirp(containingFolder);

  const transcriptionDir = `${process.cwd()}/transcriptions`;
  const processingJsonFile = `${containingFolder}/processing_data.json`;

  const transcriptionIsProcessing = status === 'processing'
  const transcriptionIsCompleted = status === 'completed'


  const processingData = dataResponse.processingData;


  let localProcessingData = await fs.readFile(processingJsonFile);
  localProcessingData = JSON.parse(localProcessingData);


  l('PROCESSING DATA');

  const { language, model, formattedProgress, websocketNumber } = processingData || {};

  l(language, model, formattedProgress);

  const { percentDoneAsNumber, timeElapsed, timeRemaining, speed } = formattedProgress || {};

  const { hoursRemaining, minutesRemaining, secondsRemaining, string: timeRemainingString } = timeRemaining || {};

  const timeElapsedString = timeElapsed;

  // percentDoneAsNumber: 0,


  'Whisper has loaded and your transcription has started'

  const loadingModel = dataResponse?.status === 'starting-transcription';

  const transcriptionFailed = dataResponse?.status === 'error';

  const transcriptionIsTranslating = dataResponse?.status === 'translating';

  const transcriptionIsStarting = dataResponse?.status === 'starting';



  if(transcriptionFailed){
    await createOrUpdateProcessingData(processingJsonFile, {
      status: 'failed'
    })
    throw new Error('Transcription failed from remote call')
  }

  // transcription received by backend and starting
  if(transcriptionIsStarting){
    await createOrUpdateProcessingData(processingJsonFile, {
      status: 'starting'
    })

    await delayPromise(delayInMillisecondsBetweenChecks);
    return await checkLatestData(dataEndpoint, latestProgress);

  } else if(loadingModel){

    // send websocket progress
    if(websocketNumber){
      const websocketConnection = getWebsocketConnectionByNumberToUse(numberToUse);

      if(websocketConnection){
        // tell frontend upload is done
        websocketConnection.send(JSON.stringify({
          status: 'progress',
          processingDataString: 'Whisper is loading.. (loading model in GPU)', // TODO: say GB amount
        }), function () {});
      }
    }

    // TODO: save to processing data

    await delayPromise(delayInMillisecondsBetweenChecks);
    return await checkLatestData(dataEndpoint, latestProgress);
  }

  // TRANSCRIPTION IS PROCESSING
  else if(transcriptionIsProcessing) {

    // TODO: copy existing processingData
    // TODO: pass progress as a parameter to the function
    // note processing_data as processing
    await createOrUpdateProcessingData(processingJsonFile, {
      status: 'processing',
    })

    if(websocketNumber){
      // get the websocket connection for relevant upload
      const websocketConnection = getWebsocketConnectionByNumberToUse(numberToUse);

      const getProcessingVideo = '';

      const progressInformation = {
        language,
        model,
        timeRemainingString,
        timeElapsedString,
        percentDoneAsNumber,
        speed,
      }

      function generateProcessingDataString({
                                              timeRemaining,
                                              timeElapsed,
                                              totalTimeEstimated,
                                              speed,
                                              title,
                                              duration,
                                              fileType,
                                              language,
                                              model
                                            }){
        let processingData = [
          "Time Remaining: " + timeRemaining,
          "Time Elapsed: " + timeElapsed,
          // "Total Time Estimated: " + totalTimeEstimated,
          "Speed: " + speed + " (f/s)",
          "",
          title,
          "Duration: " + duration,
          "File Type: " + fileType,
          "Language: " + language,
          "Model: " + model
        ];
        return processingData.join(" \n\n ");
      }

      const { originalFileNameWithExtension, uploadDurationInSeconds } = localProcessingData

      const processingDataString = generateProcessingDataString({
        timeRemaining: timeRemainingString,
        timeElapsed: timeElapsedString,
        // totalTimeEstimated: 'TODO',
        speed,
        title: originalFileNameWithExtension,
        duration: uploadDurationInSeconds, // TODO: have to save it earlier on backend to access it
        fileType: 'Video',
        language,
        model
      });


      // TODO: send some better stuff to frontend
      // send progress to relevant frontend (working)
      if(websocketConnection){
        // tell frontend upload is done
        websocketConnection.send(JSON.stringify({
          status: 'progress',
          processingDataString,
          percentDoneAsNumber,
        }), function () {});
      }
    }

    // PASS LATEST PROGRESS OUT

    // not done yet
    // if(percentDone > latestProgress){
    //   sendLatestData(data, numberToUse);
    // }


    l('detected that processing')
    // DELAY 5 SECONDS AND
    await delayPromise(delayInMillisecondsBetweenChecks);
    return await checkLatestData(dataEndpoint, latestProgress);



  /** TRANSCRIPTION COMPLETED SUCCESSFULLY **/
  } else if(transcriptionIsCompleted){
    l('detected that completed')

    const originalFileNameWithoutExtension = localProcessingData.directorySafeFileNameWithoutExtension;
    const originalFileName = localProcessingData.directorySafeFileNameWithExtension

    const { language } = localProcessingData;

    // language undefined

    let { srtData, vttData, txtData } = organizedData;

    l('language');
    l(language)

    // convert cyrillic to latin characters
    if(language === 'Serbian'){
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

    await createOriginalSrt({ srtPath, srtData })
    await createOriginalVtt({ vttPath, vttData })
    await createOriginalTxt({ txtPath, txtData })

    const { directorySafeFileNameWithoutExtension, directorySafeFileNameWithExtension } = localProcessingData

    // clone the vtt to _$language anyways
    await createOriginalVtt({
      vttPath: `${directoryBasedOnNumber}/${directorySafeFileNameWithoutExtension}_${language}.vtt`,
      vttData,
    })

    if(organizedData.processingData.translatedFiles?.length){
      await createTranslatedVtts({
        prependPath: `${directoryBasedOnNumber}/${directorySafeFileNameWithoutExtension}`,
        translatedFiles: organizedData.processingData.translatedFiles
      })
    }

    const originalFileExtension = path.parse(directorySafeFileNameWithExtension).ext;

    // update processing.data.json
    // TODO: bug here, could overwrite better data
    await createOrUpdateProcessingData(processingJsonFile, {
      status: 'completed',
      ... organizedData.processingData,
      originalFileExtension // who do I have to do this
    })

    if(websocketNumber){
      // get the websocket connection for relevant upload
      const websocketConnection = getWebsocketConnectionByNumberToUse(websocketNumber);

      //
      if(websocketConnection && websocketConnection.readyState === WebSocket.OPEN){
        // tell frontend upload is done
        websocketConnection.send(JSON.stringify({
          status: 'Completed',
          filename: localProcessingData.fileSafeNameWithDateTimestamp
        }), function () {});
      }
    }

    const newDirectoryName = localProcessingData.fileSafeNameWithDateTimestamp

    const renamedDirectory = `${transcriptionDir}/${newDirectoryName}`

    // TODO: only rename if not api

    const isApiCall = !websocketNumber;

    if(!isApiCall){
      await fs.rename(directoryBasedOnNumber, renamedDirectory)
    }

    return {
      status: 'completed'
      // TODO: attach all the data
    }
  } else if(transcriptionFailed){
    l('detected that failed')
    // TODO: throw an error here instead
    await createOrUpdateProcessingData(processingJsonFile, {
      status: 'failed'
    })
    throw new Error('Transcription failed from remote call')


    // WHEN TRANSCRIPTION COMPLETED
  } else {
    // TODO: this shouldn't happen
    l('UNDETECTED STATUS TYPE')
    l(dataResponse.status)

    await delayPromise(delayInMillisecondsBetweenChecks);
    return await checkLatestData(dataEndpoint, latestProgress);

  }
}

async function runRemoteTranscriptionJob(jobObject){
  delete jobObject.websocketConnection
  // save original processing, maybe not the best place to do it
  await saveOriginalProcessingDataJson(jobObject)

  // hit remote endpoint to start, and then continually get to check
  await transcribeViaRemoteApi(jobObject);
}

const delayPromise = (delayTime) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, delayTime);
  });
};


module.exports = runRemoteTranscriptionJob;




/** TESTING **/


function generateRandomNumber () {
  return Math.floor(Math.random() * 10000000000).toString();
}

// test run
async function realMain(){
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