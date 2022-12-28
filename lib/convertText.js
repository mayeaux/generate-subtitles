const fs = require('fs-extra');
const convert = require('cyrillic-to-latin');
const { simplified } = require('zh-convert');

async function convertSerbianCyrillicToLatin ({
  transcribedSrtFilePath,
  transcribedVttFilePath,
  transcribedTxtFilePath,
}) {
  let data = await fs.readFile(transcribedSrtFilePath, 'utf-8');
  let latinCharactersText = convert(data);
  await fs.writeFile(transcribedSrtFilePath, latinCharactersText, 'utf-8');

  data = await fs.readFile(transcribedVttFilePath, 'utf-8');
  latinCharactersText = convert(data);
  await fs.writeFile(transcribedVttFilePath, latinCharactersText, 'utf-8');

  data = await fs.readFile(transcribedTxtFilePath, 'utf-8');
  latinCharactersText = convert(data);
  await fs.writeFile(transcribedTxtFilePath, latinCharactersText, 'utf-8');
}

async function convertChineseTraditionalToSimplified ({
  transcribedSrtFilePath,
  transcribedVttFilePath,
  transcribedTxtFilePath,
}) {
  let data = await fs.readFile(transcribedSrtFilePath, 'utf-8');
  let simplifiedText = simplified(data);
  await fs.writeFile(transcribedSrtFilePath, simplifiedText, 'utf-8');

  data = await fs.readFile(transcribedVttFilePath, 'utf-8');
  simplifiedText = simplified(data);
  await fs.writeFile(transcribedVttFilePath, simplifiedText, 'utf-8');

  data = await fs.readFile(transcribedTxtFilePath, 'utf-8');
  simplifiedText = simplified(data);
  await fs.writeFile(transcribedTxtFilePath, simplifiedText, 'utf-8');
}

module.exports = {
  convertSerbianCyrillicToLatin,
  convertChineseTraditionalToSimplified,
}
