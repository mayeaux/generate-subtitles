let fs = require('fs-extra')
let convert = require('cyrillic-to-latin')
// const srt2vtt = Promise.promisifyAll(require('srt2vtt'));
const srt2vtt = require('srt2vtt')

const path = './public/translated.srt'

const filename = 'serbian';

l = console.log;

l(srt2vtt)


// function createTicket(ticket) {
//   // 1 - Create a new Promise
//   return new Promise(function (resolve, reject) {
//     // 2 - Copy-paste your code inside this function
//     client.tickets.create(ticket, function (err, req, result) {
//       // 3 - in your async function's callback
//       // replace return by reject (for the errors) and resolve (for the results)
//       if (err) {
//         reject(err);
//       } else {
//         resolve(JSON.stringify(result));
//       }
//     });
//   });
// }

function converSrtToVtt () {

}

async function main () {
  let data = await fs.readFile(path, 'utf8');

  data = convert(data);

  // l(data);
  // data = await srt2vtt(data);

  srt2vtt(data, async function (err, vttData) {
    l('running here');

    l(vttData);

    // vttData = convert(vttData);

    // l(vttData);

    if (err) throw new Error(err);
    l(data);

    fs.writeFileSync('./public/redone.vtt', vttData);
  });

  // l(data);
  // data = await convert(data);
  // l(data);
  // await fs.writeFile(data, `${path}/${filename}.mp4.vtt`, 'utf8')
}

main();
//
// fs.createReadStream(`${path}/${filename}.mp4.srt`)
//   .pipe(srt2vtt())
//   .pipe(convert())
//   .pipe(fs.createWriteStream(`${path}/${filename}.mp4.vtt`))
