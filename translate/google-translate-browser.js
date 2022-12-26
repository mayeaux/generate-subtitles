const { generateRequestUrl, normaliseResponse } = require('google-translate-api-browser');
const axios = require('axios');
const {simplified} = require("zh-convert");
const convert = require("cyrillic-to-latin");
const {tr} = require("language-name-map/map");

// const textToTranslate = `Welcome to English in a minute.\nMost people enjoy going to parties.\nYou got to be around friends, eat food, and maybe listen to music.\nBut do your parties ever have animals?\nParty animal.\nHey Jonathan, are you as ready as I am for the weekend?\nOh yeah.\nI'm going to my brother's birthday party on Friday.\nMy cousin is having her graduation party Saturday.\nAnd I'm hosting the karaoke party on Sunday.\nWow, you are quite the party animal aren't you?\nThat's nothing. You should have seen me in college.\nA party animal is not an actual animal.\nIt is a person who really enjoys going to parties.\nMost of their time is spent finding out where the latest and best party is going to be.\nAnd that's English in a minute.\n`;
//
// const url = generateRequestUrl(textToTranslate, { to: "sr" });

// axios.get(url)
//   .then(response => {
//     console.log(normaliseResponse(response.data));
//
//     const parsedResponse = normaliseResponse(response.data);
//     const translatedText = parsedResponse.text;
//
//     let latinCharactersText = convert(translatedText);
//
//
//     console.log(latinCharactersText);
//   })
//   .catch(error => {
//     console.log(error.message);
//   });

async function translateText({ text, targetLanguageCode }){
  const url = generateRequestUrl(text, { to: targetLanguageCode });

  const response = await axios.get(url);

  // l('response');
  // l(response);

  const parsedResponse = normaliseResponse(response.data);
  l('parsedResponse');
  l(parsedResponse);

  const translatedText = parsedResponse.text;

  return translatedText;
}

module.exports = translateText;
