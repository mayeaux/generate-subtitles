const express = require('express');
const router = express.Router();
const moment = require('moment');
const { forHumans } = require('../helpers/helpers')

const { getAllDirectories } = require('../lib/files');

// see files
router.get('/stats', async function (req, res, next) {
  try {

    const stats = {
      last24h: 0,
      lastWeek: 0,
      lastMonth: 0,
      allTime: 0
    }

    const transcriptionTime = {
      last24h: 0,
      lastWeek: 0,
      lastMonth: 0,
      allTime: 0
    }

    //
    let files = await getAllDirectories('./transcriptions');

    const within24h = moment().subtract(1, 'days').valueOf();
    const withinWeek = moment().subtract(1, 'weeks').valueOf();
    const withinMonth = moment().subtract(1, 'months').valueOf();

    let languages = {};

    for (const file of files) {
      if (file.timestamp > within24h) {
        stats.last24h++;
        transcriptionTime.last24h += file.processingData.uploadDurationInSeconds;
      }
      if (file.timestamp > withinWeek) {
        stats.lastWeek++;
        transcriptionTime.lastWeek += file.processingData.uploadDurationInSeconds;
      }
      if (file.timestamp > withinMonth) {
        stats.lastMonth++;
        transcriptionTime.lastMonth += file.processingData.uploadDurationInSeconds;
      }
      stats.allTime++;
      transcriptionTime.allTime += file.processingData.uploadDurationInSeconds;

      if (file.processingData.language) {
        if (!languages[file.processingData.language]) {
          languages[file.processingData.language] = 1;
        } else {
          languages[file.processingData.language]++;
        }
      }
    }

    // l('files');
    // l(files);

    transcriptionTime.last24h = forHumans(transcriptionTime.last24h);
    transcriptionTime.lastWeek = forHumans(transcriptionTime.lastWeek);
    transcriptionTime.lastMonth = forHumans(transcriptionTime.lastMonth);
    transcriptionTime.allTime = forHumans(transcriptionTime.allTime);

    // l('languages');
    // l(languages);

    const entries = Object.entries(languages);

    // Sort the array using the value
    entries.sort((a, b) => b[1] - a[1]);

    // Reconstruct the object
    const sortedObj = Object.fromEntries(entries);

    l('sortedObj');
    console.log(sortedObj);

    // l('languages');
    // l(languages);

    return res.render('stats/stats', {
      // list of file names
      stats,
      transcriptionTime,
      languages: sortedObj
    });
  } catch (err) {
    l('err');
    l(err);
  }
});

module.exports = router;
