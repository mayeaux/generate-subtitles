const express = require('express');
const router = express.Router();
const moment = require('moment');
const { forHumansHoursAndMinutes } = require('../helpers/helpers')

const { getAllDirectories } = require('../lib/files');

// see files
router.get('/stats', async function (req, res, next) {
  try {

    const stats = {
      lastHour: 0,
      last24h: 0,
      lastWeek: 0,
      lastMonth: 0,
      allTime: 0
    }

    const transcriptionTime = {
      lastHour: 0,
      last24h: 0,
      lastWeek: 0,
      lastMonth: 0,
      allTime: 0
    }

    //
    let files = await getAllDirectories('./transcriptions');

    const withinLastHour = moment().subtract(1, 'hours').valueOf();
    const within24h = moment().subtract(1, 'days').valueOf();
    const withinWeek = moment().subtract(1, 'weeks').valueOf();
    const withinMonth = moment().subtract(1, 'months').valueOf();

    let languages = {};

    for (const file of files) {
      if (file.timestamp > withinLastHour) {
        stats.lastHour++;
        transcriptionTime.lastHour += file.processingData.uploadDurationInSeconds;
      }
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

    transcriptionTime.lastHour = forHumansHoursAndMinutes(transcriptionTime.lastHour);
    transcriptionTime.last24h = forHumansHoursAndMinutes(transcriptionTime.last24h);
    transcriptionTime.lastWeek = forHumansHoursAndMinutes(transcriptionTime.lastWeek);
    transcriptionTime.lastMonth = forHumansHoursAndMinutes(transcriptionTime.lastMonth);
    transcriptionTime.allTime = forHumansHoursAndMinutes(transcriptionTime.allTime);

    // l('languages');
    // l(languages);

    // sort languages by count
    const entries = Object.entries(languages);

    // Sort the array using the value
    entries.sort((a, b) => b[1] - a[1]);

    // Reconstruct the object
    const sortedObj = Object.fromEntries(entries);

    // l('sortedObj');
    // l(sortedObj);

    // l('languages');
    // l(languages);

    return res.render('stats/stats', {
      // list of file names
      title: 'Stats',
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
