const WebSocket = require('ws');
const WebSocketServer = WebSocket.WebSocketServer;
const { getQueueInformationByWebsocketNumber } = require('../queue/newQueue');
const { updateQueueItemStatus } = require('../queue/queue');

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


/** when websocket disconnects **/
function deleteWebsocketAndEndProcesses ({ websocketNumber, websocketConnection, websocket, index }) {
  l(`Disconnected user found: ${websocketNumber}`);

  function matchByWebsocketNumber (item) {
    return item.websocketNumber === websocketNumber;
  }

  // disconnect websocket and delete from global holder
  websocketConnection.terminate();
  global.webSocketData.splice(index, 1);
  l(`${websocketNumber} Deleted from global.webSocketData`);

  // find transcription based on websocketNumber
  const foundProcess = global.transcriptions.find(matchByWebsocketNumber)

  const existingProcess = foundProcess && foundProcess.spawnedProcess;

  // kill the process
  if (existingProcess) {

    // TODO: save processing info and conditionally kill

    // kill spawned process
    foundProcess.spawnedProcess.kill('SIGINT');
    l(`Found and killed process: ${websocketNumber}`);

    // delete from transcription array
    const transcriptionIndex = global.transcriptions.findIndex(matchByWebsocketNumber);

    // only splice array when item is found
    if (index > -1) {
      global.transcriptions.splice(transcriptionIndex, 1); // 2nd parameter means remove one item only
    }
  }

  // delete from queue
  const queueIndex = global.newQueue.findIndex(matchByWebsocketNumber);

  // only splice array when item is found
  if (queueIndex > -1) {

    // 2nd parameter means remove one item only
    global.newQueue.splice(queueIndex, 1);

    l(`${websocketNumber} Deleted from global.newQueue`);
  }

  // only updates if not marked as completed
  updateQueueItemStatus(websocketNumber, 'abandoned');

  // inform every websocket that is in the queue of their updated queue position
  sendOutQueuePositionUpdate();
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
}

/**
 * check for websockets that haven't marked themselves as alive
**/
function checkForDeath () {
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
      deleteWebsocketAndEndProcesses({ websocketNumber, websocketConnection, websocket, index });
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
