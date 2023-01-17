const { exec, spawn } = require('child_process');
const l = console.log;

async function getWhisperProcessInfo(numberToUse) {
  return new Promise((resolve, reject) => {
    exec(`ps aux | awk '!/grep/ && /whisper/ && /${numberToUse}/ {print $0}'`, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

async function deleteProcessByNumberToUse(numberToUse) {
    const { stdout, stderr } = await getWhisperProcessInfo(numberToUse);

    l('stdout');
    l(stdout);

    l('stderr');
    l(stderr);

    const pidRegex = /\b\d{1,6}\b/;
    const pid = stdout.toString().match(pidRegex) && stdout.toString().match(pidRegex)[0];

    l('found pid');
    l(pid);

    if (pid) {
      // send sigterm
      const processToKill = spawn('kill', ['-15', pid]);

      processToKill.on('exit', (code) => {
        if (code === 0) {
          console.log(`Process with PID ${pid} was killed successfully`);
          return true
        } else {
          console.log(`Failed to kill process with PID ${pid}. Exit code: ${code}`);
          return false;
        }
      });
    } else {
      return false
    }
}

// async function main(){
//   try {
//     const numberToUse = '66699903382';
//
//     await deleteProcessByNumberToUse(numberToUse);
//   } catch (err){
//     l(err);
//   }
// }

module.exports = deleteProcessByNumberToUse;

// main();





// runCommand('53752940123')
//   .then(({ stdout, stderr }) => {
//     console.log('stdout');
//     console.log(stdout);
//     console.log('stderr');
//     console.log(stderr);
//
//
//     const pidRegex = /\b\d{5}\b/;
//     const pid = stdout.toString().match(pidRegex)[0];
//
//
//     process.kill(Number(pid), 'SIGTERM')
//
//     console.log(`PID: ${pid}`)
//     return pid;
//   })
//   .catch((error) => {
//     console.log(`error: ${error.message}`);
//   });
