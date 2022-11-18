const which = require("which");
const spawn = require('child_process').spawn;
const fs = require('fs-extra');
const ffprobe = require('ffprobe');
const WebSocket = require('ws');
var convert = require('cyrillic-to-latin')

l = console.log;

const forHumans = require('./helpers').forHumans;
const shouldTranslate = process.env.LIBRETRANSLATE;
const createTranslatedFiles = require('./create-translated-files');

l('create translated');
l(createTranslatedFiles);

const whisperPath = which.sync('whisper')
const ffprobePath = which.sync('ffprobe')


// ps aux
// /usr/bin/python3 /usr/local/bin/whisper uploads/0

async function transcribe(filename, path, language, model, websocketConnection){
  return new Promise(async (resolve, reject) => {
    try {

      websocketConnection.send(JSON.stringify(`Whisper initializing, updates to come...`), function () {});

      // get the upload file name
      let splitFilename = path.split("/").pop();

      const originalUpload = `./uploads/${splitFilename}`;
      const ffprobeResponse = await ffprobe(originalUpload, { path: ffprobePath });

      const audioStream = ffprobeResponse.streams.filter(stream => stream.codec_type === 'audio')[0];
      const uploadDurationInSeconds = Math.round(audioStream.duration);

      const fileDetails = `
            filename: ${filename}
            language: ${language}
            model: ${model}
            uploadDurationInSeconds: ${uploadDurationInSeconds}
            uploadDurationInSecondsHumanReadable: ${forHumans(uploadDurationInSeconds)}
      `.replace(/^ +/gm, ''); // remove indentation

      websocketConnection.send(JSON.stringify({
        message: 'fileDetails',
        fileDetails
      }), function () {});

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
          // delete original upload to save space
          const shouldDeleteOriginalUpload = false;
          if(shouldDeleteOriginalUpload){
            // TODO: move this to uploads directory
            fs.unlinkSync(originalUpload);
          }

          // where the transcription was saved
          const containingDir = `./transcriptions/${splitFilename}`;

          // TODO: add the other srt files here
          // may as well add the original file too

          /** COPY TO BETTER NAME, SRT, VTT, TXT **/
          const transcribedSrtFile = `${containingDir}/${filename}_${language}.srt`;

          const transcribedVttFile = `${containingDir}/${filename}_${language}.vtt`;

          const transcribedTxtFile = `${containingDir}/${filename}_${language}.txt`;

          // copy srt with the original filename
          await fs.copy(`${containingDir}/${splitFilename}.srt`, transcribedSrtFile)

          await fs.copy(`${containingDir}/${splitFilename}.vtt`, transcribedVttFile)

          await fs.copy(`${containingDir}/${splitFilename}.txt`, transcribedTxtFile)

          // convert Serbian to latin
          if(language === 'Serbian'){
            var data = fs.readFileSync(transcribedSrtFile, 'utf-8');

            var newValue = convert(data);

            fs.writeFileSync(transcribedSrtFile, newValue, 'utf-8');
          }

          if(shouldTranslate && language === 'English'){
            websocketConnection.send(JSON.stringify(`Doing translations with LibreTranslate`), function () {});
            await createTranslatedFiles({
              uploadDirectoryName: containingDir,
              transcribedFileName: filename,
              languagesToConvertTo: ['es', 'fr'],
              languageToConvertFrom: 'en'
            })
          }

          // return await
          resolve(code);

          const processingSeconds = Math.round((new Date() - startingDate) / 1000);

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
            startedAt: ${startingDate.toUTCString()}
            finishedAT: ${new Date().toUTCString()}
          `.replace(/^ +/gm, ''); // remove indentation

          // tell frontend upload is done
          websocketConnection.send(JSON.stringify({
            status: 'Completed',
            urlSrt: transcribedSrtFile,
            urlVtt: transcribedVttFile,
            urlTxt: transcribedTxtFile,
            filename,
            detailsString: outputText
          }), function () {});

          // TODO: ^ send the info above here via websocket

          fs.appendFileSync(`${containingDir}/processing_data.txt`, outputText, 'utf8');
        } else {
          l('FAILED!');
          reject();
        }

        global.wss.clients.forEach(function each(client) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify('finishedProcessing'));
          }
        });

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
