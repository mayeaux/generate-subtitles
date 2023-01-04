const languageNameMap = require('language-name-map/map')

l = console.log;

/** STUFF FOR WHISPER **/
const whisperLanguagesString = 'af,am,ar,as,az,ba,be,bg,bn,bo,br,bs,ca,cs,cy,da,de,el,en,es,et,eu,fa,fi,fo,fr,gl,gu,ha,haw,hi,hr,ht,hu,hy,id,is,it,iw,ja,jw,ka,kk,km,kn,ko,la,lb,ln,lo,lt,lv,mg,mi,mk,ml,mn,mr,ms,mt,my,ne,nl,nn,no,oc,pa,pl,ps,pt,ro,ru,sa,sd,si,sk,sl,sn,so,sq,sr,su,sv,sw,ta,te,tg,th,tk,tl,tr,tt,uk,ur,uz,vi,yi,yo,zh';

const whisperLanguagesHumanNames = 'Afrikaans,Albanian,Amharic,Arabic,Armenian,Assamese,Azerbaijani,Bashkir,Basque,Belarusian,Bengali,Bosnian,Breton,Bulgarian,Burmese,Castilian,Catalan,Chinese,Croatian,Czech,Danish,Dutch,English,Estonian,Faroese,Finnish,Flemish,French,Galician,Georgian,German,Greek,Gujarati,Haitian,Haitian Creole,Hausa,Hawaiian,Hebrew,Hindi,Hungarian,Icelandic,Indonesian,Italian,Japanese,Javanese,Kannada,Kazakh,Khmer,Korean,Lao,Latin,Latvian,Letzeburgesch,Lingala,Lithuanian,Luxembourgish,Macedonian,Malagasy,Malay,Malayalam,Maltese,Maori,Marathi,Moldavian,Moldovan,Mongolian,Myanmar,Nepali,Norwegian,Nynorsk,Occitan,Panjabi,Pashto,Persian,Polish,Portuguese,Punjabi,Pushto,Romanian,Russian,Sanskrit,Serbian,Shona,Sindhi,Sinhala,Sinhalese,Slovak,Slovenian,Somali,Spanish,Sundanese,Swahili,Swedish,Tagalog,Tajik,Tamil,Tatar,Telugu,Thai,Tibetan,Turkish,Turkmen,Ukrainian,Urdu,Uzbek,Valencian,Vietnamese,Welsh,Yiddish,Yoruba';

const whisperLanguagesHumanReadableArray = whisperLanguagesHumanNames.split(',');
const whisperLanguagesAsSpacedString = whisperLanguagesHumanReadableArray.join(' ')
const languagesArray = whisperLanguagesHumanReadableArray.map(lang => ({value: lang, name: lang}));
languagesArray.unshift({value: 'auto-detect', name: 'Auto-Detect'});

function getLanguageCodeForAllLanguages (languageName) {
  let foundLanguageCode;
  Object.keys(languageNameMap).forEach(languageCode =>{
    if (languageNameMap[languageCode].name === languageName) {
      foundLanguageCode = languageCode
    }
  });
  return foundLanguageCode
}

const whisperModelsString = 'tiny.en,tiny,base.en,base,small.en,small,medium.en,medium,large';
const modelsArray = [
  {name: 'Tiny (English Only)', value: 'tiny.en'},
  {name: 'Tiny', value: 'tiny'},
  {name: 'Base (English Only)', value: 'base.en'},
  {name: 'Base', value: 'base'},
  {name: 'Small (English Only)', value: 'small.en'},
  {name: 'Small', value: 'small'},
  {name: 'Medium (English Only)', value: 'medium.en'},
  {name: 'Medium', value: 'medium'},
  {name: 'Large', value: 'large'},
];

// available models in Libretranslate
const translationLanguages = [
  {'code':'ar','name':'Arabic'},
  {'code':'az','name':'Azerbaijani'},
  {'code':'zh','name':'Chinese'},
  {'code':'cs','name':'Czech'},
  {'code':'da','name':'Danish'},
  {'code':'nl','name':'Dutch'},
  {'code':'en','name':'English'},
  {'code':'fi','name':'Finnish'},
  {'code':'fr','name':'French'},
  {'code':'de','name':'German'},
  {'code':'el','name':'Greek'},
  {'code':'he','name':'Hebrew'},
  {'code':'hi','name':'Hindi'},
  {'code':'hu','name':'Hungarian'},
  {'code':'id','name':'Indonesian'},
  {'code':'ga','name':'Irish'},
  {'code':'it','name':'Italian'},
  {'code':'ja','name':'Japanese'},
  {'code':'ko','name':'Korean'},
  {'code':'fa','name':'Persian'},
  {'code':'pl','name':'Polish'},
  {'code':'pt','name':'Portuguese'},
  {'code':'ru','name':'Russian'},
  {'code':'sk','name':'Slovak'},
  {'code':'es','name':'Spanish'},
  {'code':'sv','name':'Swedish'},
  {'code':'tr','name':'Turkish'},
  {'code':'uk','name':'Ukranian'}
];

const languagesToTranslateTo = [
  // {"code":"ar","name":"Arabic"}, // haven't got these two to work
  // {"code":"zh","name":"Chinese"}, // webvtt format is too broken after translate
  {'code':'en','name':'English'},
  {'code':'fr','name':'French'},
  {'code':'de','name':'German'},
  {'code':'es','name':'Spanish'},
  {'code':'ru','name':'Russian'},
  {'code':'ja','name':'Japanese'},
];

// if the human readable name matches thing (or the 'en' version, transcribe
const languagesToTranscribe = [
  'Arabic',
  'English',
  'French',
  'German',
  'Spanish',
  'Russian',
  'Chinese',
  'Japanese',
  'Serbian'
]

// function shouldTranslateFrom(languageName){
//   return translationLanguages.find(function(filteredLanguage){
//     return languageName === filteredLanguage.name;
//   })
// }

function shouldTranslateFrom (languageName) {
  return languagesToTranslateTo.includes(languageName);
}

let newLanguagesMap = [];
Object.keys(languageNameMap).forEach(languageCode =>{
  newLanguagesMap.push({
    languageCode,
    name: languageNameMap[languageCode].name
  })
});

let allLanguages = [];
Object.keys(languageNameMap).forEach(languageCode =>{
  allLanguages.push({
    code: languageCode,
    name: languageNameMap[languageCode].name
  })
});

// l('all languages length');
// l(allLanguages.length);

// l('newLanguagesMap', newLanguagesMap);

// const languagesToTranscribeFrom =

module.exports = {
  whisperLanguagesHumanNames,
  languagesArray,
  languagesToTranscribe,
  whisperLanguagesAsSpacedString,
  shouldTranslateFrom,
  translationLanguages,
  getLanguageCodeForAllLanguages,
  newLanguagesMap,
  allLanguages,
  modelsArray,
  languagesToTranslateTo,
  whisperLanguagesHumanReadableArray
}
