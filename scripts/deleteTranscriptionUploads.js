const {tr} = require('language-name-map/map');
let l = console.log;
const fs = require('fs-extra');
const path = require('path');

const mediaFileExtensions = [
  // Audio file extensions
  '.aac',
  '.ac3',
  '.adts',
  '.aif',
  '.aiff',
  '.aifc',
  '.amr',
  '.au',
  '.awb',
  '.dct',
  '.dss',
  '.dvf',
  '.flac',
  '.gsm',
  '.m4a',
  '.m4p',
  '.mmf',
  '.mp3',
  '.mpc',
  '.msv',
  '.oga',
  '.ogg',
  '.opus',
  '.ra',
  '.ram',
  '.raw',
  '.sln',
  '.tta',
  '.vox',
  '.wav',
  '.wma',

  // Video file extensions
  '.3g2',
  '.3gp',
  '.3gpp',
  '.asf',
  '.avi',
  '.dat',
  '.flv',
  '.m2ts',
  '.m4v',
  '.mkv',
  '.mod',
  '.mov',
  '.mp4',
  '.mpe',
  '.mpeg',
  '.mpg',
  '.mts',
  '.ogv',
  '.qt',
  '.rm',
  '.rmvb',
  '.swf',
  '.ts',
  '.vob',
  '.webm',
  '.wmv'
];


// get argument from command line
const shouldDeleteFiles = process.argv[2] === 'delete';
const logDeleteOnly = process.argv[2] === 'toDelete';
const logKeepOnly = process.argv[2] === 'toKeep';

function logInBlueColor (message) {
  console.log(`\x1b[34m${message}\x1b[0m`);
}

function logInRedColor (message) {
  console.log(`\x1b[31m${message}\x1b[0m`);
}

if (logDeleteOnly) {
  logInRedColor = function () {}; // disable logging
}
if (logKeepOnly) {
  logInBlueColor = function () {}; // disable logging
}

async function deleteAllMediaFiles ({ dirPath }) {
  // Get an array of all the files in the directory
  const files = await fs.promises.readdir(dirPath);

  // Loop through all the files in the directory
  for (const file of files) {
    // get file extension using path module
    const fileExtension = path.extname(file);

    if (mediaFileExtensions.includes(fileExtension)) {
      try {
        await fs.promises.unlink(`${dirPath}/${file}`);
      } catch (error) {
        l('error');
        l(error);
        console.error(`Error deleting file: ${dirPath}/${file}`);
      }

    }
  }
}

async function findMediaFileInDirectory (directory) {
  const files = await fs.promises.readdir(directory);
  for (const file of files) {
    // get file extension using path module
    const fileExtension = path.extname(file);
    if (mediaFileExtensions.includes(fileExtension)) {
      return file;
    }
  }
  return false
}


// delete files that are over 24h old script
const deleteOldFiles = async function (shouldDelete = false) {
  try {

    let deletingFiles = shouldDelete || shouldDeleteFiles;

    const processDirectory = process.cwd();
    const transcriptionsDirectory = `${processDirectory}/transcriptions`;
    const transcriptionsDirectoryContents = await fs.readdir(transcriptionsDirectory);

    let totalFileSizeToDelete = 0;

    // loop through all transcription directories
    for (const transcriptionDirectory of transcriptionsDirectoryContents) {
      // check if directory is directory
      const directoryPath = `${transcriptionsDirectory}/${transcriptionDirectory}`;

      // this is guaranteed to exist
      const directoryStats = await fs.stat(directoryPath);

      const isDirectory = directoryStats.isDirectory();

      // only loop through if it's a directory
      if (isDirectory) {
        // check if directory is empty
        const directoryContents = await fs.readdir(directoryPath);

        // get the name of the media file if it exists
        const mediaFile = await findMediaFileInDirectory(directoryPath);

        // get the path to the media
        const mediaFilePath = `${directoryPath}/${mediaFile}`;

        // no media to delete, keep going
        if (!mediaFile) {
          continue;
        }

        // check if directory has a processing_data.json file
        const processingDataPath = `${directoryPath}/processing_data.json`;

        // read processing_data.json file
        // dont error if processingData doesn't exist
        const processingDataExists = await fs.pathExists(processingDataPath);

        // TODO: only implement when it's ready
        if (!processingDataExists) {
          l('deleting media files')
          // await fs.unlink(mediaFilePath);
          continue
        }

        let processingData, fileExistsButJsonError;
        try {
          processingData = JSON.parse(await fs.readFile(processingDataPath, 'utf8'));
        } catch (err) {

          // syntax error
          fileExistsButJsonError = err.toString().includes('SyntaxError');

          // delete the media if json error
          if (fileExistsButJsonError) {
            l('deleting media files')
            // delete the media files
            if (deletingFiles) {
              await deleteAllMediaFiles({ dirPath: directoryPath });
            }
            continue
          }
        }

        // TODO: could have side effects until data saving lands
        if (!processingData) {
          l('no processing data');
          l('deleting media files')
          // await deleteAllMediaFiles({ dirPath: directoryPath });
          continue
        }

        // check if processing data keep media property is true
        const shouldKeepMedia = processingData.keepMedia;

        // if keep media is true, keep going
        if (shouldKeepMedia) {
          l('should keep');
          continue;
        }

        // check if processing_data.json file has a completedAt property
        if (processingData.startedAt) {
          // check if completedAt is over 24h old
          const startedAt = new Date(processingData.startedAt);
          const now = new Date();
          const difference = now - startedAt;
          const hoursDifference = difference / 1000 / 60 / 60;

          const over24Hours = hoursDifference > 24;

          if (over24Hours) {
            l('deleting media files')
            if (deletingFiles && !shouldKeepMedia) {
              // delete mediaFilePath
              await fs.unlink(mediaFilePath);
            }
          } else {
            l('not over 24 hours');
          }

        // there is an issue because the current processing_data.json file doesn't have a startedAt property
        } else {
          l('deleting media files')
          if (deletingFiles) await deleteAllMediaFiles({ dirPath: directoryPath });
        }
      }

      // l('transcriptionsDirectoryContents');
      // l(transcriptionsDirectoryContents);
    }

    logInBlueColor('totalFileSizeToDelete');
    logInBlueColor(totalFileSizeToDelete);
  } catch (err) {
    l('err');
    l(err);
    l(err.stack);
  }
}

// deleteOldFiles();

module.exports = {
  deleteOldFiles
}
