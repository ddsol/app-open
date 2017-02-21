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

function queryString(query) {
  let s = Object.keys(query).map(key => key + '=' + encodeURIComponent(query[key])).join('&');
  return s ? '?' + s : '';
}

function pick(o, props) {
  let r = {};
  props.forEach(prop => {
    if (o[prop] !== undefined) {
      r[prop] = o[prop];
    }
  });
  return r;
}

function openEditor(options) {
  return getJson(`http://localhost:${port}/open-editor${queryString(pick(options, ['repo', 'file', 'line', 'column']))}`);
}

function switchBranch(options) {
  return getJson(`http://localhost:${port}/switch-branch${queryString(pick(options, ['repo', 'branch']))}`);
}

const funcs = {
  openEditor,
  switchBranch
};

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
