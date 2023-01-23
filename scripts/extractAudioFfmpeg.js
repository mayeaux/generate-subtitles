const spawn = require('child_process').spawn;
const which = require('which');
const ffprobe = require('ffprobe');

const l = console.log;

const ffmpegPath = which.sync('ffmpeg')

const inputVideoPath = './trimmed.mp4';

// ffmpeg -i input-video.avi -vn -acodec copy output-audio.aac


const ffprobePath = which.sync('ffprobe')

l(process.cwd())

// return

function extractAudio (inputVideoPath, outputAudioPath) {
  return new Promise((resolve, reject) => {
    const ffmpegArguments = [
      '-i', inputVideoPath, // input video path
      '-y', // overwrite output file if it exists
      '-vn', // no video
      '-acodec', 'copy', // copy audio codec (don't re-encode)
      `./${outputAudioPath}`
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
      if (code === 0) {
        resolve();
      } else {
        reject()
      }
    });
  })
}

async function getAudioCodec () {
  const ffprobeResponse = await ffprobe(inputVideoPath, { path: ffprobePath });

  l(ffprobeResponse);

  // get audio stream
  const audioStream = ffprobeResponse.streams.find(stream => stream.codec_type === 'audio');

  // get audio codec
  const audioCodec = audioStream.codec_name;

  // like .aac
  return audioCodec
}

async function main () {
  try {
    const audioCodec = await getAudioCodec();
    await extractAudio(inputVideoPath, `output-audio.${audioCodec}`);
  } catch (err) {
    l('err');
    l(err);
  }
}

main();
