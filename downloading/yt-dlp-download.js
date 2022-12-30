const which = require('which');
const spawn = require('child_process').spawn;
const fs = require('fs-extra');
const projectConstants = require('../constants/constants');
const {formatStdErr} = require('../helpers/formatStdErr');

// yt-dlp --no-mtime -f '\''bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'\''

const l = console.log;

const ytDlpPath = which.sync('yt-dlp')

function extractDataFromString(string){
  const percentDownloaded = parseInt(string.match(/(\d+\.?\d*)%/)[1]);
  const totalFileSize = string.match(/of\s+(.*?)\s+at/)[1];
  const downloadSpeed = string.match(/at\s+(.*?)\s+ETA/)[1];

  const fileSizeValue = totalFileSize.match(/\d+\.\d+/)[0];
  const fileSizeUnit = totalFileSize.split(fileSizeValue)[1];

  return {
    percentDownloaded,
    totalFileSize,
    downloadSpeed,
    fileSizeUnit,
    fileSizeValue,
  }
}

function deleteFromGlobalTranscriptionsBasedOnWebsocketNumber(websocketNumber) {
  // find transcription based on websocketNumber
  const closerTranscription = global['transcriptions'].find(function (transcription) {
    return transcription.websocketNumber === websocketNumber;
  })

  const transcriptionIndex = global.transcriptions.indexOf(closerTranscription);
  if (transcriptionIndex > -1) { // only splice array when item is found
    global.transcriptions.splice(transcriptionIndex, 1); // 2nd parameter means remove one item only
  }
}

async function downloadFile ({
  videoUrl,
  filepath,
  randomNumber,
  websocketConnection,
  filename,
  websocketNumber
}) {
  return new Promise(async (resolve, reject) => {
    try {

      let latestDownloadInfo = '';

      const startedAtTime = new Date();

      const interval = setInterval(() => {
        l(latestDownloadInfo);

        // only run if ETA is in the string
        if(!latestDownloadInfo.includes('ETA')) return

        const { percentDownloaded, totalFileSize, downloadSpeed, fileSizeUnit, fileSizeValue } = extractDataFromString(latestDownloadInfo);

        websocketConnection.send(JSON.stringify({
          message: 'downloadInfo',
          fileName: filename,
          percentDownloaded,
          totalFileSize,
          downloadSpeed,
          startedAtTime,
          fileSizeUnit,
          fileSizeValue
        }), function () {});

      }, 1000);

      const ytdlProcess = spawn('yt-dlp', [
        videoUrl,
        '--no-mtime',
        '-f',
        'bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        '-o',
        `./uploads/${randomNumber}.%(ext)s`
      ]);

      const process = {
        websocketNumber,
        spawnedProcess: ytdlProcess,
      }
      global['transcriptions'].push(process)



      ytdlProcess.stdout.on('data', (data) => {
        l(`STDOUT: ${data}`);
        latestDownloadInfo = data.toString();
      })

      ytdlProcess.stderr.on('data', (data) => {
        l(`STDERR: ${data}`);
      });

      ytdlProcess.on('close', (code) => {
        l(`child process exited with code ${code}`);
        clearInterval(interval)
        if (code === 0) {
          resolve();
        } else {
          reject();
        }
        deleteFromGlobalTranscriptionsBasedOnWebsocketNumber(websocketNumber);
        websocketConnection.send(JSON.stringify({
          message: 'downloadingFinished',
        }), function () {});
      });

    } catch (err) {
      l('error from download')
      l(err);

      reject(err);

      throw new Error(err)
    }

  });

}

async function getFilename (videoUrl) {
  return new Promise(async (resolve, reject) => {
    try {

      const ytdlProcess = spawn('yt-dlp', [
        '--get-filename',
        '-f',
        'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        videoUrl
      ]);

      ytdlProcess.stdout.on('data', (data) => {
        // l(`STDOUTT: ${data}`);
        resolve(data.toString());
      })

      ytdlProcess.stderr.on('data', (data) => {
        // l(`STDERR: ${data}`);
      });

      ytdlProcess.on('close', (code) => {
        l(`child process exited with code ${code}`);
        if (code === 0) {
          resolve();
        } else {
          reject();
        }
      });

    } catch (err) {
      l('error from download')
      l(err);

      reject(err);

      throw new Error(err)
    }

  });

}

const testUrl = 'https://www.youtube.com/watch?v=wnhvanMdx4s';

function generateRandomNumber () {
  return Math.floor(Math.random() * 10000000000).toString();
}

const randomNumber = generateRandomNumber();

async function main () {
  const title = await getFilename(testUrl);
  l(title);
  await downloadFile({
    videoUrl: testUrl,
    randomNumber,
    filepath: `./${title}`
  })
}

// main()

module.exports = {
  downloadFile,
  getFilename
};
