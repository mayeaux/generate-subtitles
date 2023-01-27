const fs = require('fs-extra');
const WebSocket = require('ws');

const delayPromise = (delayTime) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, delayTime);
  });
};

async function createFile (filePath, fileData) {
  const options = {
    overwrite: true,
    encoding: 'utf8'
  }

  fs.writeFileSync(filePath, fileData, options);
}

async function createOrUpdateProcessingData (processingPath, objectToMerge) {
  // l('processinGPath');
  // l(processingPath)

  const dataExists = fs.existsSync(processingPath)

  let originalObject;
  if (dataExists) {
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

function getWebsocketConnectionByNumberToUse (numberToUse) {
  const foundWebsocketConnection = (global.webSocketData.find(connection => connection.websocketNumber === numberToUse))?.websocket
  if (foundWebsocketConnection.readyState === WebSocket.OPEN) {
    return foundWebsocketConnection
  }
}

function capitalizeFirstLetter (string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

// generate random 10 digit number
function generateRandomNumber () {
  return Math.floor(Math.random() * 10000000000).toString();
}

module.exports = {
  delayPromise,
  createFile,
  createOrUpdateProcessingData,
  getWebsocketConnectionByNumberToUse,
  capitalizeFirstLetter,
  generateRandomNumber
}