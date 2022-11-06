var express = require('express');
const axios = require("axios");
const multer = require("multer");
var router = express.Router();
var upload = multer();
const FormData = require('form-data');
const fs = require('fs/promises');
const downloadAndTranscribe = require('../download.js')

l = console.log;

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.post('/your_path', upload.single('subtitles'), function (req, res, next) {
  try {
    l(req.file);
    // l(req.body);

    const obj = JSON.parse(JSON.stringify(req.body));
    l(obj);

    // l(req.files);
    // l(req.body);
    res.send('ok');
    // req.files is array of uploaded files
    // req.body will contain the text fields, if there were any
  } catch (err){
    l('err')
    l(err);
  }
});

const url = 'http://127.0.0.1:3000/your_path';

router.post('/post', async function(req, res, next){
  try {
    l(req.body);
    l(req.params);

    const videoUrl = req.body.video_url;

    res.send('Starting to download ' + videoUrl);

    await downloadAndTranscribe(videoUrl);

    // Create a new form instance
    const form = new FormData();

    const file = await fs.readFile('./ljubav.srt');
    l('file');
    l(file);

    form.append('subtitles', file, 'subtitles');

    form.append('filename', 'ljubav.srt');


    l('form headers');
    l(form.getHeaders())

    const response = await axios.post(url, form, {
      headers: {
        ...form.getHeaders(),
      },
      data: {
        foo: 'bar', // This is the body part
      }
    });

    // l('response');
    // l(response);

    // res.send('ok');
  } catch (err){
    l('err');
    l(err);
  }

  // axios.post('http://127.0.0.1:3000/your_path', {
  //   firstName: 'Fred',
  //   lastName: 'Flintstone'
  // })
  //   .then(function (response) {
  //     console.log(response);
  //   })
  //   .catch(function (error) {
  //     console.log(error);
  //   });
})

module.exports = router;
