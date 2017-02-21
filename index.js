'use strict';

const port = 9578;

const express = require('express');
const app = express();
const path = require('path');
const openEditor = require('./lib/open-editor');
const switchBranch = require('./lib/switch-branch');
const co = require('bluebird-co').co;
const config = require('./lib/config');

express.response.sendJson = function(json) {
  this.setHeader('Content-Type', 'application/json');
  this.send(JSON.stringify(json));
};

function route(path, handler) {
  app.get(path, function (req, res) {
    co(function*() {
      try {
        res.sendJson((yield* handler(req, res)) || 'OK');
      } catch (err) {
        console.log(err.stack);
        res.sendJson({ error: err.message });
      }
    });
  });
}

function rootFromRepo(repo) {
  let root;
  if (repo) {
    repo = repo.split('/');
    if (config.roots[repo[0]]) {
      root = config.roots[repo[0]][repo[1]];
      if (!root) {
        throw new Error(`Repo user "${repo[1]}" of user "${repo[0]}" not found`);
      }
    } else {
      throw new Error(`Repo user "${repo[0]}" not found`);
    }
  }
  if (!root) {
    root = config.defaultRoot
  }
  return path.normalize(root);
}

route('/open-editor', function* (req, res) {
  const query = req.query;
  let file = query.file;
  if (!file) {
    throw new Error('No file specified');
  }

  const root = rootFromRepo(query.repo);
  file = path.join(root, file);

  return yield openEditor(config.editor, root, file, query.line, query.column);
});

route('/switch-branch', function* (req, res) {
  const query = req.query;
  let branch = query.branch;
  if (!branch) {
    throw new Error('No branch specified');
  }
  const root = rootFromRepo(query.repo);
  return yield switchBranch(root, branch);
});

app.listen(port, function () {
  console.log(`Listening on port ${port}`)
});
