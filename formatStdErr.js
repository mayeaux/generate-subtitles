l = console.log;

// const string = '0%|          | 0/11531 [00:00]'

const ten = ' 10%|█         | 5332/52135 [00:10<01:25, 545.77frames/s]';

// const trimmed = ten.trim();
//
// // 10%
// let percent = ten.split('|')[0].trim();
//
// // 00:10<01:25, 545.77frames/s]
// let timeLeftPortion = ten.split('[')[1].split('[')[0]
//
// const firstPortion = timeLeftPortion.split(',')[0]
//
// const timeElapsed = firstPortion.split('<')[0]
//
// const timeRemaining = timeLeftPortion.split('<')[1].split(',')[0]
//
// const speed = timeLeftPortion.split('<')[1].split(',')[1].split('frames')[0].trim()
//
// const progressBar = ten.split('|')[1].split('|')[0]

function formatStdErr(stdErrData){
  if(stdErrData.includes('frames')){
    const progressBar = stdErrData.split('|')[1].split('|')[0]

    let percentDone = stdErrData.split('|')[0].trim();

    let percentDoneAsNumber = Number(stdErrData.split('%')[0].trim());

    let timeLeftPortion = stdErrData.split('[')[1].split('[')[0]

    const firstPortion = timeLeftPortion.split(',')[0]

    const timeElapsed = firstPortion.split('<')[0]

    const timeRemaining = timeLeftPortion.split('<')[1].split(',')[0]

    const speed = timeLeftPortion.split('<')[1].split(',')[1].split('frames')[0].trim()

    return {
      progressBar,
      percentDone,
      timeElapsed,
      timeRemaining,
      speed,
      percentDoneAsNumber
    }
  } else {
    return false
  }
}

// const thing = formatStdErr(ten)
//
// l(thing);

module.exports = {
  formatStdErr
}

// l(progressBar);
// l('progressBar');
//
// l('speed');
// l(speed)
//
// l('timeRemaining');
// l(timeRemaining);
//
// l('timeElapsed');
// l(timeElapsed);
//
// l('percent');
// l(percent);
