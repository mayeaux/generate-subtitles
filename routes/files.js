const express = require("express");
const moment = require('moment');
const _ = require("lodash");

const router = express.Router();
const { getAllDirectories, getMatchingFiles } = require("../lib/files");


// see files
router.get("/files", async function (req, res, next) {
  try {
    const { password, language } = req.query;

    const keepMedia = req.query.keepMedia === "true";

    if (password !== process.env.FILES_PASSWORD) {
      res.redirect("/404");
    } else {
      const dir = "./transcriptions";

      //
      let files = await getAllDirectories("./transcriptions");

      // log files length
      l("files length");
      l(files.length);
      // l(files);

      // TODO: what other things to match against?
      files = await getMatchingFiles({ dir, files, language, keepMedia });

      console.log(`Files: ${JSON.stringify(files)}`);
      files = _.orderBy(
        files,
        (file) => new Date(file.processingData.finishedAT),
        "desc"
      );

      return res.render("files", {
        // list of file names
        files,
        title: "Files",
      });
    }
  } catch (err) {
    l("err");
    l(err);
  }
});

// see files
router.get("/learnserbian", async function (req, res, next) {
  try {
    const dir = "./transcriptions";
    //
    let files = await getAllDirectories("./transcriptions");

    const language = "Serbian";
    const keepMedia = true;

    // TODO: what other things to match against?
    files = await getMatchingFiles({ dir, files, language, keepMedia });

    l("files length");
    l(files.length);
    l(files);

    files = files.filter(function (file) {
      return file.processingData.translatedLanguages.length;
    });

    // TODO: finishedAT is misspelled
    files = _.orderBy(
      files,
      (file) => new Date(file.processingData.finishedAT),
      "desc"
    );

    return res.render("files", {
      // list of file names
      files,
      title: "Files",
    });
  } catch (err) {
    l("err");
    l(err);
  }
});

module.exports = router;
