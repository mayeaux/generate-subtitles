const fs = require('fs-extra');
const convert = require('cyrillic-to-latin');
const {simplified} = require('zh-convert');

const fileTypes = ['srt', 'vtt', 'txt'];

const convertSerbianCyrillicToLatin = async path => {
  fileTypes.forEach(async fileType => {
    const data = await fs.readFile(`${path}.${fileType}`, 'utf-8');
    const latinCharactersText = convert(data);
    await fs.writeFile(`${path}.${fileType}`, latinCharactersText, 'utf-8');
  });
}

const convertChineseTraditionalToSimplified = async path => {
  fileTypes.forEach(async fileType => {
    const data = await fs.readFile(`${path}.${fileType}`, 'utf-8');
    const simplifiedText = simplified(data);
    await fs.writeFile(`${path}.${fileType}`, simplifiedText, 'utf-8');
  });
}

module.exports = {
  convertSerbianCyrillicToLatin,
  convertChineseTraditionalToSimplified,
}
