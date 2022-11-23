import path from "path";
import moment from "moment/moment";
import transcribeWrapped from "../transcribe-wrapped";

router.post('/file', upload.single('file'), function (req, res, next) {
  // l(global.ws);

  try {
    l(req.file);
    l(req.body);

    const language = req.body.language;
    let model = req.body.model;
    const websocketNumber = req.body.websocketNumber;
    const uploadedFilePath = req.file.path;
    const uploadGeneratedFilename = req.file.filename;
    const shouldTranslate = req.body.shouldTranslate === 'true';

    let logFileNames = true;
    // something.mp4
    let originalFileNameWithExtension = decode_utf8(req.file.originalname);

    // .mp4 (includes leading period)
    const originalFileExtension = path.parse(originalFileNameWithExtension).ext;

    const originalFileNameWithoutExtension = path.parse(originalFileNameWithExtension).name;
    l('originalFileNameWithoutExtension')
    l(originalFileNameWithoutExtension)

    // something
    const directorySafeFileNameWithoutExtension = makeFileNameSafe(originalFileNameWithoutExtension)

    l('directorySafeFileNameWithoutExtension')
    l(directorySafeFileNameWithoutExtension)


    // something.mp4
    const directorySafeFileNameWithExtension = `${directorySafeFileNameWithoutExtension}${originalFileExtension}`

    if(!uploadedFilePath){ res.status(500); res.send('no file')}

    // load websocket by passed number
    let websocketConnection;
    if(global.webSocketData){
      l(global.webSocketData);
      const websocket = global.webSocketData.find(function(websocket){
        return websocketNumber === websocket.websocketNumber;
      })
      if(websocket){
        websocketConnection = websocket.websocket;
      } else {
        throw new Error('no websocket!');
      }

    }

    // TODO: this is wrong, it's with adding the pending length to get amount in front
    const placeInQueue = queue.getQueueLength();

    l(queue);
    l('place in queue');
    l(placeInQueue);

    // general queue data
    global.queue = {}

    const amountOfCurrentPending = queue.getPendingLength()

    const amountinQueue = queue.getQueueLength()

    const totalOutstanding = amountOfCurrentPending + amountinQueue;

    l('totaloutstanding');
    l(totalOutstanding);

    // give frontend their queue position
    if(amountOfCurrentPending > 0){
      websocketConnection.send(JSON.stringify({
        message: 'queue',
        placeInQueue: totalOutstanding
      }), function () {});
    }

    global.queueData.push(websocketNumber)

    l('queue data');
    l(global.queueData);

    // make the model medium by default
    if(!model){
      model = 'medium';
    }

    const timestampString = moment(new Date()).format('DD-MMMM-YYYY_HH_mm_ss');

    const separator = '--'

    const fileSafeNameWithDateTimestamp = `${directorySafeFileNameWithoutExtension}${separator}${timestampString}`;

    const fileSafeNameWithDateTimestampAndExtension = `${directorySafeFileNameWithoutExtension}${separator}${timestampString}${originalFileExtension}`;

    queue.add(async function () {
      // TODO: catch the error here?
      await transcribeWrapped({
        uploadedFilePath,
        language,
        model,
        directorySafeFileNameWithoutExtension,
        directorySafeFileNameWithExtension,
        originalFileNameWithExtension,
        fileSafeNameWithDateTimestamp,
        fileSafeNameWithDateTimestampAndExtension,
        uploadGeneratedFilename,
        shouldTranslate,

        // websocket/queue
        websocketConnection,
        websocketNumber,
        queue,
        languagesToTranslateTo
      })
    })

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
    throw(err);
  }
});
