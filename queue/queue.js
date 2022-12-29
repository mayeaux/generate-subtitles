global.queueJobs = [];

function addItemToQueue(queueData){
  global.queueJobs.push(queueData)
}

module.exports = {
  addItemToQueue
}
