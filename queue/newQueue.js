const transcribeWrapped = require('../transcribe/transcribe-wrapped');
// const { sendOutQueuePositionUpdate } = require('../lib/websockets');
const WebSocket = require("ws");

const l = console.log;

const maxConcurrentJobs = Number(process.env.CONCURRENT_AMOUNT);

// const remoteServerSetup =

const transcribeRemoteServer = require('../scripts/postAudioFile');
const transcribeApiWrapped = require('../transcribe/transcribe-api-wrapped')


const remoteServerData = [{
  endpoint: 'http://localhost:3002/api',
  maxConcurrentJobs: 2,
}]

let newJobProcessArray = [];

let currentIndex = 0;

// READ THE FILE SYNC HERE
// if file, then set it up based on that, otherwise max_concurrent
// also change which function is called

// TODO: otherwise use max_concurrent if it's just local
for(const server of remoteServerData){
  const { endpoint, maxConcurrentJobs } = server;

  for (let i = 0; i < maxConcurrentJobs; i++) {
    currentIndex++;
    const processNumber = currentIndex;

    newJobProcessArray.push({
      endpoint,
      processNumber,
      job : undefined
    })
  }
}

l('newJobProcessArray');
l(newJobProcessArray);

global.jobProcesses = newJobProcessArray;

// find process number of job to clear it when done
// TODO: change to numberToUse?
function findProcessNumber(websocketNumber) {
  for (let processNumber in global.oldJobProcesses) {

    const hasOwnProperty = global.oldJobProcesses.hasOwnProperty(processNumber)

    if (hasOwnProperty) {

      const matchesByWebsocket = global.oldJobProcesses[processNumber]?.websocketNumber === websocketNumber;
      if(matchesByWebsocket){
        return processNumber
      }
    }
  }

  return false

  // TODO: throw an error here?
}
function sendOutQueuePositionUpdate(){
  // TODO: have to add it to change API jobs in the queue

  // loop through websockets and tell them one less is processing
  for (let [, websocket] of global['webSocketData'].entries() ) {
    // the actual websocket
    // l(websocket.websocketNumber)
    const websocketConnection = websocket.websocket;
    const websocketNumber = websocket.websocketNumber;

    if (websocketConnection.readyState === WebSocket.OPEN) {

      const { queuePosition } = getQueueInformationByWebsocketNumber(websocketNumber);

      // l('queuePosition');
      // l(queuePosition);

      if(queuePosition) {
        websocketConnection.send(JSON.stringify({
          message: 'queue',
          placeInQueue: queuePosition
        }), function () {});
      }

      // // TODO: send queue messages here
      // websocketConnection.send(JSON.stringify('finishedProcessing'));
    }
  }
}

const serverType = process.env.SERVER_TYPE || 'both';

function determineTranscribeFunctionToUse(jobObject){
  const { websocketNumber, apiToken } = jobObject;

  if(serverType === 'frontend'){
    l('using transcribeRemoteServer');
    return transcribeRemoteServer;
  } else if (serverType === 'both'){
    if(apiToken){
      l('using transcribeApiWrapped');
      return transcribeApiWrapped;
    }
    l('using transcribeWrapped');
    return transcribeWrapped;
  }
}


// run transcribe job and remove from queue and run next queue item if available
async function runJob(jobObject){
  const { websocketNumber } = jobObject;

  // simulate job running
  try {

    l('running job');
    l(jobObject);

    const transcribeFunctionToUse = determineTranscribeFunctionToUse(jobObject);

    // refactor to just pass jobObject
    // await transcribeRemoteServer({
    //   websocketNumber,
    //   language: jobObject.language,
    //   model: jobObject.language,
    //   filePath: jobObject.filePath,
    //   endpoint: jobObject.endpoint,
    // })
    await transcribeFunctionToUse(jobObject);

    l('job done');

  } catch (err){
    l('error from runjob');
    l(err);
  }

  // TODO: replace this with finding the index
  const processNumber = findProcessNumber(websocketNumber);
  const index = 0;
  l('processNumber');
  l(processNumber);

  // run the next item from the queue
  if(global.newQueue.length){
    const nextQueueItem = global.newQueue.shift();

    nextQueueItem.processNumber = Number(processNumber);

    global.jobProcesses[index] = nextQueueItem;

    // TODO: add got out of queue time here
    runJob(nextQueueItem);
  } else {
    global.jobProcesses[index].job = undefined;
  }
}

global.newQueue = [];

// add job to process if available otherwise add to queue
function addToJobProcessOrQueue(jobObject){
  const { websocketNumber, skipToFront } = jobObject;

  l('skipToFront');
  l(skipToFront);

  // put job on process if there is an available process
  for (let jobProcess of global.jobProcesses) {
    // get index here
    const index = 0;
    const processNumber = jobProcess.processNumber;
    const job = jobProcess.job;
    const endpoint = jobProcess.endpoint;

    if(job === undefined){
      jobObject.processNumber = Number(processNumber);
      jobObject.remoteServerApiUrl = endpoint;

      global.jobProcesses[index] = jobObject;
      runJob(jobObject);
      return
    }
  }

  // TODO: add got in queue time here

  // push to newQueue if all processes are busy
  if(skipToFront){
    // last skip to front item
    const lastItem = global.newQueue.filter(queueItem => queueItem.skipToFront === true).slice(-1)[0];

    // insert after latest skipToFront
    if(lastItem){
      const lastItemIndex = global.newQueue.indexOf(lastItem);

      // insert after last item with skipToFront
      global.newQueue.splice(lastItemIndex + 1, 0, jobObject);
    } else {
      // insert at beginning
      global.newQueue.unshift(jobObject);
    }

  } else {
    // insert at end
    global.newQueue.push(jobObject);
  }

  sendOutQueuePositionUpdate();
}

// get amount of running jobs (used to calculate queue position)
function amountOfRunningJobs(){
  let amount = 0;
  for (let processNumber in global.oldJobProcesses) {
    const propValue = global.oldJobProcesses[processNumber];

    if(propValue !== undefined){
      amount++;
    }
  }

  return amount;
}

// get position in queue based on websocketNumber
function getQueueInformationByWebsocketNumber(websocketNumber){
  for (const [index, queueItem] of global.newQueue.entries()) {
    if(queueItem.websocketNumber === websocketNumber){
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

module.exports = {
  addToJobProcessOrQueue,
  amountOfRunningJobs,
  getQueueInformationByWebsocketNumber
}

// function main(){
//   addToJobProcessOrQueue({websocketNumber: 0, skipToFront: false});
//   addToJobProcessOrQueue({websocketNumber: 1, skipToFront: true});
//   addToJobProcessOrQueue({websocketNumber: 2, skipToFront: false});
//
//   addToJobProcessOrQueue({websocketNumber: 3, skipToFront: false});
//   addToJobProcessOrQueue({websocketNumber: 4, skipToFront: true});
//
//   l(global.newQueue);
// }

// main();

// async function delay(delayInSeconds) {
//   await new Promise(resolve => setTimeout(resolve, delayInSeconds * 1000));
// }
//
// function generateRandomNumber(){
//   return Math.floor(Math.random() * 4 + 3);
// }

// async function main(){
//   addToJobProcessOrQueue({ websocketNumber: '1234', seconds: 15 });
//   await delay(generateRandomNumber());
//   // l('delay done')
//   addToJobProcessOrQueue({ websocketNumber: '2345', seconds: 8 });
//   await delay(generateRandomNumber());
//   // l('delay done')
//   addToJobProcessOrQueue({ websocketNumber: '5678', seconds: 5 });
// }

// main();

// setInterval(() => {
//   l('job object');
//   l(jobProcesses);
//   l('queue');
//   l(newQueue);
// }, 1000);

// async function delayJob(seconds){
//   l('delaying 5000');
//   await delay(seconds * 1000);
//   l('delay done');
// }
//
// const newDelayJob = delayJob(3);
// l(newDelayJob)
//
// async function main1(){
//   l('starting');
//   await delay(5000);
//   l('delay 1 done');
//   await newDelayJob;
// }
//
// main1()

// function addJobToProcessesObject(processNumber, jobObject){
//
// }

// async function addToJobProcessOrQueue({ websocketNumber, seconds }){
//   let startedJob = false;
//   for (let prop in jobProcesses) {
//     const propValue = jobProcesses[prop];
//     // l(prop, jobObject[prop]);
//
//     if(propValue === undefined){
//       jobProcesses[prop] = websocketNumber;
//       runJob({ seconds, websocketNumber });
//       startedJob = true;
//       return
//     }
//     l(prop, jobProcesses[prop]);
//   }
//
//   if(!startedJob){
//     queue.push({
//       websocketNumber,
//       seconds,
//     })
//     l('added to queue');
//   }
// }


// async function doNextQueueItem(){
//   if(queue.length > 0){
//     const nextItem = queue.shift();
//     await nextItem();
//     doNextQueueItem();
//   }
// }
