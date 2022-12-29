const filenamify = require('filenamify');
const fs = require('fs-extra');
const moment = require('moment/moment');

const makeFileNameSafe = function (string) {
  return filenamify(string, {replacement: '_' })
    .replace(/[&\/\\#,+()$~%.'":*?<>{}!]/g, '')
    .replace(/\s+/g,'_')
    .split('：').join(':');
}

function decode_utf8 (s) {
  return decodeURIComponent(escape(s));
}

// it's an array of file names
const getAllDirectories = async (dir) => {
  let files = await fs.promises.readdir(dir, { withFileTypes: true });

  let newFiles = [];

  for (let file of files) {
    // l('file');
    // l(file);
    // l(file.name);
    // l(file.isDirectory());
    if (!file.isDirectory()) continue;

    let processingData;
    try {
      processingData = JSON.parse(await fs.readFile(`${dir}/${file.name}/processing_data.json`, 'utf8'));
    } catch (err) {
      // l('err');
      // l(err);
      processingData = null;
    }
    //
    // l('processing data');
    // l(processingData);

    if (processingData && processingData.startedAt && processingData.uploadDurationInSeconds) {
      newFiles.push({
        name: file.name,
        processingData,
        formattedDate: moment(processingData.startedAt).format('D MMM YYYY'),
        timestamp: processingData.startedAt && new Date(processingData.startedAt).getTime()
      });
    }
  }

  return newFiles
}

async function sortByModifiedAtTime (dir) {
  // sort by modified date
  return files
    .map(async fileName => ({
      name: fileName,
      time: await fs.stat(`${dir}/${fileName}`).mtime.getTime(),
    }))
    .sort((a, b) => a.time - b.time)
    .map(file => file.name);
}

async function getMatchingFiles ({ files, language, keepMedia }) {
  // TODO: ugly design but can't think of a better approach atm
  let keepMediaMatch;
  if (keepMedia === false) {
    keepMediaMatch = undefined;
  } else {
    keepMediaMatch = keepMedia;
  }

  if (language) {
    files = files.filter((file) => {
      return file.processingData.language === language;
    });
  }

  if (keepMediaMatch !== undefined) {
    files = files.filter((file) => {
      return file.processingData.keepMedia === keepMediaMatch;
    });
  }

  return files;
}

module.exports = {
  makeFileNameSafe,
  decode_utf8,
  getAllDirectories,
  sortByModifiedAtTime,
  getMatchingFiles
}
