const transcribeWrapped = require('../transcribe/transcribe-wrapped');

const l = console.log;

const maxConcurrentJobs = process.env.NODE_ENV === 'development' ? 1 : Number(process.env.CONCURRENT_AMOUNT);

function createNumberSet(x) {
  return Array.from({length: x}, (_, i) => i + 1);
}

const numberSet = createNumberSet(maxConcurrentJobs);

function findProcessNumber(websocketNumber) {
  for (let processNumber in global.jobProcesses) {
    if (global.jobProcesses.hasOwnProperty(processNumber) && global.jobProcesses[processNumber] === websocketNumber) {
      return processNumber;
    }
  }
}

global.jobProcesses = {};

for(const number of numberSet){
  global.jobProcesses[number] = undefined;
}

l(global.jobProcesses);

async function runJob(jobObject){
  const { websocketNumber } = jobObject;

  // simulate job running
  try {
    await transcribeWrapped(jobObject);

    l('job done');

  } catch (err){
    l('error from runjob');
    l(err);
  }

  const processNumber = findProcessNumber(websocketNumber);

  if(global.newQueue.length){
    const nextQueueItem = global.newQueue.shift();
    const { websocketNumber } = nextQueueItem;
    global.jobProcesses[processNumber] = websocketNumber;
    runJob(nextQueueItem);
  } else {
    global.jobProcesses[processNumber] = undefined;
  }


}

global.newQueue = [];

function addToJobObjectOrQueue(jobObject){
  const { websocketNumber, skipToFront } = jobObject;

  l('skipToFront');
  l(skipToFront);

  for (let processNumber in global.jobProcesses) {
    const propValue = global.jobProcesses[processNumber];

    if(propValue === undefined){
      global.jobProcesses[processNumber] = websocketNumber;
      runJob(jobObject);
      return
    }
  }

  // push to newQueue if all processes are busy
  if(skipToFront){
    global.newQueue.unshift(jobObject);
  } else {
    global.newQueue.push(jobObject);
  }
}

function amountOfRunningJobs(){
  let amount = 0;
  for (let processNumber in global.jobProcesses) {
    const propValue = global.jobProcesses[processNumber];

    if(propValue !== undefined){
      amount++;
    }
  }

  return amount;
}

module.exports = {
  addToJobObjectOrQueue,
  amountOfRunningJobs
}

// async function delay(delayInSeconds) {
//   await new Promise(resolve => setTimeout(resolve, delayInSeconds * 1000));
// }
//
// function generateRandomNumber(){
//   return Math.floor(Math.random() * 4 + 3);
// }

// async function main(){
//   addToJobObjectOrQueue({ websocketNumber: '1234', seconds: 15 });
//   await delay(generateRandomNumber());
//   // l('delay done')
//   addToJobObjectOrQueue({ websocketNumber: '2345', seconds: 8 });
//   await delay(generateRandomNumber());
//   // l('delay done')
//   addToJobObjectOrQueue({ websocketNumber: '5678', seconds: 5 });
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

// async function addToJobObjectOrQueue({ websocketNumber, seconds }){
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
