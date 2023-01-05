// see files
const _ = require('lodash');
const express = require('express');
const router = express.Router();
const { getAllDirectories, getMatchingFiles } = require('../lib/files');

router.get('/files', async function (req, res, next) {
  try {
    const { password, language } = req.query;

    const keepMedia = req.query.keepMedia === 'true';

    if (password !== process.env.FILES_PASSWORD) {
      res.redirect('/404')
    } else {
      const dir = './transcriptions';

      //
      let files = await getAllDirectories('./transcriptions');

      // log files length
      l('files length');
      l(files.length);
      // l(files);

      // TODO: what other things to match against?
      files = await getMatchingFiles({ dir, files, language, keepMedia });

      files = _.orderBy(files, (file) => new Date(file.processingData.finishedAT), 'desc');

      // // log files length
      // l('files length');
      // l(files.length);
      //
      // files = await sortByModifiedAtTime('./transcriptions');


      // most recently effected files first (non-destructive, functional)
      // files = [].concat(files).reverse();

      // log files length
      // l('files length');
      // l(files.length);
      //
      // l('returning');
      // l(files);

      return res.render('files', {
        // list of file names
        files,
        title: 'Files',
      })
    }

  } catch (err) {
    l('err');
    l(err);
  }
});

// see files
router.get('/learnserbian', async function (req, res, next) {
  try {

    const dir = './transcriptions';
    //
    let files = await getAllDirectories('./transcriptions');

    const language = 'Serbian';
    const keepMedia = true;

    // TODO: what other things to match against?
    files = await getMatchingFiles({ dir, files, language, keepMedia });

    l('files length');
    l(files.length);
    l(files);

    files = files.filter(function (file) {
      return file.processingData.translatedLanguages.length;
    });

    // TODO: finishedAT is misspelled
    files = _.orderBy(files, (file) => new Date(file.processingData.finishedAT), 'desc');

    return res.render('files', {
      // list of file names
      files,
      title: 'Files',
    })

  } catch (err) {
    l('err');
    l(err);
  }
});

router.get('/admin', async function (req, res, next) {
  try {
    const { password } = req.query;

    if (process.env.NODE_ENV !== 'development' && password !== process.env.FILES_PASSWORD) {
      res.redirect('/404')
    } else {

      l('jobProcesses')
      l(jobProcesses)

      const cleanedUpJobProcessObject = {};

      for(const jobProcessNumber in jobProcesses){
        let value = jobProcesses[jobProcessNumber];
        if(!value){
          cleanedUpJobProcessObject[jobProcessNumber] = {};
          continue
        };
        delete value.directorySafeFileNameWithoutExtension;
        delete value.directorySafeFileNameWithExtension;
        delete value.fileSafeNameWithDateTimestamp
        delete value.fileSafeNameWithDateTimestampAndExtension
        cleanedUpJobProcessObject[jobProcessNumber] = value;
      }

      l('cleanedUpJobProcessObject')
      l(cleanedUpJobProcessObject)


      return res.render('admin', {
        title: 'Admin',
        processes: cleanedUpJobProcessObject || [],
        newQueue: global.newQueue,
        transcriptions: global.transcriptions,
        websocketItems: global.webSocketData,
      })
    }

  } catch (err) {
    l('err');
    l(err);
  }
});

module.exports = router;
