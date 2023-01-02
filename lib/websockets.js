const WebSocket = require('ws');
const WebSocketServer = WebSocket.WebSocketServer;

function deleteFromGlobalTranscriptionsBasedOnWebsocketNumber(websocketNumber) {
  // find transcription based on websocketNumber
  const closerTranscription = global['transcriptions'].find(function (transcription) {
    return transcription.websocketNumber === websocketNumber;
  })

  const transcriptionIndex = global.transcriptions.indexOf(closerTranscription);
  if (transcriptionIndex > -1) { // only splice array when item is found
    global.transcriptions.splice(transcriptionIndex, 1); // 2nd parameter means remove one item only
  }
}

function createWebSocketServer (server) {
  /** BEGIN WEBSOCKETS **/
  const wss = new WebSocketServer({ server });

  global['webSocketData'] = []

  function heartbeat () {
    // l('checking heartbeat');
    this.isAlive = true;
  }

  /** on new websocket connection **/
  wss.on('connection', function (websocketConnection, request, client) {

    // chart that it exists for first time (add to global.ws)
    websocketConnection.isAlive = true;
    // set up an event, when it receives pong it marks itself alive (overwriting the dead)
    websocketConnection.on('pong', heartbeat);

    const websocketNumber = request.url.split('/')[1];

    global['webSocketData'].push({
      websocketNumber,
      websocket: websocketConnection,
      status: 'alive',
    })

    l(`websocket connected: ${websocketNumber}`);


    websocketConnection.on('close', function (ws) {
      l(`websocket closed: ${websocketNumber}`);
    });
  });

  function deleteWebsocketAndEndProcesses({ websocketNumber, websocketConnection, websocket, index }) {
    l(`Disconnected user found: ${websocketNumber}`);

    // disconnect websocket and delete from global holder
    websocketConnection.terminate();
    global.webSocketData.splice(index, 1);

    // find transcription based on websocketNumber
    const foundProcess = global['transcriptions'].find(function (transcription) {
      return transcription.websocketNumber === websocket.websocketNumber;
    })

    const existingProcess = foundProcess && foundProcess.spawnedProcess;

    // kill the process
    if (existingProcess) {

      // TODO: save processing info and conditionally kill
      foundProcess.spawnedProcess.kill('SIGINT');
      l(`Found and killed process: ${websocketNumber}`);

      const transcriptionIndex = global.transcriptions.indexOf(foundProcess);
      if (index > -1) { // only splice array when item is found
        global.transcriptions.splice(transcriptionIndex, 1); // 2nd parameter means remove one item only
      }
    }

    l(`${websocketNumber} Deleted from global.webSocketData`);

    if (existingProcess) {
      if (existingProcess) l(`${websocketNumber} Whisper process killed, deleted from global.transcriptions`)

      // loop through websockets and tell them one less is processing
      for (let [, websocket] of global['webSocketData'].entries() ) {
        // the actual websocket
        // l(websocket.websocketNumber)
        const websocketConnection = websocket.websocket;
        if (websocketConnection.readyState === WebSocket.OPEN) {
          // TODO: redo this to use an object
          websocketConnection.send(JSON.stringify('finishedProcessing'));
        }
      }
    }
  }

  function checkForDeath () {
    const totalAmountOfWebsockets = global.webSocketData.length;
    l(`Disconnect Check for ${totalAmountOfWebsockets}`);
    // l(totalAmountOfWebsockets);
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

      /** END ON DEATH FUNCTION **/

      /** TEST FOR ALIVENESS */
      // mark them as dead, but then check immediately after for redemption chance
      websocketConnection.isAlive = false;
      // trigger their pong event
      websocketConnection.ping();
    }
  }

// check every 5 seconds for dead sockets (still takes 10s)
  setInterval(checkForDeath, 1000 * 5);


  /** END WEBSOCKETS **/
}

module.exports = createWebSocketServer;
