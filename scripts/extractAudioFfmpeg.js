const spawn = require('child_process').spawn;
const which = require('which');
const ffprobe = require("ffprobe");
const fs = require('fs-extra');

const l = console.log;

const ffmpegPath = which.sync('ffmpeg')

// ffmpeg -i input-video.avi -vn -acodec copy output-audio.aac


const ffprobePath = which.sync('ffprobe')

l(process.cwd())

// return

const options = {
  overwrite: true,
  encoding: 'utf8'
}

function extractAudio (inputVideoPath, outputAudioPath) {
  return new Promise((resolve, reject) => {
    const ffmpegArguments = [
      '-i', inputVideoPath, // input video path
      '-y', // overwrite output file if it exists
      '-vn', // no video
      '-acodec', 'copy', // copy audio codec (don't re-encode)
      `${outputAudioPath}`
    ]

    const ffmpegProcess = spawn(ffmpegPath, ffmpegArguments);

    // TODO: implement foundLanguagae here
    // let foundLanguage;
    ffmpegProcess.stdout.on('data',  (data) => {
      l(`STDOUT: ${data}`)
    });

    /** console output from stderr **/ // (progress comes through stderr for some reason)
    ffmpegProcess.stderr.on('data', (data) => {
      l(`STDERR: ${data}`)
    });

    /** whisper responds with 0 or 1 process code **/
    ffmpegProcess.on('close', (code) => {
      l(`child process exited with code ${code}`);
      if(code === 0){
        l('extract audio worked')
        resolve();
      } else {
        l('extract failed')
        reject()
      }
    });
  })
}

function getAudioCodec(ffprobeResponse){
  // get audio stream
  const audioStream = ffprobeResponse.streams.find(stream => stream.codec_type === 'audio');

  // get audio codec
  const audioCodec = audioStream.codec_name;

  // like .aac
  return audioCodec
}

/***
 *
 * @param videoInputPath - whatever original file is (video or audio)
 * @param audioOutputPath - should be like transcriptions/numberToUse/numberToUse
 * @returns {Promise<void>}
 */
async function extraAudioFromVideoIfNeeded({ videoInputPath, audioOutputPath }){

  l('videoInputPath');
  l(videoInputPath);
  l('audioOutputPath');
  l(audioOutputPath);

  // get codec information
  const ffprobeResponse = await ffprobe(videoInputPath, { path: ffprobePath });
  // get codec like (aac)
  const audioCodec = getAudioCodec(ffprobeResponse);
  // handle videos differently than audio
  const isVideo = ffprobeResponse.streams.find(stream => stream.codec_type === 'video');

  // if video, extract audio and move to audioFilePath
  if(isVideo){
    // extract audio locally
    const toExtractToPath = `${audioOutputPath}.${audioCodec}`;
    // extract audio
    await extractAudio(videoInputPath, toExtractToPath);
    // move to passed (requested) path
    await fs.move(toExtractToPath, `${audioOutputPath}`, options);
  } else {
    // if audio, just move copy to audioFilePath (leave original to be changed later)
    await fs.copy(videoInputPath, audioOutputPath, options);
  }
}

// const inputVideoPath = './trimmed.mp4';

async function main(){
  try {
    await extraAudioFromVideoIfNeeded({
      videoInputPath: inputVideoPath,
      audioOutputPath: '12341203'
    })
  } catch (err){
    l('err');
    l(err);
  }
}

module.exports = extraAudioFromVideoIfNeeded

// main();
