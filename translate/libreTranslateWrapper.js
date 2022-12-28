const fetch = require('node-fetch');
const l = console.log;

// TODO: replace this with new instance
const LTHost = process.env.LIBRETRANSLATE;

// l('LTHost');
// l(LTHost)

const endpoint = LTHost + '/translate';

// l('endpoint');
// l(endpoint)


process.on('unhandledRejection', (reason, promise) => {
  l(reason);
  l(promise);
});

async function hitLTBackend ({ text, sourceLanguage, targetLanguage }) {
  const res = await fetch(endpoint, {
    method: 'POST',
    body: JSON.stringify({
      q: text,
      source: sourceLanguage,
      target: targetLanguage
    }),
    headers: { 'Content-Type': 'application/json' }
  });

  return await res.json()
}

async function translateText ({ text, sourceLanguage, targetLanguage }) {
  const translatedResponse = await hitLTBackend({ text, sourceLanguage, targetLanguage });
  // l(translatedResponse);

  const { translatedText, detectedLanguage } = translatedResponse;
  return translatedText;
}

// /** all languages should be as abbreviation **/
//
// // translate from this language
// const sourceLanguage = 'auto';
//
// // into this language
// const targetLanguage = 'es';
//
// const text = 'This is the text I want to translate';
//
// // translate({ text, sourceLanguage, targetLanguage });
//
// async function main(){
//   const translatedText = await translateText({ text, sourceLanguage, targetLanguage });
//   l('translatedText');
//   l(translatedText);
// }
//
// // main();

module.exports = translateText;
