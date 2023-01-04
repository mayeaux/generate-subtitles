const { generateRequestUrl, normaliseResponse } = require('google-translate-api-browser');
const axios = require('axios');

const l = console.log;

const maximumStringLength = 3000;

function splitString (str) {
  let splitStrings = [];
  let currentString = '';
  const splitString = str.split('\n');

  l('total lines')
  l(splitString.length);

  // TODO: if this was smarter it wouldn't go over 5000 characters,
  // TODO: but it seems to be fine for now
  let counter = 0;
  for (const string of splitString) {
    counter++
    // we have yet to encounter the maximum string length
    if (currentString.length < maximumStringLength) {
      // l('not too long')
      currentString = `${currentString}${string}\n`


      if (counter === splitString.length) {
        splitStrings.push(currentString);
      }
      // currentString = currentString + string + '\n';
    } else {
      l('too long')
      currentString = `${currentString}${string}\n`
      splitStrings.push(currentString);
      currentString = '';
    }
  }
  return splitStrings;
}

function test () {
  const textToTranslate = `Znači tako.
    Tako.
    Vi znate šta vam sleduje?
    Nemamo pojma, to ne piše nigde u pravilniku.
    Od sad ćete razgovarati sa višim instansama.
    Ko je idejni vođa ovog protesta?
    Ja sam.
    Pa, šta da kažem.
    Možda i nije najpametnije što sam to uradila, ali...
    `

  const chunks = splitString(textToTranslate);

  l('chunks');
  l(chunks.length);
  // for(const chunk of chunks) {
  //   l(chunk);
  // }
  // l(chunks);

  let recombined = '';
  for (const chunk of chunks) {
    recombined = recombined + chunk;
  }

  l('recombined');
  l(recombined.length);
  // l(recombined)

  // l(textToTranslate)

  // const chunks = splitString(textToTranslate);
  //
  // l('chunks', chunks);

  const resplit = recombined.split('\n');
  l('resplit');
  l(resplit.length);
// l(textToTranslate.split('\n').length));
}



async function translateText ({ text, targetLanguageCode }) {
  const url = generateRequestUrl(text, { to: targetLanguageCode });
  // l('generated url');
  // l(url);

  let response;
  try {
    response = await axios.get(url);

    const parsedResponse = normaliseResponse(response.data);
    // l('parsedResponse');
    // l(parsedResponse);

    const translatedText = parsedResponse.text;
    // l('translatedText');
    // l(translatedText);

    return translatedText;
  } catch (error) {
    l('errored');
    // l('error', error);
  }
}

async function splitAndTranslateText ({ text, targetLanguageCode }) {
  const chunks = splitString(text);
  l('chunks');
  l(chunks.length);

  let translatedText = '';
  for (const chunk of chunks) {
    const translatedChunk = await translateText({ text: chunk, targetLanguageCode });
    translatedText = translatedText + translatedChunk + '\n';
  }

  return translatedText;
}

function howManyLines (string) {
  return string.split('\n').length;
}

const delayPromise = (delayTime) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, delayTime);
  });
};

async function newMain () {
  await delayPromise(1000);

  let totalTranslatedText = '';
  for (const chunk of chunks) {
    l('\n\n')
    l('chunk');
    l(chunk);

    const translated = await translateText({
      text: chunk,
      targetLanguageCode: 'en'
    });

    l('translated');
    l(translated)
    l('\n\n')

    totalTranslatedText = totalTranslatedText + translated + '\n';
  }

  l('totalTranslatedText');
  l(totalTranslatedText);

  l('how many lines');
  l(howManyLines(totalTranslatedText));
  l(howManyLines(textToTranslate));
  l(howManyLines(recombined));

  l('totalTranslatedText');
  l(totalTranslatedText);
  l('textToTranslate');
  l(textToTranslate);
}

// newMain()

async function main () {
  try {
    const translated = await translateText({
      text: textToTranslate,
      targetLanguageCode: 'en'
    });

    // l('translated');
    // l(translated);
  } catch (err) {
    l('err');
    l(err);
  }
}

// main();

module.exports = splitAndTranslateText;
