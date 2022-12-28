function shouldTranslateTo (languageName) {
  return translateLanguages.filter(function (filteredLanguage) {
    return languageName === filteredLanguage.name;
  })
}

function shouldTranslateFrom (languageName) {
  return translateLanguages.filter(function (filteredLanguage) {
    return languageName === filteredLanguage.name;
  })
}
