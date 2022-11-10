const which = require("which");
const spawn = require('child_process').spawn;
// const spawn = require('await-spawn')
const fs = require('fs-extra');
const whisperPath = which.sync('whisper')

l = console.log;

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

async function transcribe(filename, path, language, model, websocketNumber){
  return new Promise((resolve, reject) => {
    try {
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

      // load websocket by passed number
      let websocketConnection;
      if(global.ws[websocketNumber]){
        websocketConnection = global.ws[websocketNumber]
      }


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

      ls.on('close', code => {
        l('code');
        l(code);

        if(code === 0){
          // delete original upload to save space
          const shouldDeleteOriginalUpload = false;
          if(shouldDeleteOriginalUpload){
            const originalUpload = `./uploads/${splitFilename}`;
            fs.unlinkSync(originalUpload);
          }

          // where the transcription was saved
          const containingDir = `./transcriptions/${splitFilename}`;

          // transcribed srt file
          const transcribedSrtFile = `${containingDir}/${filename}.srt`;

          // copy srt with the original filename
          (async function(){
            await fs.copy(`${containingDir}/${splitFilename}.srt`, transcribedSrtFile)
          })()

          // tell frontend upload is done
          websocketConnection.send(JSON.stringify({
            status: 'Completed',
            url: transcribedSrtFile
          }), function () {});

          // return await
          resolve(code);

          const secondsDifference = (new Date() - startingDate) / 1000
          const humanReadableTime = forHumans(Math.round(secondsDifference));

          const outputText = `
            filename: ${filename}
            secondsDifference: ${secondsDifference}
            humanReadableTime: ${humanReadableTime}
            language: ${language}
            model: ${model}
          `.replace(/^ +/gm, ''); // remove indentation

          fs.appendFileSync(`${containingDir}/processing_data.txt`, outputText, 'utf8');
        } else {
          l('FAILED!');
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
