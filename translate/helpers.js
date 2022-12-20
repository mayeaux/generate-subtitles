const fs = require('fs-extra');
const readline = require('readline');

l = console.log;


function isTimestampLine(num) {
  return (num - 3) % 3 === 0;
}

function isTextLine(num) {
  return num !== 1 && ((num - 1) % 3 === 0);
}


const srtPath = '../examples/dnevnik.srt'

let topLevelValue = 1;
async function stripOutTextAndTimestamps(filePath){
  return new Promise(async (resolve, reject) => {
    const rl = await readline.createInterface({
      input: fs.createReadStream(filePath, 'utf8')
    });

    let strippedText = '';
    let timestampsArray = [];

    let counter = 1;
    rl.on('line', (line) => {
      l(counter)
      l(line);
      const timestampLine = isTimestampLine(counter)
      const textLine = isTextLine(counter)
      l('is timestamp line', timestampLine)
      l('is text line', textLine)
      l(`\n\n`)
      if(textLine) {
        strippedText = strippedText + `${line}\n`
      }
      if(timestampLine) {
        timestampsArray.push(line)
      }
      counter++
    });

    rl.on('close', async function () {
      l(`\n\n`)
      resolve({
        strippedText,
        timestampsArray
      })
    })

  });

}

// async function main(){
//   const { strippedText, timestampsArray } = await stripOutTextAndTimestamps(srtPath)
//   l(strippedText);
//   l(timestampsArray);
// }

// main();

async function reformatVtt(){
  const timestampArray = [
    '00:00.000 --> 00:24.860',
    '00:24.860 --> 00:34.860',
    '00:34.860 --> 00:44.860',
    '00:44.860 --> 00:52.860',
    '00:52.860 --> 01:04.860'
  ];

  const translatedText = 'Good day. I\'m Mirela Vasin, and this is the News of the Day.\n' +
    'A Serb, a former member of the Kosovo Police, was arrested in spring. Serbs began to gather and set up barricades.\n' +
    'Prime Minister Anna Brnabić appealed to the International Community not to turn its head away from the human rights of Serbs in Kosmet.\n' +
    'Ukraine asks for additional weapons, Moscow warns of consequences.\n' +
    'Today, two quarter-final matches are being played at the world football championship - Morocco-Portugal and England-France.'

  const splitText = translatedText.split('\n')
  l(splitText)

  let formattedVtt = `WEBVTT\n`;

  for (const [index, value] of splitText.entries()) {
    formattedVtt = formattedVtt + `\n${timestampArray[index]}\n${value}\n`
    // console.log(`Index: ${index}, Value: ${value}`);
  }

  l(formattedVtt);
}

async function main(){
  reformatVtt()
}

main();
