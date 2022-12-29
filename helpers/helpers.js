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



const decrementBySecond = timeRemainingValues => {
  let {secondsRemaining, minutesRemaining, hoursRemaining} = timeRemainingValues;

  if (secondsRemaining == 0) {
    if (minutesRemaining > 0) {
      secondsRemaining = 59;
      minutesRemaining--;
    }
  } else {
    secondsRemaining--;
  }

  if (minutesRemaining == 0) {
    if (hoursRemaining > 0) {
      minutesRemaining = 59;
      hoursRemaining--;
    }
  }

  minutesRemaining = `${minutesRemaining}`.padStart(2, '0');
  secondsRemaining = `${secondsRemaining}`.padStart(2, '0');

  const wholeTime = `${hoursRemaining ? hoursRemaining + ':' : ''}${minutesRemaining}:${secondsRemaining}`;

  return {
    secondsRemaining,
    minutesRemaining,
    hoursRemaining,
    string: wholeTime
  }
}

module.exports = {
  forHumans,
  forHumansNoSeconds,
  decrementBySecond,
  forHumansHoursAndMinutes
}
