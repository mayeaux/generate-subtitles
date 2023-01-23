const WebSocket = require('ws');
const WebSocketServer = WebSocket.WebSocketServer;
const { getQueueInformationByWebsocketNumber } = require('../queue/newQueue');
const { updateQueueItemStatus } = require('../queue/queue');
const serverType = process.env.SERVER_TYPE;
const axios = require('axios');

function deleteFromGlobalTranscriptionsBasedOnWebsocketNumber (websocketNumber) {
  // find transcription based on websocketNumber
  const closerTranscription = global['transcriptions'].find(function (transcription) {
    return transcription.websocketNumber === websocketNumber;
  })

  //
  const transcriptionIndex = global.transcriptions.indexOf(closerTranscription);

  // only splice array when item is found
  if (transcriptionIndex > -1) {
    // 2nd parameter means remove one item only
    global.transcriptions.splice(transcriptionIndex, 1);
  }
}

function matchByWebsocketNumber (websocketNumber) {
  return function (item) {
    return item.websocketNumber === websocketNumber;
  }
}

async function endProcess (websocketNumber) {
  // find transcription based on websocketNumber
  const foundProcess = global.transcriptions.find(matchByWebsocketNumber(websocketNumber));

  const existingProcess = foundProcess && foundProcess.spawnedProcess;

  // kill the process
  if (existingProcess) {

    // TODO: save processing info and conditionally kill

    // kill spawned process
    foundProcess.spawnedProcess.kill('SIGINT');
    l(`Found and killed process: ${websocketNumber}`);

    // delete from transcription array
    const transcriptionIndex = global.transcriptions.findIndex(matchByWebsocketNumber(websocketNumber));

    // only splice array when item is found
    if (index > -1) {
      global.transcriptions.splice(transcriptionIndex, 1); // 2nd parameter means remove one item only
    }
  }
}

/** when websocket disconnects **/
function deleteWebsocketAndSendQueueInformation ({ websocketNumber, websocketConnection, index }) {
  l(`Disconnected user found: ${websocketNumber}`);

  // disconnect websocket and delete from global holder
  websocketConnection.terminate();
  global.webSocketData.splice(index, 1);
  l(`${websocketNumber} Deleted from global.webSocketData`);

  // delete from queue
  const queueIndex = global.newQueue.findIndex(matchByWebsocketNumber(websocketNumber));

  // only splice array when item is found
  if (queueIndex > -1) {

    // 2nd parameter means remove one item only
    global.newQueue.splice(queueIndex, 1);

    l(`${websocketNumber} Deleted from global.newQueue`);
  }

  // only updates if not marked as completed
  updateQueueItemStatus(websocketNumber, 'abandoned');

  // inform every websocket that is in the queue of their updated queue position
  // TODO: am I sure I need to do that?
  // sendOutQueuePositionUpdate();
}

/**
 * find queue information for each websocket and send it (if they're in the queue)
 */
function sendOutQueuePositionUpdate () {
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
    }
  }

  const { queuePosition } = getQueueInformationByWebsocketNumber(websocketNumber);


  // TODO: loop through queue items and if they're not websockets, update their position in processing.json
}

function findJobBasedOnNumberToUse (numberToUse) {
  const foundJob = global.jobProcesses.find(function (jobProcess) {
    return jobProcess?.job?.numberToUse === numberToUse;
  })

  return foundJob;
}

async function cancelRemoteTranscription (numberToUse) {

  const job = findJobBasedOnNumberToUse(numberToUse);

  const { remoteServerApiUrl } = job?.job || {};
  if (!remoteServerApiUrl) {
    l('No remoteServerApiUrl found');
    return;
  }

  const url = `${remoteServerApiUrl}/${numberToUse}/cancel`;

  const response = await axios.post(url);

  l('response from cancelling: ' + numberToUse);
  l(response.data);

  // TODO: find transcription based on numberTouse
  // find server to use
  //
}

/**
 * check for websockets that haven't marked themselves as alive
**/
async function checkForDeath () {
  // tell console how many are connected
  const totalAmountOfWebsockets = global.webSocketData.length;
  l(`Disconnect Check for ${totalAmountOfWebsockets}`);

  // loop through array of objects of websockets
  for (let [index, websocket] of global['webSocketData'].entries() ) {
    // the actual websocket
    // l(websocket.websocketNumber)
    const websocketNumber = websocket.websocketNumber
    const websocketConnection = websocket.websocket;

    /** DEAD WEBSOCKET FUNCTIONALITY **/
    // destroy killed websockets and cancel their transcriptions
    if (websocketConnection.isAlive === false) {
      if (serverType === 'frontend') {
        deleteWebsocketAndSendQueueInformation({ websocketNumber, websocketConnection, index });
        // cancel remote process over http
        await cancelRemoteTranscription(websocketNumber);
      } else {
        deleteWebsocketAndSendQueueInformation({ websocketNumber, websocketConnection, index });
        // end local process
        await endProcess(websocketNumber);
      }
    }

    /** TEST FOR ALIVENESS */
    // mark them as dead, but then check immediately after for redemption chance
    websocketConnection.isAlive = false;
    // trigger their pong event
    websocketConnection.ping();
  }
}

// run on first connection
function setupWebsocket (websocketConnection, request) {
  // random number generated from the frontend (last part of the hit url)
  const websocketNumber = request.url.split('/')[1];

  // TODO: handle case that it's info websocket push



  // add to global array of websockets
  global.webSocketData.push({
    websocketNumber,
    websocket: websocketConnection,
    status: 'alive',
  })

  // chart that it exists for first time (add to global.ws)
  websocketConnection.isAlive = true;

  // send websocket number back to parent function
  return websocketNumber;
}

// called from app.js
function createWebSocketServer (server) {

  // create websocket server
  const wss = new WebSocketServer({ server });

  // instantiate global array of websocket connections
  global.webSocketData = []

  // when a user hits the websocket server
  wss.on('connection', function (websocketConnection, request, client) {

    // add to websocketQueue, and mark as alive
    const websocketNumber = setupWebsocket(websocketConnection, request);

    l(`websocket connected: ${websocketNumber}`);

    // server sets all websockets as dead, but then checks for life, set for true if alive
    websocketConnection.on('pong', () => websocketConnection.isAlive = true )

    // log when user connects / disconnect
    websocketConnection.on('close', () => {
      l('websocket connection')
      // l(websocketConnection)
      l(`websocket closed: ${websocketNumber}`)
      // websocketConnection.isAlive = false
      // checkForDeath();
    });
  });

  // check every 5 seconds for dead sockets (still takes 10s)
  setInterval(checkForDeath, 1000 * 5);
}

module.exports = {
  createWebSocketServer,
  sendOutQueuePositionUpdate,
};
