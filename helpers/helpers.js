/**
 * Translates seconds into human readable format of seconds, minutes, hours, days, and years
 *
 * @param  {number} seconds The number of seconds to be processed
 * @return {string}         The phrase describing the amount of time
 */
// poor naming -osb910
function forHumans ( seconds ) {
  let levels = [
    [Math.floor(seconds / 31536000), 'years'],
    [Math.floor((seconds % 31536000) / 86400), 'days'],
    [Math.floor(((seconds % 31536000) % 86400) / 3600), 'hours'],
    [Math.floor((((seconds % 31536000) % 86400) % 3600) / 60), 'minutes'],
    [(((seconds % 31536000) % 86400) % 3600) % 60, 'seconds'],
  ];
  let returntext = '';

  for (let i = 0, max = levels.length; i < max; i++) {
    if ( levels[i][0] === 0 ) continue;
    returntext += ' ' + levels[i][0] + ' ' + (levels[i][0] === 1 ? levels[i][1].substr(0, levels[i][1].length-1): levels[i][1]);
  };
  return returntext.trim();
}

function forHumansNoSeconds ( seconds ) {
  let levels = [
    [Math.floor(seconds / 31536000), 'years'],
    [Math.floor((seconds % 31536000) / 86400), 'days'],
    [Math.floor(((seconds % 31536000) % 86400) / 3600), 'hours'],
    [Math.floor((((seconds % 31536000) % 86400) % 3600) / 60), 'minutes'],
  ];
  let returntext = '';

  for (let i = 0, max = levels.length; i < max; i++) {
    if ( levels[i][0] === 0 ) continue;
    returntext += ' ' + levels[i][0] + ' ' + (levels[i][0] === 1 ? levels[i][1].substr(0, levels[i][1].length-1): levels[i][1]);
  };
  return returntext.trim();
}

function forHumansHoursAndMinutes ( seconds ) {
  let levels = [
    [Math.floor(seconds / 3600), 'hours'],
    [Math.floor((seconds % 3600) / 60), 'minutes'],
  ];
  let returntext = '';

  for (let i = 0, max = levels.length; i < max; i++) {
    if ( levels[i][0] === 0 ) continue;
    returntext += ' ' + levels[i][0] + ' ' + (levels[i][0] === 1 ? levels[i][1].substr(0, levels[i][1].length-1): levels[i][1]);
  };
  return returntext.trim();
}



const decrementBySecond = timeValues => {
  let {secondsRemaining: seconds, minutesRemaining: minutes, hoursRemaining: hours} = timeValues;
  if (/[^\d:]/.test(timeValues.string)) return timeValues;

  if (seconds == 0) {
    if (minutes > 0) {
      seconds = 59;
      minutes--;
    }
  } else {
    seconds--;
  }

  if (minutes == 0) {
    if (hours > 0) {
      minutes = 59;
      hours--;
    }
  }

  minutes = `${minutes}`.padStart(2, '0');
  seconds = `${seconds}`.padStart(2, '0');

  const wholeTime = `${hours ? hours + ':' : ''}${minutes}:${seconds}`;

  return {
    secondsRemaining: seconds,
    minutesRemaining: minutes,
    hoursRemaining: hours,
    string: wholeTime
  }
}

const incrementBySecond = timeStr => {
  let [_, hours, minutes, seconds] = timeStr.match(/(?:(\d+):)?(\d+):(\d+)/);
  if (/[^\d:]/.test(timeStr)) return timeStr;
  hours = +hours || 0;
  minutes = +minutes || 0;
  seconds = +seconds || 0;
  
  seconds++;
  
  if (seconds == 60) {
    seconds = 0;
    minutes++;
  }
  
  if (minutes == 60) {
    minutes = 0;
    hours++;
  }
  
  minutes = `${minutes}`.padStart(2, '0');
  seconds = `${seconds}`.padStart(2, '0');
  
  const wholeTime = `${hours ? hours + ':' : ''}${minutes}:${seconds}`;
  
  return wholeTime;
}

const toTitleCase = str => !str || !str.trim() ? str
  : str.toLowerCase().replace(/\b[a-z]/g, ltr => ltr.toUpperCase());

module.exports = {
  forHumans,
  forHumansNoSeconds,
  decrementBySecond,
  incrementBySecond,
  forHumansHoursAndMinutes,
  toTitleCase
}
