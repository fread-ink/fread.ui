
function parseDOM(str, mimetype) {
  var parser = new DOMParser();
  var doc = parser.parseFromString(str, mimetype);

  // Check for errors according to:
  // see https://developer.mozilla.org/en-US/docs/Web/API/DOMParser
  var errs = doc.getElementsByTagName('parsererror');
  if(errs.length) {
    var txt = errs[0].textContent;
    txt = txt.replace(/Below is a rendering.*/i, ''); // remove useless message
    txt = txt.replace(':', ': ').replace(/\s+/, ' '); // improve formatting
    throw new Error("Parsing XML failed: " + txt);
  }

  return doc;
}

function parseXML(str) {
  return parseDOM(str, 'text/xml');
}

function parseXHTML(str) {
  return parseDOM(str, 'application/xhtml+xml');
}

export {parseDOM, parseXML, parseXHTML};
