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

const getamountOfRunningJobs = () => 
  Object.values(global.jobProcesses)
  .filter(propValue => propValue !== undefined)
  .length;

const sendToWebsocket = (websocketConnection, data) => {
  websocketConnection.send(JSON.stringify(data), function () {});
}

// TODO: not the world's greatest implemention
const generateRandomNumber = () => Math.floor(Math.random() * 10_000_000_000).toString();

const toTitleCase = str => !str || !str.trim() ? str
  : str.toLowerCase().replace(/\b[a-z]/g, ltr => ltr.toUpperCase());

module.exports = {
  forHumans,
  forHumansNoSeconds,
  decrementBySecond,
  forHumansHoursAndMinutes,
  getamountOfRunningJobs,
  sendToWebsocket,
  generateRandomNumber,
  toTitleCase,
}
