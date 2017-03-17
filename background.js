const port = 9578;

/*chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  var url = tab.url;
  chrome.tabs.update(tab.id, { url: 'stupid' });
});*/

function get(url) {
  return new Promise(function(resolve, reject) {
    let req = new XMLHttpRequest();
    req.onreadystatechange = function() {
      if (req.readyState === XMLHttpRequest.DONE) {
        if (req.status === 200) {
          resolve(req.responseText)
        } else {
          if (req.status === 0) {
            reject(new Error('Could not connect to server'));
          } else {
            reject(new Error('Server error: ' + (req.responseText || req.statusText || req.status)));
          }
        }
      }
    };
    req.open('GET', url);
    req.send();
  });
}

function getJson(url) {
  return get(url).then(function(json) {
    return JSON.parse(json);
  });
}

function snakeCase(camels) {
  return camels.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
}

function dashCase(camels) {
  return camels.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

function queryString(query) {
  let s = Object.keys(query).map(key => snakeCase(key) + '=' + encodeURIComponent(query[key])).join('&');
  return s ? '?' + s : '';
}

function pick(obj, props) {
  if (typeof props === 'string') {
    props = props.split(/\s*,\s*/);
  }
  let result = {};
  props.forEach(prop => {
    if (obj[prop] !== undefined) {
      result[prop] = obj[prop];
    }
  });
  return result;
}

function q(options, props) {
  return queryString(pick(options, props));
}

function doCall(endpoint, props, options) {
  return getJson(`http://localhost:${port}/${endpoint}${q(options, props)}`);
}

const funcs = {};

function makeFunc(name, params) {
  return doCall.bind(null, dashCase(name), params);
}

function addFunc(name, params) {
  funcs[name] = makeFunc(name, params);
}

addFunc('openEditor', 'repo, file, line, column');
addFunc('switchBranch', 'repo, branch, branchRepo, pr');

chrome.runtime.onMessage.addListener(
  function(request, sender, respond) {
    if (funcs[request.cmd]) {
      let func = funcs[request.cmd];
      func(request).then(result => respond(result), err => respond({ error: err.message }));
      return true;
    } else {
      respond({ error: 'Unknown request type'});
    }
  });
