const FormData = require("form-data");
const fs = require("fs-extra");
const axios = require("axios");

const l = console.log;

const endpointToHit = 'http:localhost:3001/api'

function generateRandomNumber () {
  return Math.floor(Math.random() * 10000000000).toString();
}

async function main(){

  // Create a new form instance
  const form = new FormData();


  const audioPath = './output-audio.aac';
  form.append('file', fs.createReadStream(audioPath));

  const language = 'English';
  const model = 'tiny';
  const websocketNumber = generateRandomNumber()

  form.append('language', language);
  form.append('model', model);
  form.append('websocketNumber', websocketNumber);

  l('form headers');
  l(form.getHeaders())

  const response = await axios.post(endpointToHit, form, {
    headers: {
      ...form.getHeaders(),
    },
  });

  l('response');
  l(response);
}

main();