// get position in queue based on websocketNumber
const WebSocket = require('ws');
const { createOrUpdateProcessingData } = require('../helpers/utils');
const transcribeRemoteServer = require('../transcribe/transcribe-remote-api');
const transcribeApiWrapped = require('../transcribe/transcribe-api-wrapped');
const transcribeWrapped = require('../transcribe/transcribe-wrapped');

const serverType = process.env.SERVER_TYPE || 'both';

l(serverType)

function getQueueInformationByWebsocketNumber (websocketNumber) {
  for (const [index, queueItem] of global.newQueue.entries()) {
    if (queueItem.websocketNumber === websocketNumber) {
      return {
        queuePosition: index + 1, // 1
        queueLength: global.newQueue.length, // 4
        aheadOfYou: index,
        behindYou: global.newQueue.length - index - 1
      }
    }
  }
  return false
}

function sendOutQueuePositionUpdate () {
  // TODO: have to add it to change API jobs in the queue

  // loop through websockets and tell them one less is processing
  for (let [, websocket] of global.webSocketData.entries() ) {
    // the actual websocket
    // l(websocket.websocketNumber)
    const websocketConnection = websocket.websocket;
    const websocketNumber = websocket.websocketNumber;

    if (websocketConnection.readyState === WebSocket.OPEN) {

      const { queuePosition } = getQueueInformationByWebsocketNumber(websocketNumber);

      // l('queuePosition');
      // l(queuePosition);

      if (queuePosition) {
        websocketConnection.send(JSON.stringify({
          message: 'queue',
          placeInQueue: queuePosition
        }), function () {});
      }

      // // TODO: send queue messages here
      // websocketConnection.send(JSON.stringify('finishedProcessing'));
    }
  }

  updateQueuePositionForApiJobs();
}

async function updateQueuePositionForApiJobs () {
  for (const [index, queueItem] of global.newQueue.entries()) {
    if (!queueItem.websocketNumber) {
      const mergeData = {
        status: 'queue',
        queueData: {
          queuePosition: index + 1, // 1
          queueLength: global.newQueue.length, // 4
          aheadOfYou: index,
          behindYou: global.newQueue.length - index - 1,
        }
      }

      const { numberToUse, apiToken } = queueItem;

      const processingDataPath = `${process.cwd()}/transcriptions/${numberToUse}/processing_data.json`;

      await createOrUpdateProcessingData(processingDataPath, mergeData);
    }
  }
}

function determineTranscribeFunctionToUse (jobObject) {
  const { websocketNumber, apiToken } = jobObject;

  // don't process locally
  const serverIsFrontend = serverType === 'frontend';

  // process locally and have an API
  const serverIsBoth = 'both';

  // only have an API (dumb backend)
  const serverIsTranscribe = 'transcribe';

  if (serverIsFrontend) {
    // server should act as frontend, and not generate subtitles with this instance
    // transcribe with remote server
    return transcribeRemoteServer;

    // when people hit this route, it just checks status via get and saves it
    // and then when it's done, it sets up the files and acts as the frontend

    // server should act as both frontend (/file) and API (/api)
  } else if (serverIsBoth) {

    // if apiToken is present, then use that API
    if (apiToken) {
      return transcribeApiWrapped;
    } else {
      // local transcription tied with websocket
      return transcribeWrapped
    }

    // server should act as transcribe
  } else if (serverIsTranscribe) {

    // only offer the API
    return transcribeApiWrapped;

  } else {
    l('WRONG SERVER TYPE, DEFAULT TO ');
    // default to transcribe api
    return transcribeApiWrapped;
  }
}

module.exports = {
  getQueueInformationByWebsocketNumber,
  sendOutQueuePositionUpdate,
  determineTranscribeFunctionToUse
}