const { createFile, createOrUpdateProcessingData, capitalizeFirstLetter  } = require('../helpers/utils');
const fs = require('fs-extra');
const { forHumans } = require('../helpers/helpers');

async function createTranslatedVtts ({
 prependPath,
 translatedFiles
}) {
  for (const translatedFile of translatedFiles) {
    const { language, translatedText } = translatedFile;
    const translatedPath = `${prependPath}_${language}.vtt`;

    await createFile(translatedPath, translatedText);
  }
}

async function saveOriginalProcessingDataJson (jobObject) {
  const { numberToUse } = jobObject;

  // processing_data.json path
  const holdingFolder = `${process.cwd()}/transcriptions/${numberToUse}`;

  await fs.mkdirp(holdingFolder);

  const processingPath = `${holdingFolder}/processing_data.json`;

  await createOrUpdateProcessingData(processingPath, jobObject)
}

function generateProcessingDataString ({
  timeRemaining,
  timeElapsed,
  totalTimeEstimated,
  speed,
  title,
  duration,
  fileType,
  language,
  model
}) {
  let processingData = [
    'Time Remaining: ' + timeRemaining || '?',
    'Time Elapsed: ' + timeElapsed || '?',
    // "Total Time Estimated: " + totalTimeEstimated,
    'Speed: ' + (speed || '?') + ' (f/s)',
    '',
    title,
    'Duration: ' + forHumans(duration),
    // 'File Type: ' + fileType,
    'Language: ' + language,
    'Model: ' + capitalizeFirstLetter(model)
  ];
  return processingData.join(' \n\n ');
}

module.exports = {
  createTranslatedVtts,
  saveOriginalProcessingDataJson,
  generateProcessingDataString,
}