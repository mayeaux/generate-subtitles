const transcribeWrapped = require('../transcribe/transcribe-wrapped');
// const { sendOutQueuePositionUpdate } = require('../lib/websockets');
const WebSocket = require('ws');

const l = console.log;

const maxConcurrentJobs = Number(process.env.CONCURRENT_AMOUNT);

// create set of numbers from x, such as 1,2,3
function createNumberSet (x) {
  return Array.from({length: x}, (_, i) => i + 1);
}

l('maxConcurrentJobs');
l(maxConcurrentJobs);
const numberSet = createNumberSet(maxConcurrentJobs);

global.jobProcesses = {};

for (const number of numberSet) {
  global.jobProcesses[number] = undefined;
}

l(global.jobProcesses);

// find process number of job to clear it when done
function findProcessNumber (websocketNumber) {
  for (let processNumber in global.jobProcesses) {

    const hasOwnProperty = global.jobProcesses.hasOwnProperty(processNumber)

    if (hasOwnProperty) {

      const matchesByWebsocket = global.jobProcesses[processNumber]?.websocketNumber === websocketNumber;
      if (matchesByWebsocket) {
        return processNumber
      }
    }
  }

  return false

  // TODO: throw an error here?
}
function sendOutQueuePositionUpdate () {
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
}


// run transcribe job and remove from queue and run next queue item if available
async function runJob (jobObject) {
  const { websocketNumber } = jobObject;

  // simulate job running
  try {
    await transcribeWrapped(jobObject);

    l('job done');

  } catch (err) {
    l('error from runjob');
    l(err);
  }

  const processNumber = findProcessNumber(websocketNumber);
  l('processNumber');
  l(processNumber);

  // run the next item from the queue
  if (global.newQueue.length) {
    const nextQueueItem = global.newQueue.shift();

    nextQueueItem.processNumber = Number(processNumber);

    global.jobProcesses[processNumber] = nextQueueItem;

    // TODO: add got out of queue time here
    runJob(nextQueueItem);
  } else {
    global.jobProcesses[processNumber] = undefined;
  }
}

global.newQueue = [];

// add job to process if available otherwise add to queue
function addToJobProcessOrQueue (jobObject) {
  const { websocketNumber, skipToFront } = jobObject;

  l('skipToFront');
  l(skipToFront);

  // put job on process if there is an available process
  for (let processNumber in global.jobProcesses) {
    const propValue = global.jobProcesses[processNumber];

    if (propValue === undefined) {
      jobObject.processNumber = Number(processNumber);

      global.jobProcesses[processNumber] = jobObject;
      runJob(jobObject);
      return
    }
  }

  // TODO: add got in queue time here

  // push to newQueue if all processes are busy
  if (skipToFront) {
    // last skip to front item
    const lastItem = global.newQueue.filter(queueItem => queueItem.skipToFront === true).slice(-1)[0];

    // insert after latest skipToFront
    if (lastItem) {
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
function amountOfRunningJobs () {
  let amount = 0;
  for (let processNumber in global.jobProcesses) {
    const propValue = global.jobProcesses[processNumber];

    if (propValue !== undefined) {
      amount++;
    }
  }

  return amount;
}

// get position in queue based on websocketNumber
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
