const which = require("which");
const spawn = require('child_process').spawn;
const fs = require('fs-extra');
const ffprobe = require('ffprobe');
const WebSocket = require('ws');
var convert = require('cyrillic-to-latin')
const filenamify = require('filenamify')

l = console.log;

const concurrentAmount = process.env.CONCURRENT_AMOUNT;

const safeFileName = function(string){
  return filenamify(string, {replacement: '_' })
}

// const fred = safeFileName('hey this is the third???////////1/4\'');
// l(fred);

const forHumans = require('./helpers').forHumans;
const shouldTranslate = process.env.LIBRETRANSLATE;
const createTranslatedFiles = require('./create-translated-files');

// l('create translated');
// l(createTranslatedFiles);

const whisperPath = which.sync('whisper')
const ffprobePath = which.sync('ffprobe')


// setInterval(function(){
//   l('current global transcriptions');
//   l(global['transcriptions']);
// }, 7000)

// ps aux
// /usr/bin/python3 /usr/local/bin/whisper uploads/0

global.transcriptions = [];

let topLevelValue = 1;
async function transcribe(filename, path, language, model, websocketConnection, websocketNumber, queue){
  return new Promise(async (resolve, reject) => {
    if(!global.queueData.includes(websocketNumber)){
      l('DIDNT HAVE THE QUEUE DATA MATCH, ABORTING');
      // if they're not in the queue, cut them off
      return resolve(true);
    }

    try {

      // todo: refactor this a bit
      websocketConnection.send(JSON.stringify(`Whisper initializing, updates to come...`), function () {});

      // get the upload file name
      let splitFilename = path.split("/").pop();

      const originalUpload = `./uploads/${splitFilename}`;
      const ffprobeResponse = await ffprobe(originalUpload, { path: ffprobePath });

      const audioStream = ffprobeResponse.streams.filter(stream => stream.codec_type === 'audio')[0];
      const uploadDurationInSeconds = Math.round(audioStream.duration);

      const uploadDurationInSecondsHumanReadable = forHumans(uploadDurationInSeconds);

      const fileDetails = `
            filename: ${filename}
            language: ${language}
            model: ${model}
            uploadDurationInSeconds: ${uploadDurationInSeconds}
            uploadDurationInSecondsHumanReadable: ${uploadDurationInSecondsHumanReadable}
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

      let serverNumber = topLevelValue;

      // TODO: get the server here

      // const process = {
      //   websocketNumber: websocketNumber,
      //   spawnedProcess: ls,
      //   serverNumber,
      // }

      if(serverNumber === 1){
        topLevelValue = 2
      } else if(serverNumber === 2){
        topLevelValue = 1
      }

      const process = {
        websocketNumber,
        spawnedProcess: ls,
        serverNumber,
      }

      global['transcriptions'].push(process)

      let foundLanguage;
      // log output from bash
      // TODO: this doesnt use stdout at all
      ls.stdout.on('data', data => {
        websocketConnection.send(JSON.stringify(`stdout: ${data}`), function () {});
        l('data');
        l(data.toString());
        console.log(`STDOUT: ${data}`);

        const dataAsString = data.toString();
        if(dataAsString.includes('Detected language:')){
          l('running hereee');
          foundLanguage = dataAsString.split(':')[1].substring(1).trimEnd();
          l(foundLanguage)
          if(!language) language = foundLanguage
          if(foundLanguage){
            language = `${language} (Auto-Detected)`
          }

          const fileDetails = `
            filename: ${filename}
            language: ${language}
            model: ${model}
            uploadDurationInSeconds: ${uploadDurationInSeconds}
            uploadDurationInSecondsHumanReadable: ${uploadDurationInSecondsHumanReadable}
          `.replace(/^ +/gm, ''); // remove indentation

          websocketConnection.send(JSON.stringify({
            message: 'fileDetails',
            fileDetails
          }), function () {});

          // RESEND data files
        }

        // loop through and do with websockets
        // TODO: I'm surprised this works actually
        // for(let [, websocket] of global['webSocketData'].entries() ) {
        //   // the actual websocket
        //   // l(websocket.websocketNumber)
        //   const websocketConnection = websocket.websocket;
        //   if (websocketConnection.readyState === WebSocket.OPEN) {
        //     websocketConnection.send(JSON.stringify('finishedProcessing'));
        //   }
        // }

      });

      // log output from bash (it all comes through stderr for some reason?)
      ls.stderr.on('data', data => {
        // websocketConnection.send(JSON.stringify(`stderr: ${data}`), function () {});
        l(`STDERR: ${data}, Duration: ${uploadDurationInSecondsHumanReadable} Model: ${model}, Language ${language}, Filename: ${filename}, Queue: ${queue.getPendingLength()}`);

        // loop through and do with websockets
        for(let [, websocket] of global['webSocketData'].entries() ) {
          // the actual websocket
          // l(websocket.websocketNumber)
          // const websocketNumber = websocket.websocketNumber;
          const websocketConnection = websocket.websocket;
          const clientWebsocketNumber = websocket.websocketNumber;
          const websocketFromProcess = websocketNumber;

          let ownershipPerson = 'others'
          if(clientWebsocketNumber === websocketFromProcess){
            ownershipPerson = 'you'
          }

          // TODO : find the global.
          const foundProcess = global.transcriptions.find(function(transcriptionObject){
            return transcriptionObject.websocketNumber === websocketNumber;
          })

          // const  {
          //   websocketNumber: websocketNumber,
          //   spawnedProcess,
          //   serverNumber,
          // } = foundProcess;

          // SEND DATA TO ALL THE FRONTENDS WITH LATEST DATA
          // TODO: we need the global process thing to see it

          // pass latest data to all the open sockets
          if (websocketConnection.readyState === WebSocket.OPEN) {
            /** websocketData message **/
            websocketConnection.send(JSON.stringify({
              message: 'websocketData',
              processingData: data.toString(),
              ownershipPerson,
              serverNumber // on the frontend we'll react different if it it's on server 1 or two
            }));
          }
        }
      });


      // save date when starting just to see how long it's taking
      const startingDate = new Date();
      l(startingDate);

      /** when whisper closes connection **/
      ls.on('close', async (code) => {
        l('code');
        l(code);

        if(!language){
          language = foundLanguage;
        }

        if(code === 0){
          // delete original upload to save space
          const shouldDeleteOriginalUpload = false;
          if(shouldDeleteOriginalUpload){
            // TODO: move this to uploads directory
            fs.unlinkSync(originalUpload);
          }

          // where the transcription was saved
          // TODO: stop using splitFileName
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

          // convert Cyrillic to latin
          if(language === 'Serbian'){
            var data = fs.readFileSync(transcribedSrtFile, 'utf-8');

            var newValue = convert(data);

            fs.writeFileSync(transcribedSrtFile, newValue, 'utf-8');
          }

          // autotranslate with libretranslate
          if(shouldTranslate && language === 'English'){
            websocketConnection.send(JSON.stringify(`Doing translations with LibreTranslate`), function () {});
            await createTranslatedFiles({
              uploadDirectoryName: containingDir,
              transcribedFileName: filename,
              languagesToConvertTo: ['es', 'fr'], // convert to Spanish and French
              languageToConvertFrom: 'en'
            })
          }

          // return await
          resolve(code);

          // just post-processing, you can return the response

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

          // ONSUCCESS
          // for(let [index, websocket] of global['webSocketData'].entries() ) {
          //   // the actual websocket
          //   // l(websocket.websocketNumber)
          //   const websocketConnection = websocket.websocket;
          //   if (websocketConnection.readyState === WebSocket.OPEN) {
          //     websocketConnection.send(JSON.stringify('finishedProcessing'));
          //   }
          // }

          // save data to the file
          fs.appendFileSync(`${containingDir}/processing_data.txt`, outputText, 'utf8');
        } else {

          l('FAILED!');
          reject();
          throw new Error('broken')
        }


        console.log(`child process exited with code ${code}`);
      });
    } catch (err){
      l('error from transcribe')
      l(err);

      // ON FAILURE
      // for(let [index, websocket] of global['webSocketData'].entries() ) {
      //   // the actual websocket
      //   // l(websocket.websocketNumber)
      //   const websocketConnection = websocket.websocket;
      //   if (websocketConnection.readyState === WebSocket.OPEN) {
      //     websocketConnection.send(JSON.stringify('finishedProcessing'));
      //   }
      // }

      reject(err);
    }

  });

}

module.exports = transcribe;
