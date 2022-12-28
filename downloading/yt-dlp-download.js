const which = require('which');
const spawn = require('child_process').spawn;
const fs = require('fs-extra');
const projectConstants = require('../constants/constants');
const {formatStdErr} = require('../helpers/formatStdErr');

// yt-dlp --no-mtime -f '\''bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'\''

const l = console.log;

const ytDlpPath = which.sync('yt-dlp')

const testUrl = 'https://www.youtube.com/watch?v=jXVcLVQ4FTg&ab_channel=HighlightHeaven';

async function downloadFile ({
  videoUrl,
  filepath,
  randomNumber
}) {
  return new Promise(async (resolve, reject) => {
    try {

      const ytdlProcess = spawn('yt-dlp', [
        videoUrl,
        '--no-mtime',
        '-f',
        'bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        '-o',
        `./uploads/${randomNumber}.%(ext)s`
      ]);


      ytdlProcess.stdout.on('data', (data) => {
        l(`STDOUT: ${data}`);
      })

      ytdlProcess.stderr.on('data', (data) => {
        l(`STDERR: ${data}`);
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

async function main () {
  const title = await getFilename(testUrl);
  l(title);
  await downloadFile({
    videoUrl: testUrl,
    filepath: `./${title}`
  })
}

// main()

module.exports = {
  downloadFile,
  getFilename
};
