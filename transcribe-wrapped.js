const which = require("which");
const spawn = require('child_process').spawn;
// const spawn = require('await-spawn')

const whisperPath = which.sync('whisper')

l = console.log;

async function transcribe(filename, path, language, model){
  return new Promise((resolve, reject) => {
    try {
      let arguments = [path];

      if(language){
        // set the language for whisper (if undefined with auto-detect and translate off that)
        arguments.push('--language', language);
      }

      if(model){
        // set the language for whisper (if undefined with auto-detect and translate off that)
        arguments.push('--model', model);
      }


      let splitFilename = filename.split("/").pop();

      if(filename){
        arguments.push('-o', `transcriptions/${splitFilename}`);
      }


      // const path = filename;

      // arguments.push(path);

      console.log(arguments);

      // const bl = await spawn(whisperPath, arguments);
      // l(bl);
      // return true


      // log a date when starting just to see how long it's taking
      console.log(new Date())

      const ls = spawn(whisperPath, arguments);

      ls.stdout.on('data', data => {
        console.log(`stdout: ${data}`);
      });

      ls.stderr.on('data', data => {
        console.log(`stderr: ${data}`);
      });

      ls.on('close', code => {
        resolve(code);
        console.log(`child process exited with code ${code}`);
      });
    } catch (err){
      reject(err);
    }

  });

}

module.exports = transcribe;
