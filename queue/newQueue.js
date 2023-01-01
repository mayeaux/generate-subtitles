async function delay(delayInSeconds) {
  await new Promise(resolve => setTimeout(resolve, delayInSeconds * 1000));
}

const l = console.log;

function generateRandomNumber(){
  return Math.floor(Math.random() * 4 + 3);
}

function createNumberSet(x) {
  return Array.from({length: x}, (_, i) => i + 1);
}

const maxConcurrentJobs = 1;

const numberSet = createNumberSet(maxConcurrentJobs);

function findProcessNumber(websocketNumber) {
  for (let processNumber in jobProcesses) {
    if (jobProcesses.hasOwnProperty(processNumber) && jobProcesses[processNumber] === websocketNumber) {
      return processNumber;
    }
  }
}

const jobProcesses = {};

for(const number of numberSet){
  jobProcesses[number] = undefined;
}

l(jobProcesses);

async function runJob({ seconds, websocketNumber }){
  // simulate job running
  await delay(seconds);
  l('job done');
  const processNumber = findProcessNumber(websocketNumber);

  if(newQueue.length){
    const nextQueueItem = newQueue.shift();
    const { websocketNumber, seconds } = nextQueueItem;
    jobProcesses[processNumber] = websocketNumber;
    runJob({ seconds, websocketNumber });
  } else {
    jobProcesses[processNumber] = undefined;
  }

}

const newQueue = [];

function addToJobObjectOrQueue(jobObject){
  const { websocketNumber, seconds } = jobObject;

  for (let processNumber in jobProcesses) {
    const propValue = jobProcesses[processNumber];

    if(propValue === undefined){
      jobProcesses[processNumber] = websocketNumber;
      runJob({ seconds, websocketNumber });
      return
    }
  }

  newQueue.push(jobObject);
}

async function main(){
  addToJobObjectOrQueue({ websocketNumber: '1234', seconds: 15 });
  await delay(generateRandomNumber());
  // l('delay done')
  addToJobObjectOrQueue({ websocketNumber: '2345', seconds: 8 });
  await delay(generateRandomNumber());
  // l('delay done')
  addToJobObjectOrQueue({ websocketNumber: '5678', seconds: 5 });
}

main();

setInterval(() => {
  l('job object');
  l(jobProcesses);
  l('queue');
  l(newQueue);
}, 1000);


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
