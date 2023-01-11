const FormData = require("form-data");
const fs = require("fs-extra");
const axios = require("axios");
const {cu} = require("language-name-map/map");

const l = console.log;

// TODO: should be able to hit any remote API
// TODO load it in like a list
const endpointToHit = 'http:localhost:3001/api'

function generateRandomNumber () {
  return Math.floor(Math.random() * 10000000000).toString();
}

async function hitRemoteApiEndpoint(form, fullApiEndpoint){
  // use passed if available
  const endpointToUse = fullApiEndpoint || endpointToHit;

  const response = await axios.post(endpointToUse, form, {
    headers: {
      ...form.getHeaders(),
    },
  });

  return response
}

async function getNewData(dataUrl){
  let dataResponse = await axios.get(dataUrl);

  l('dataResponse');
  l(dataResponse.data);
  return dataResponse.data
}

function parseData(dataResponse) {
  const transcriptionStatus = dataResponse?.status;

  const transcriptionComplete = transcriptionStatus === 'completed';
  const transcriptionErrored = transcriptionStatus === 'errored';

  const transcriptionIsTranslating = transcriptionStatus === 'translating';

  const transcriptionIsProcessing = transcriptionStatus === 'starting-transcription' ||
    transcriptionStatus === 'transcribing' || transcriptionStatus === 'processing' || transcriptionIsTranslating;

  if (transcriptionComplete) {
    const transcription = dataResponse?.transcription;
    const sdHash = dataResponse?.sdHash;
    const subtitles = dataResponse?.subtitles;
    const processingData = dataResponse?.processingData;

    return {
      status: 'completed',
      transcription,
      sdHash,
      subtitles,
      processingData,
    }
  }

  if(transcriptionIsProcessing){
    const percentDone = dataResponse?.processingData?.progress;
    return {
      status: 'processing',
      percentDone
    }
  }

  if(transcriptionErrored){
    return 'failed'
  }

  return false
}


const machineApiKey = '';

/**
 * Transcribe a file on a remote server
 * @param pathToAudioFile
 * @param language
 * @param model
 * @param websocketNumber
 */
async function transcribeRemoteServer(pathToAudioFile, language, model, websocketNumber, fullApiEndpoint){
  // Create a new form instance
  const form = new FormData();

  // add the audio to the form as 'file'
  form.append('file', fs.createReadStream(pathToAudioFile));

  // load in language, model, and websocket number (which we have from the frontend)
  form.append('language', language);
  form.append('model', model);
  form.append('websocketNumber', websocketNumber);

  const response = await hitRemoteApiEndpoint(form, fullApiEndpoint);

  l('response');
  l(response);

  const dataEndpoint = response.data.transcribeDataEndpoint;

  return dataEndpoint;

}

const delayPromise = (delayTime) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, delayTime);
  });
};

async function createOriginalSrt(){

}

async function createProcessingData(){

}

async function changeFolderName(){

}

async function createTranslatedVtts(){

}

async function checkLatestData(dataEndpoint){
  let dataResponse = await getNewData(dataEndpoint);
  let organizedData = parseData(dataResponse);

  l('response');
  l(organizedData);

  if(organizedData.status === 'failed'){
    l('detected that failed')
    // throw an error here instead
    return {
      status: 'failed'
    }
  } else if(organizedData.status === 'completed'){
    // TODO: create files locally
    await createOriginalSrt()
    await createProcessingData()
    await createTranslatedVtts()
    await changeFolderName()

    l('detected that completed')
    return {
      status: 'completed'
      // TODO: attach all the data
    }
  } else if(organizedData.status === 'inTheQueue'){
    // if queue position changed, send an update

    const formerQueuePosition = 4;
    const currentQueuePosition = 2
    const decectedQueueChange = currentQueuePosition !== formerQueuePosition;

    // TODO: SEND OUT ALERT TO FRONTEND VIA WEBSOCKET

    // call itself again

    l('detected that completed')
    return {
      // TODO: attach all the data
      status: 'completed'
    }
  } else { // TODO: ACTUALLY DETECT THIS PROPERLY

    // update local processing.data.json
    // TODO: SEND OUT ALERT TO FRONTEND VIA WEBSOCKET
    l('detected that processing')
    await delayPromise(5000);
    return await checkLatestData(dataEndpoint);
  }
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
async function transcribeViaRemoteApi({ filePath, language, model, websocketNumber, remoteServerApiUrl }){
  const dataEndpoint = await transcribeRemoteServer(filePath, language, model, websocketNumber, remoteServerApiUrl);

  // repeatedly check endpoint until failure/completion
  return await checkLatestData(dataEndpoint)
}

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

// main();

module.exports = transcribeViaRemoteApi;