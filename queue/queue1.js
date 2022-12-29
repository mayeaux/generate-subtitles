const _ = require('lodash');

const l = console.log;

const queue1 = [];
// const queue2 = [];
//
//
//
// // Add some promises to queue1
// queue1.push(Promise.resolve('first'));
// queue1.push(Promise.resolve('second'));
// queue1.push(Promise.resolve('third'));
//
// // Add some promises to queue2
// queue2.push(Promise.resolve('fourth'));
// queue2.push(Promise.resolve('fifth'));
// queue2.push(Promise.resolve('sixth'));

// Execute the promises in both queues simultaneously using Promise.all()
// Promise.all([queue1, queue2]).then(results => {
//   // Both queues have been executed
//   console.log(results[0]);
//   console.log(results[1]);
// });


async function waitForDelay (seconds) {
  l('waiting for', seconds, 'seconds');
  // Wait for 1000 milliseconds (1 second)
  await new Promise(resolve => setTimeout(resolve, seconds * 1000));

  // The delay has finished
  console.log(`done waiting for ${seconds} seconds`);
}

async function waitRandomSeconds () {
  const randomNumber = _.random(2, 10);
  l('randomNumber', randomNumber);

  await waitForDelay(randomNumber);
  l('done waiting, randomNumber', randomNumber);
}

async function createPromise (name) {
  return new Promise(async (resolve, reject) => {
    try {
      await waitRandomSeconds
    } catch (error) {
      l('error')
      l(error)
    }
  });
}

// add promise to queue without starting it
queue1.push(createPromise('first'));

// queue1.push(createPromise);
// queue1.push(createPromise);
// queue1.push(createPromise);

const promise = new Promise(async function (resolve, reject) {
  await waitForDelay(10)
  // resolve('done waiting for 10 seconds');
  // do something asynchronous here, but do not call resolve or reject
});

queue1.push(promise);


async function startQueue () {
  for (const promise of queue1) {
    try {
      l('starting promise!');
      l(promise);
      const response = await promise;
      l('response', response);
    } catch (error) {
      l('error')
      l(error)
    }
  }

  global.queueFinished = true;
}

l('startQueue');
l('queue1');
l(queue1);

// startQueue()


let deferreds = [];
let p = new Promise(function (resolve, reject) {
  deferreds.push({resolve: resolve, reject: reject});
});

l('deferreds');
l(deferreds);

async function fred () {
  return await waitForDelay(5);
}

queue1.push(fred);

l(queue1);

global.processingQueue = [];

function startTranscriptionProcess () {

}

function startOrAddNewJob (thisJob) {
  const outstandingJobs = global.processingQueue.length;
  if (outstandingJobs === 0) {
    startTranscriptionProcess(thisJob)
  }
  if (outstandingJobs > 0) {
    processingQueue.push(thisJob)
  }
}

function startNewJobIfExists () {
  const outstandingJobs = processingQueue.length;
  if (outstandingJobs > 0) {
    const nextJob = processingQueue.shift();
    startTranscriptionProcess(nextJob)
  }
}

function onJobEnd () {

}

const transactionStatus = async (seconds) => new Promise((resolve, reject) => {
  if (seconds > 25) {
    reject(new Error('Request timed out'));
  }
  setTimeout(() => {
    resolve('Your transaction is successful');
  }, seconds * 1000);
});

const queue2 = [];
queue2.push(transactionStatus(1));

l(queue2);

function stopQueue () {
  // stop queue

}
