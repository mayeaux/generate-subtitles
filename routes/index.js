var express = require("express");
const _ = require("lodash");

const { global } = require("../lib/stats");
const fileRouter = require("./files");
const playerRouter = require("./player");
const transcribeRouter = require("./transcribe");
const statsRouter = require("./stats");

const { forHumans } = require("../helpers/helpers");
const {
  modelsArray,
  whisperLanguagesHumanReadableArray,
} = require("../constants/constants");

var router = express.Router();
const uploadPath = process.env.UPLOAD_PATH || "localhost:3000";
const nodeEnv = process.env.NODE_ENV || "development";

//file router
router.use(fileRouter);
//player router
router.use(playerRouter);
//transcribe router
router.use(transcribeRouter);
//stats router
router.use(statsRouter)

l("nodeEnv");
l(nodeEnv);

let uploadFileSizeLimitInMB = 3000;
if (nodeEnv === "production") {
  uploadFileSizeLimitInMB = process.env.UPLOAD_FILE_SIZE_LIMIT_IN_MB;
}
l("uploadFileSizeLimitInMB");
l(uploadFileSizeLimitInMB);

// home page
router.get("/", function (req, res, next) {
  const domainName = req.hostname;

  const isFreeSubtitles = domainName === "freesubtitles.ai";

  // transcribe frontend page
  res.render("index", {
    title: "Transcribe File",
    uploadPath,
    forHumans,
    nodeEnv,
    siteStats: global.siteStats,
    isFreeSubtitles,
    uploadFileSizeLimitInMB,
    modelsArray,
    languages: whisperLanguagesHumanReadableArray,
  });
});

global.queueData = [];

l(process.cwd());

module.exports = router;
