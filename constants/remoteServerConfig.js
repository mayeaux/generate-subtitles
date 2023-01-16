// const remoteServerData = [{
//   endpoint: 'http://31.12.82.146:11460/api',
//   maxConcurrentJobs: 3,
// },{
//   endpoint: 'http://localhost:3002/api',
//   maxConcurrentJobs: 2,
// }]

const nodeEnv = process.env.NODE_ENV || 'development';

let remoteServerData = [{
  endpoint: 'http://localhost:3002/api',
  maxConcurrentJobs: 1,
}]

if(nodeEnv === 'production'){
  remoteServerData = [{
    endpoint: 'http://31.12.82.146:11460/api',
    maxConcurrentJobs: 2,
  },{
    endpoint: 'http://localhost:3002/api',
    maxConcurrentJobs: 2,
  }]
}

module.exports = remoteServerData;