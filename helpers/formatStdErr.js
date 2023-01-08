// example of stdErrData: ' 10%|█         | 5332/52135 [00:10<01:25, 545.77frames/s]'

const formatStdErr = stdErrData => {
  // a cleaner and more concise approach
  const dataRegex = /^\D*((\d+)%)\|([\u2580-\u2590\s]+)\|\s*\d+\/\d+\s\[(\d\d:\d\d)<((?:(\d\d):)?(\d\d):(\d\d)|\?),\s*(\d+\.\d\d|\?)frames\/s\]/;

  // if not a progress output
  if (!dataRegex.test(stdErrData)) return false;

  const [
    wholeMatch,
    percentDone, // looks like: '10%'
    percentDoneAsNumber, // looks like: '10'
    progressBar, // looks like: '█         '
    timeElapsed, // looks like: '00:10'
    timeRemaining, // looks like: '01:25'
    hoursRemaining, // looks like: 'undefined'
    minutesRemaining, // looks like: '25'
    secondsRemaining, // looks like: '01'
    speed // looks like: '545.77'
  ] = stdErrData.match(dataRegex);
  
  // format for lib
  return {
    progressBar,
    percentDone,
    timeElapsed,
    speed,
    percentDoneAsNumber: +percentDoneAsNumber,
    timeRemaining: {
      string: timeRemaining,
      hoursRemaining: +hoursRemaining,
      minutesRemaining: +minutesRemaining,
      secondsRemaining: +secondsRemaining
    },
  }
}

module.exports = {
  formatStdErr
}