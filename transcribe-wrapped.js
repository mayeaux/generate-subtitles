const which = require("which");
const spawn = require('child_process').spawn;
// const spawn = require('await-spawn')
const fs = require('fs-extra');
const moment = require("moment-timezone");
const momentDurationFormatSetup = require("moment-duration-format");

const whisperPath = which.sync('whisper')

l = console.log;

const thing = moment.duration(123, "months").format();


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

      // save date when starting just to see how long it's taking
      const startingDate = new Date();
      l(startingDate);

      // load websocket by passed number
      let websocketConnection;
      if(global.ws[websocketNumber]){
        websocketConnection = global.ws[websocketNumber]
      }

      l(global.ws);

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


      ls.on('close', code => {
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
