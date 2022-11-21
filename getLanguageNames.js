const languageNameMap = require('language-name-map/map')
const _ = require('lodash');

l = console.log;

l(languageNameMap);


for(const language of languagesToTranscribe){
  l('language');
  const foundLanguage = languages.filter(function(filteredLanguage){
    return language === filteredLanguage.name;
  })
  l('found language');
  l(foundLanguage);
}

function shouldTranslateTo(languageName){
  return languages.filter(function(filteredLanguage){
    return languageName === filteredLanguage.name;
  })
}

function shouldTranslateFrom(languageName){
  return languages.filter(function(filteredLanguage){
    return languageName === filteredLanguage.name;
  })
}

// top languages
// {"code":"en","name":"English"},
// {"code":"ar","name":"Arabic"},
// {"code":"zh","name":"Chinese"},
// {"code":"fr","name":"French"},
// {"code":"de","name":"German"},
// {"code":"es","name":"Spanish"},
// {"code":"ru","name":"Russian"},
