const FormData = require("form-data");
const fs = require("fs-extra");
const axios = require("axios");
const {cu} = require("language-name-map/map");

const l = console.log;

// TODO: should be able to hit any remote API
// TODO load it in like a list
const endpointToHit = 'http:localhost:3001/api'

async function createOriginalSrt({ srtPath, srtData }){
  const options = {
    overwrite: true,
    encoding: 'utf8'
  }
  fs.writeFileSync(srtPath, srtData, options);
}

async function createOrUpdateProcessingData(processingPath, objectToMerge){
  l('processinGPath');
  l(processingPath)

  const dataExists = fs.existsSync(processingPath)

  let originalObject;
  if(dataExists){
    // read the original JSON file
    const originalData = fs.readFileSync(processingPath, 'utf8');
    // parse the JSON string into an object
    originalObject = JSON.parse(originalData);
  } else {
    originalObject = {};
  }

  // merge the updateObject into originalObject
  let mergedObject = Object.assign(originalObject, objectToMerge);

//stringify the updated object
  let updatedData = JSON.stringify(mergedObject);

  fs.writeFileSync(processingPath, updatedData);
}

async function createTranslatedVtts(){
  // TODO: write
}

async function changeFolderName(){
  // TODO: rename
}

// post to server to start process
async function hitRemoteApiEndpoint(form, fullApiEndpoint){
  // use passed if available
  const endpointToUse = fullApiEndpoint || endpointToHit;
  l(`Endpoint to use: ${endpointToUse}`);

  const options = {
    headers: {
      ...form.getHeaders(),
    }
  }

  // send form data to endpoint
  const response = await axios.post(endpointToUse, form, options)

  return response
}

// get latest data and log it
async function getNewData(dataUrl){
  let dataResponse = await axios.get(dataUrl);

  l('dataResponse');
  l(dataResponse.data);
  return dataResponse.data
}


const machineApiKey = '';


/**
 * Transcribe a file on a remote server
 * @param pathToAudioFile - Will read this and post it
 * @param language
 * @param model
 * @param numberToUse - Websocket or auto-generated
 * @param fullApiEndpoint - server endpoint like http://remoteaddress:remoteIP/api
 */
async function transcribeRemoteServer({
  pathToAudioFile, // it's called pathToAudioFile, though it's not guaranteed to be audio right now
  language,
  model,
  numberToUse,
  fullApiEndpoint
}){

  // log input
  l({
    pathToAudioFile,
    language,
    model,
    numberToUse,
    fullApiEndpoint
  })

  // Create a new form instance
  const form = new FormData();

  // add the audio to the form as 'file'
  form.append('file', fs.createReadStream(pathToAudioFile));

  // load in language, model, and websocket number (which we have from the frontend)
  form.append('language', language);
  form.append('model', model);
  form.append('numberToUse', numberToUse);

  // model endpoint
  // todo: pass key
  form.append('apiEndpoint', fullApiEndpoint)

  // post to server to start process and get data link
  const response = await hitRemoteApiEndpoint(form, fullApiEndpoint);

  l('response'); // will include data link
  l(response.data);

  // the get endpoint you can call to get transcription data
  const dataEndpoint = response.data.transcribeDataEndpoint;

  // return the endpoint to call recurring gets until fail or completion
  return dataEndpoint;

}

/***
 * Allows a frontend to transcribe to via the API of a remote server
 * @param filePath
 * @param language
 * @param model
 * @param websocketNumber
 * @param fullApiEndpoint
 * @returns {Promise<void>}
 */
async function transcribeViaRemoteApi({ filePath, language, model, numberToUse, remoteServerApiUrl }){
  const dataEndpoint = await transcribeRemoteServer({
    pathToAudioFile: filePath, // path to file to send (in future should always be audio)
    numberToUse, // websocket number or auto-generated
    fullApiEndpoint: remoteServerApiUrl, // URL to run against (such as http://host:port/api)

    language, // TODO: support auto-detect
    model, //
  });

  // repeatedly check endpoint until failure/completion
  return await checkLatestData(dataEndpoint, remoteServerApiUrl)
}





// main();

// parse json object that's returned from API
function parseData(dataResponse) {
  // get the status
  const transcriptionStatus = dataResponse?.status;

  const numberToUse = dataResponse?.numberToUse;

  l('dataResponse');
  l(dataResponse)

  // TODO: just return if it's undefined?

  const transcriptionCompleted = transcriptionStatus === 'completed';
  const transcriptionErrored = transcriptionStatus === 'errored';
  const transcriptionIsTranslating = transcriptionStatus === 'translating';

  // transcriptionStatus === 'starting-transcription'
  // TODO: this isn't really a status, more of a stage

  const transcriptionIsProcessing = transcriptionStatus === 'starting-transcription' ||
    transcriptionStatus === 'transcribing' || transcriptionStatus === 'processing' || transcriptionIsTranslating;

  if (transcriptionCompleted) {
    const transcription = dataResponse?.transcription;
    const sdHash = dataResponse?.sdHash;
    const subtitles = dataResponse?.subtitles;
    const processingData = dataResponse?.processingData;

    const { srtData, vttData, txtData } = dataResponse.processingData;

    const processingDataNumberToUse = processingData.numberToUse;

    delete processingData.srtData;
    delete processingData.vttData;
    delete processingData.txtData;

    return {
      status: 'completed',
      transcription,
      sdHash,
      subtitles,
      processingData,
      srtData,
      vttData,
      txtData,
      numberToUse: processingDataNumberToUse,
    }
  }

  if(transcriptionIsProcessing){
    const percentDone = dataResponse?.processingData?.progress;
    return {
      status: 'processing',
      percentDone,
      numberToUse
    }
  }

  if(transcriptionErrored){
    return {
      status: 'failed',
      numberToUse
    }
  }

  return false
}

async function createOriginalTxt({ txtPath, txtData }){
  const options = {
    overwrite: true,
    encoding: 'utf8'
  }
  fs.writeFileSync(txtPath, txtData, options);
}

async function createOriginalVtt({ vttPath, vttData }){
  const options = {
    overwrite: true,
    encoding: 'utf8'
  }
  fs.writeFileSync(vttPath, vttData, options);
}

// check repeatedly and return when completed or failed
async function checkLatestData(dataEndpoint){
  // get first data
  let dataResponse = await getNewData(dataEndpoint);
  // parse and analyze data
  let organizedData = parseData(dataResponse);


  l('response data');
  l(organizedData);

  const { status, percentDone, numberToUse } = organizedData;

  const containingFolder = `${process.cwd()}/transcriptions/${numberToUse}`;
  await fs.mkdirp(containingFolder);

  const transcriptionDir = `${process.cwd()}/transcriptions`;
  const processingJsonFile = `${containingFolder}/processing_data.json`;

  // TRANSCRIPTION FAILED FOR SOME REASON
  if(organizedData.status === 'failed'){
    l('detected that failed')
    // TODO: throw an error here instead
    await createOrUpdateProcessingData(processingJsonFile, {
      status: 'failed'
    })
    throw new Error('Transcription failed from remote call')


  // WHEN TRANSCRIPTION COMPLETED
  } else if(organizedData.status === 'completed'){
    l('detected that completed')

    const { srtData, vttData, txtData } = organizedData;

    const numberToUse = organizedData.processingData.numberToUse

    const directoryBasedOnNumber = `${transcriptionDir}/${numberToUse}`;

    const srtPath = `${directoryBasedOnNumber}/${numberToUse}.srt`;
    const vttPath = `${directoryBasedOnNumber}/${numberToUse}.vtt`;
    const txtPath = `${directoryBasedOnNumber}/${numberToUse}.txt`;
    
    l('writing files')
    l({ srtPath, vttPath, txtPath })

    await createOriginalSrt({ srtPath, srtData })
    await createOriginalVtt({ vttPath, vttData })
    await createOriginalTxt({ txtPath, txtData })
    await createOrUpdateProcessingData(processingJsonFile, {
      status: 'completed'
    })

    // for(const translatedLanguage of translatedLanguages){
    //   await createTranslatedVtts({ path, language, value })
    // }

    // to-do: rename to the nice name with timestamp
    // await changeFolderName()

    return {
      status: 'completed'
      // TODO: attach all the data
    }
  } else {

    // TODO: ACTUALLY DETECT THIS PROPERLY

    await createOrUpdateProcessingData(processingJsonFile, {
      status: 'processing',
      // TODO: progress
    })

    // update local processing.data.json
    // TODO: SEND OUT ALERT TO FRONTEND VIA WEBSOCKET
    // DETECT WHETHER IT'S A CHANGE FROM LAST



    l('detected that processing')
    await delayPromise(5000);
    return await checkLatestData(dataEndpoint);
  }
}

const delayPromise = (delayTime) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, delayTime);
  });
};

module.exports = transcribeViaRemoteApi;




/** TESTING **/


function generateRandomNumber () {
  return Math.floor(Math.random() * 10000000000).toString();
}

// test run
async function realMain(){
  const filePath = './output-audio.aac';
  const language = 'Serbian';
  const model = 'tiny';
  const websocketNumber = generateRandomNumber()
  const remoteServerApiUrl = 'http://localhost:3001/api'
  await transcribeViaRemoteApi({
    filePath,
    language,
    model,
    websocketNumber,
    remoteServerApiUrl
  });

  // DECREMENT THING FROM QUEUE

  // HANDLE RESPONSE

  // TODO: build files locally based on response
  l('completed response');
  // l(response);
}

// realMain()