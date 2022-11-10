const which = require("which");
const spawn = require('child_process').spawn;
const fs = require('fs-extra');
const ffprobe = require('ffprobe');

const whisperPath = which.sync('whisper')
const ffprobePath = which.sync('ffprobe')

l = console.log;

// ps aux
// /usr/bin/python3 /usr/local/bin/whisper uploads/0

/**
 * Translates seconds into human readable format of seconds, minutes, hours, days, and years
 *
 * @param  {number} seconds The number of seconds to be processed
 * @return {string}         The phrase describing the amount of time
 */
function forHumans ( seconds ) {
  var levels = [
    [Math.floor(seconds / 31536000), 'years'],
    [Math.floor((seconds % 31536000) / 86400), 'days'],
    [Math.floor(((seconds % 31536000) % 86400) / 3600), 'hours'],
    [Math.floor((((seconds % 31536000) % 86400) % 3600) / 60), 'minutes'],
    [(((seconds % 31536000) % 86400) % 3600) % 60, 'seconds'],
  ];
  var returntext = '';

  for (var i = 0, max = levels.length; i < max; i++) {
    if ( levels[i][0] === 0 ) continue;
    returntext += ' ' + levels[i][0] + ' ' + (levels[i][0] === 1 ? levels[i][1].substr(0, levels[i][1].length-1): levels[i][1]);
  };
  return returntext.trim();
}

async function transcribe(filename, path, language, model, websocketConnection){
  return new Promise(async (resolve, reject) => {
    try {

      websocketConnection.send(JSON.stringify(`Whisper initializing, updates to come...`), function () {});

      // queue up arguments, path is the first one
      let arguments = [path];

      // set the language for whisper (if undefined with auto-detect and translate off that)
      if(language){
        arguments.push('--language', language);
      }

      // set the language for whisper (if undefined with auto-detect and translate off that)
      if(model){
        arguments.push('--model', model);
      }

      // set the language for whisper (if undefined with auto-detect and translate off that)
      arguments.push('--verbose', 'False');

      // get the upload file name
      let splitFilename = path.split("/").pop();

      // folder to save .txt, .vtt and .srt
      if(filename){
        arguments.push('-o', `transcriptions/${splitFilename}`);
      }

      l('transcribe arguments');
      l(arguments);

      const ls = spawn(whisperPath, arguments);

      // log output from bash
      ls.stdout.on('data', data => {
        websocketConnection.send(JSON.stringify(`stdout: ${data}`), function () {});
        console.log(`stdout: ${data}`);
      });

      // log output from bash
      ls.stderr.on('data', data => {
        websocketConnection.send(JSON.stringify(`stderr: ${data}`), function () {});
        console.log(`stderr: ${data}`);
      });


      // save date when starting just to see how long it's taking
      const startingDate = new Date();
      l(startingDate);

      ls.on('close', async (code) => {
        l('code');
        l(code);

        if(code === 0){
          const originalUpload = `./uploads/${splitFilename}`;

          // delete original upload to save space
          const shouldDeleteOriginalUpload = false;
          if(shouldDeleteOriginalUpload){
            fs.unlinkSync(originalUpload);
          }

          // where the transcription was saved
          const containingDir = `./transcriptions/${splitFilename}`;

          // transcribed srt file
          const transcribedSrtFile = `${containingDir}/${filename}.srt`;

          // copy srt with the original filename
          await fs.copy(`${containingDir}/${splitFilename}.srt`, transcribedSrtFile)

          // return await
          resolve(code);

          const processingSeconds = Math.round((new Date() - startingDate) / 1000);

          const ffprobeResponse = await ffprobe(originalUpload, { path: ffprobePath });

          const audioStream = ffprobeResponse.streams.filter(stream => stream.codec_type === 'audio')[0];
          const uploadDurationInSeconds = Math.round(audioStream.duration);

          const processingRatio = (uploadDurationInSeconds/processingSeconds).toFixed(2);

          const outputText = `
            filename: ${filename}
            processingSeconds: ${processingSeconds}
            processingSecondsHumanReadable: ${forHumans(processingSeconds)}
            language: ${language}
            model: ${model}
            upload: ${splitFilename}
            uploadDurationInSeconds: ${uploadDurationInSeconds}
            uploadDurationInSecondsHumanReadable: ${forHumans(uploadDurationInSeconds)}
            processingRatio: ${processingRatio}
          `.replace(/^ +/gm, ''); // remove indentation

          // tell frontend upload is done
          websocketConnection.send(JSON.stringify({
            status: 'Completed',
            url: transcribedSrtFile,
            detailsString: outputText
          }), function () {});

          // TODO: ^ send the info above here via websocket

          fs.appendFileSync(`${containingDir}/processing_data.txt`, outputText, 'utf8');
        } else {
          l('FAILED!');
          reject();
        }

        console.log(`child process exited with code ${code}`);
      });
    } catch (err){
      l('error from transcribe')
      l(err);
      reject(err);
    }

  });

}

module.exports = transcribe;
