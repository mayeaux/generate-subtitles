const FormData = require('form-data');
const fs = require('fs-extra');
const axios = require('axios');

const l = console.log;

// TODO: should be able to hit any remote API
// TODO load it in like a list
const endpointToHit = 'http:localhost:3001/api'

function generateRandomNumber () {
  return Math.floor(Math.random() * 10000000000).toString();
}

async function hitRemoteApiEndpoint (form, fullApiEndpoint) {
  // use passed if available
  const endpointToUse = fullApiEndpoint || endpointToHit;

  const response = await axios.post(endpointToUse, form, {
    headers: {
      ...form.getHeaders(),
    },
  });

  return response
}

async function getNewData (dataUrl) {
  let dataResponse = await axios.get(dataUrl);

  l('dataResponse');
  l(dataResponse.data);
  return dataResponse.data
}

function checkResponse (dataResponse) {
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

  if (transcriptionIsProcessing) {
    const percentDone = dataResponse?.processingData?.progress;
    return {
      status: 'processing',
      percentDone
    }
  }

  if (transcriptionErrored) {
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
async function transcribeRemoteServer (pathToAudioFile, language, model, websocketNumber, fullApiEndpoint) {
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

async function getResult (dataEndpoint) {
  let dataResponse = await getNewData(dataEndpoint);
  let response = checkResponse(dataResponse);

  l('response');
  l(response);

  if (response.status === 'failed') {
    l('detected that failed')
    return {
      status: 'failed'
    }
  } else if (response.status === 'completed') {

    l('detected that completed')
    return {
      status: 'completed'
      // TODO: attach all the data
    }
  } else {
    l('detected that processing')
    await delayPromise(5000);
    return await getResult(dataEndpoint);
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
async function transcribeViaRemoteApi ({ filePath, language, model, websocketNumber, remoteServerApiUrl }) {
  const dataEndpoint = await transcribeRemoteServer(filePath, language, model, websocketNumber, remoteServerApiUrl);

  return await getResult(dataEndpoint)
}

async function realMain () {
  const filePath = './output-audio.aac';
  const language = 'Serbian';
  const model = 'tiny';
  const websocketNumber = generateRandomNumber()
  const remoteServerApiUrl = 'http://localhost:3001/api'
  const response = await transcribeViaRemoteApi({
    filePath,
    language,
    model,
    websocketNumber,
    remoteServerApiUrl
  });
  l('completed response');
  l(response);
}

realMain()

// main();