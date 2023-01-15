const transcribeWrapped = require('../transcribe/transcribe-wrapped');
// const { sendOutQueuePositionUpdate } = require('../lib/websockets');
const WebSocket = require("ws");

const l = console.log;

const maxConcurrentJobs = Number(process.env.CONCURRENT_AMOUNT);

// const remoteServerSetup =

const transcribeRemoteServer = require('../scripts/postAudioFile');
const transcribeApiWrapped = require('../transcribe/transcribe-api-wrapped')


// const remoteServerData = [{
//   endpoint: 'http://localhost:3002/api',
//   maxConcurrentJobs: 2,
// }]

// const remoteServerData = [{
//   endpoint: 'http://31.12.82.146:11460/api',
//   maxConcurrentJobs: 3,
// },{
//   endpoint: 'http://localhost:3002/api',
//   maxConcurrentJobs: 2,
// }]
//
const remoteServerData = [{
  endpoint: 'http://localhost:3002/api',
  maxConcurrentJobs: 1,
}]

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

function sendOutQueuePositionUpdate(){
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



let newJobProcessArray = [];

// READ THE FILE SYNC HERE
// if file, then set it up based on that, otherwise max_concurrent
// also change which function is called

let currentIndex = 0;

// TODO: otherwise use max_concurrent if it's just local
for(const server of remoteServerData){
  const { endpoint, maxConcurrentJobs } = server;

  for (let i = 0; i < maxConcurrentJobs; i++) {
    l('adding here')
    const processNumber = currentIndex + 1;

    newJobProcessArray.push({
      endpoint,
      processNumber,
      job : undefined,
      index: currentIndex,
    })

    currentIndex++;
  }
}

l('newJobProcessArray');
l(newJobProcessArray);

global.jobProcesses = newJobProcessArray;

// remove before merge
global.webSocketData = [];

const serverType = process.env.SERVER_TYPE || 'both';

l(serverType)

function determineTranscribeFunctionToUse(jobObject){
  const { websocketNumber, apiToken } = jobObject;

  // don't process locally
  const serverIsFrontend = serverType === 'frontend';

  // process locally and have an API
  const serverIsBoth = 'both';

  // only have an API (dumb backend)
  const serverIsTranscribe = 'transcribe';

  if(serverIsFrontend){
    // server should act as frontend, and not generate subtitles with this instance
    // transcribe with remote server
    return transcribeRemoteServer;

    // when people hit this route, it just checks status via get and saves it
    // and then when it's done, it sets up the files and acts as the frontend

  // server should act as both frontend (/file) and API (/api)
  } else if(serverIsBoth){

    // if apiToken is present, then use that API
    if(apiToken){
      return transcribeApiWrapped;
    } else {
      // local transcription tied with websocket
      return transcribeWrapped
    }

  // server should act as transcribe
  } else if(serverIsTranscribe){

    // only offer the API
    return transcribeApiWrapped;

  } else {
    l('WRONG SERVER TYPE, DEFAULT TO ');
    // default to transcribe api
    return transcribeApiWrapped;
  }
}


global.newQueue = [];

// get amount of running jobs (used to calculate queue position)
function amountOfRunningJobs(){
  let amount = 0;
  for (const process of global.jobProcesses) {
    if(process.job){
      amount++;
    }
  }

  return amount;
}

// run transcribe job and remove from queue and run next queue item if available
async function runJob(jobObject){
  // load info from passed jobObject
  const {
    websocketNumber,
    processNumber,
    remoteServerApiUrl,
    index
  } = jobObject;

  // simulate job running
  try {

    l('starting job from runJob');
    l(jobObject);

    // await delay(10);

    // determine how to transcribe function based on server type
    const transcribeFunctionToUse = determineTranscribeFunctionToUse(jobObject);

    // start transcription
    await transcribeFunctionToUse(jobObject);

    l('job done');

  } catch (err){
    l('error from runJob');
    l(err);
  }

  /** run the next item from the queue **/
  if(global.newQueue.length){
    // get next item from queue (lacks server/process info)
    const nextJobObject = global.newQueue.shift();

    // load server/process info into jobObject
    nextJobObject.processNumber = Number(processNumber);
    nextJobObject.index = index;
    nextJobObject.remoteServerApiUrl = remoteServerApiUrl;

    // mark job process as still taken with next job
    global.jobProcesses[index].job = nextJobObject;

    // TODO: add got out of queue time here
    runJob(nextJobObject);
    // TODO: run queue update here
  } else {
    // indicate that the job process is free
    global.jobProcesses[index].job = undefined;
  }

  sendOutQueuePositionUpdate()
}


// add job to process if available otherwise add to queue
function addToJobProcessOrQueue(jobObject){
  const { websocketNumber, skipToFront } = jobObject;

  l('skipToFront');
  l(skipToFront);

  // put job on process if there is an available process
  for (let jobProcess of global.jobProcesses) {
    // get index here
    const { processNumber, job, endpoint, index } = jobProcess;

    l(`jobProcess ${index}`);

    // process waiting for job
    const processCanTakeJob = job === undefined;

    // found a free process
    if(processCanTakeJob){
      // add process info to jobObject
      jobObject.processNumber = Number(processNumber);

      // add remote url to api
      jobObject.remoteServerApiUrl = endpoint;

      jobObject.index = index;

      // give process a job
      global.jobProcesses[index].job = jobObject;

      runJob(jobObject);
      return
    }
  }

  // TODO: add got in queue time here

  // didn't find an open process, put on the queue

  /** ADD TO QUEUE FUNCTIONALITY **/
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
      // no other skipToFront, so insert at beginning
      global.newQueue.unshift(jobObject);
    }

  } else {
    // insert at end
    global.newQueue.push(jobObject);
  }

  sendOutQueuePositionUpdate();
}

module.exports = {
  addToJobProcessOrQueue,
  amountOfRunningJobs,
  getQueueInformationByWebsocketNumber
}


/** TESTING **/

function main(){
  addToJobProcessOrQueue({websocketNumber: 0, skipToFront: false});
  addToJobProcessOrQueue({websocketNumber: 1, skipToFront: false});
  // addToJobProcessOrQueue({websocketNumber: 2, skipToFront: false});
  //
  // addToJobProcessOrQueue({websocketNumber: 3, skipToFront: false});
  // addToJobProcessOrQueue({websocketNumber: 4, skipToFront: true});

  l('global.jobProcesses');
  l(global.jobProcesses)
  l('global.newQueue');
  l(global.newQueue);
}

// main();

async function delay(delayInSeconds) {
  await new Promise(resolve => setTimeout(resolve, delayInSeconds * 1000));
}
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
