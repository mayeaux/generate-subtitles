const filenamify = require("filenamify");
const fs = require("fs-extra");
const multer = require("multer");

const makeFileNameSafe = function (string) {
  return filenamify(string, { replacement: "_" })
    .replace(/[&\/\\#,+()$~%.'":*?<>{}!]/g, "")
    .replace(/\s+/g, "_")
    .split("：")
    .join(":");
};

async function getMatchingFiles({ files, language, keepMedia }) {
  // TODO: ugly design but can't think of a better approach atm
  let keepMediaMatch;
  if (keepMedia === false) {
    keepMediaMatch = undefined;
  } else {
    keepMediaMatch = keepMedia;
  }

  files = files.filter((file) => {
    return (
      language === file.processingData.language &&
      keepMediaMatch === file.processingData.keepMedia
    );
  });

  return files;
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
      processingData = JSON.parse(
        await fs.readFile(`${dir}/${file.name}/processing_data.json`, "utf8")
      );
    } catch (err) {
      // l('err');
      // l(err);
      processingData = null;
    }
    //
    // l('processing data');
    // l(processingData);

    if (
      processingData &&
      processingData.startedAt &&
      processingData.uploadDurationInSeconds
    ) {
      newFiles.push({
        name: file.name,
        processingData,
        formattedDate: moment(processingData.startedAt).format("D MMM YYYY"),
        timestamp:
          processingData.startedAt &&
          new Date(processingData.startedAt).getTime(),
      });
    }
  }

  return newFiles;
};

function decode_utf8(s) {
  return decodeURIComponent(escape(s));
}

const storage = multer.diskStorage({
  // notice you are calling the multer.diskStorage() method here, not multer()
  destination: function (req, file, cb) {
    cb(null, "./uploads/");
  },
});

l = console.log;

var upload = multer({ storage });

module.exports = {
  makeFileNameSafe,
  getMatchingFiles,
  getAllDirectories,
  decode_utf8,
  upload,
};
