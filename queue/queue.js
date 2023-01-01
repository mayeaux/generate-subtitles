global.queueJobs = [];

global.queueItems = [];

function addItemToQueue(queueData){
  global.queueItems.push(queueData)
}

function addItemToQueueJobs(queueData){
  global.queueJobs.push(queueData)
}

module.exports = {
  addItemToQueue,
  addItemToQueueJobs
}
