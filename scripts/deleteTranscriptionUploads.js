const l = console.log;
const fs = require('fs').promises;

function logInBlueColor(message) {
  console.log(`\x1b[34m${message}\x1b[0m`);
}

// deleteOldFiles();

// const processDirectory = process

// delete files that are over 24h old script
const deleteOldFiles = async function () {
  try {
    const processDirectory = process.cwd();
    const transcriptionsDirectory = `${processDirectory}/transcriptions`;
    const transcriptionsDirectoryContents = await fs.readdir(transcriptionsDirectory);

    let totalFileSizeToDelete = 0;

    // loop through all transcription directories
    for (const transcriptionDirectory of transcriptionsDirectoryContents) {
      // check if directory is directory
      const directoryPath = `${transcriptionsDirectory}/${transcriptionDirectory}`;
      // log directory path
      l('directoryPath');
      l(directoryPath);

      const directoryStats = await fs.stat(directoryPath);

      // only loop through if it's a directory
      if (directoryStats.isDirectory()) {
        // check if directory has a processing_data.json file
        const processingDataPath = `${directoryPath}/processing_data.json`;
        // read processing_data.json file
        // dont error if processingData doesn't exist
        let processingData;
        try {
          processingData = JSON.parse(await fs.readFile(processingDataPath, 'utf8'));
        } catch (err) {
          l('err reading processing data');
          l(err);
        }

        // log processing data
        l('processingData');
        l(processingData);

        if(!processingData){
          // move to next loop
          continue;
        }

        // check if processing_data.json file has a completedAt property
        if (processingData.startedAt) {
          // check if completedAt is over 24h old
          const startedAt = new Date(processingData.startedAt);
          const now = new Date();
          const difference = now - startedAt;
          const hoursDifference = difference / 1000 / 60 / 60;

          // check if processing data keep media property is true
          const shouldKeepMedia = processingData.keepMedia;

          // log hours difference
          l('hoursDifference');
          l(hoursDifference);

          const over24Hours = hoursDifference > 24;

          // delete mp4
          if (over24Hours && !shouldKeepMedia) {
            // log directory name
            l('deleting media file');
            l(transcriptionDirectory);
            // delete mp4 file
            const mp4Path = `${directoryPath}/${transcriptionDirectory}.mp4`;
            // get size of mp4 file
            let mp4FileStats;
            try {
              mp4FileStats = await fs.stat(mp4Path);
            } catch (err) {
              l('err getting mp4 stats');
              l(err);
            }

            if(!mp4FileStats){
              // move to next loop
              continue;
            }

            const mp4Size = mp4FileStats.size;
            // log mp4 size in mb
            l('mp4SizeInMB');
            const mp4SizeInMB = Math.round(mp4Size / 1000000);
            totalFileSizeToDelete = totalFileSizeToDelete + mp4SizeInMB;
            l(mp4SizeInMB);

            logInBlueColor('mp4SizeInMB')
            logInBlueColor(mp4SizeInMB);


            // log mp4 size
            l('mp4 size');
            l(mp4Size);
            // await fs.unlink(mp4Path);

          }
        }
      }

      l('totalFileSizeToDelete');
      l(totalFileSizeToDelete);

      // l('transcriptionsDirectoryContents');
      // l(transcriptionsDirectoryContents);
    }
  } catch (err) {
    l('err');
    l(err);
    l(err.stack);
  }
}

deleteOldFiles();
