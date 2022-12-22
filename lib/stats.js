const fs = require('fs-extra');
const { forHumansNoSeconds } = require('../helpers/helpers');

global.siteStats = {};
const oneMinute = 1000 * 60;

const interval = oneMinute;

async function getTranscriptionData () {
  let totalSeconds = 0;

  const processDirectory = process.cwd();
  const transcriptionsDirectory = `${processDirectory}/transcriptions`;
  await fs.mkdirp(transcriptionsDirectory);

  const transcriptionsDirectoryContents = await fs.readdir(
    transcriptionsDirectory
  );

  // loop through all transcription directories
  for (const transcriptionDirectory of transcriptionsDirectoryContents) {
    // check if directory is directory
    const directoryPath = `${transcriptionsDirectory}/${transcriptionDirectory}`;

    // this is guaranteed to exist
    const directoryStats = await fs.stat(directoryPath);

    const isDirectory = directoryStats.isDirectory();

    // only loop through if it's a directory
    if (isDirectory) {
      // check if directory has a processing_data.json file
      const processingDataPath = `${directoryPath}/processing_data.json`;

      // read processing_data.json file
      // dont error if processingData doesn't exist
      const processingDataExists = await fs.pathExists(processingDataPath);

      if (!processingDataExists) {
        continue;
      }

      let processingData, fileExistsButJsonError;
      try {
        processingData = JSON.parse(
          await fs.readFile(processingDataPath, 'utf8')
        );
      } catch (err) {
        // syntax error
        fileExistsButJsonError = err.toString().includes('SyntaxError');

        // delete the media if json error
        if (fileExistsButJsonError) {
          continue;
        }
      }

      if (!processingData) {
        continue;
      }

      const uploadDurationInSeconds = processingData.uploadDurationInSeconds;

      if (uploadDurationInSeconds) {
        totalSeconds += uploadDurationInSeconds;
      }
    }
  }

  global.siteStats = {
    totalSeconds,
    amountOfTranscriptions: transcriptionsDirectoryContents.length,
    humanReadableTime: forHumansNoSeconds(totalSeconds),
  };

  l('siteStats');
  l(global.siteStats);
}

getTranscriptionData();

// Schedule the directory reading operation at regular intervals
setInterval(async () => {
  getTranscriptionData();
}, interval);

module.exports = {
  global,
};
