global.queueJobs = [];

global.queueItems = [];

function addItemToQueue (queueData) {
  global.queueItems.push(queueData)
}

function addItemToQueueJobs (queueData) {
  global.queueJobs.push(queueData)
}

function updateQueueItemStatus (websocketNumber, status) {
  const item = global.queueItems.find((item) => item.websocketNumber === websocketNumber);
  if (item && item.status !== 'completed') {
    item.status = status;
  }
}

function getNumberOfPendingOrProcessingJobs (ip) {
  const numberOfPendingOrProcessingJobs = global.queueItems.filter((item) => item.ip === ip && (item.status === 'pending' || item.status === 'processing')).length;
  return numberOfPendingOrProcessingJobs;
}

module.exports = {
  addItemToQueue,
  addItemToQueueJobs,
  updateQueueItemStatus,
  getNumberOfPendingOrProcessingJobs
}
