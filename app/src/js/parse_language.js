
// Attempts to parse the <dc:language> tag contents which is defined
// in the Dublin Core specification:
// https://www.dublincore.org/specifications/dublin-core/dces/2004-12-20/

var countries = require("i18n-iso-countries");
var languages = require("@cospired/i18n-iso-languages");

// TODO We need to manually register the other languages we want to support
languages.registerLocale(require("@cospired/i18n-iso-languages/langs/en.json"));

const unknown = {
  language: "Unknown",
  languageNative: null,
  languageCode: "?",
  country: "Unknown",
  countryNative: null,
  countryCode: "?"
};

function unknownObject() {
  return Object.assign({}, unknown);
}

// userLanguage is the language we want the
// name of the country and language in. E.g.
// parse('de', 'en') gives 'Deutsch' as .language
module.exports = function(code, userLanguage) {
  if(!userLanguage) {
    userLanguage = 'en';
  }
  
  const o = unknownObject();
  
  if(!code) {
    return o;
  }

  var languageCode;
  var countryCode;
  
  if(code.indexOf('-') >= 0) {
    const fields = code.split('-');
    languageCode = code[0].toLowerCase();
    countryCode = code[1].toUpperCase();
  } else {
    languageCode = code.toLowerCase();
  }

  if(languageCode.length === 3) {
    o.languageCode = languages.alpha3ToAlpha2(languageCode);
  } else if(languageCode.length === 2) {
    o.languageCode = languageCode;
  }

  o.language = languages.getName(languageCode, userLanguage) || 'Unknown';

  o.languageNative = languages.getName(languageCode, languageCode) || 'Unknown';

  if(!countryCode) {
    return o;
  }

  if(countryCode.length === 3) {
    o.countryCode = countries.alpha3ToAlpha2(countryCode);
  } else if(countryCode.length === 2) {
    o.countryCode = countryCode;
  }

  o.country = countries.getName(countryCode, userLanguage) || 'Unknown';
  o.countryNative = countries.getName(countryCode, countryCode) || 'Unknown';
    
  return o;
}
