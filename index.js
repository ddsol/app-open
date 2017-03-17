'use strict';

const port = 9578;

const express = require('express');
const app = express();
const path = require('path');
const openEditor = require('./lib/open-editor');
const switchBranch = require('./lib/switch-branch');
const co = require('bluebird-co').co;
const config = require('./lib/config');
const camelCase = require('camel-case');

express.response.sendJson = function(json) {
  this.setHeader('Content-Type', 'application/json');
  this.send(JSON.stringify(json));
};

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

function camelCaseObj(obj) {
  const out = {};
  Object.keys(obj).forEach(prop => out[camelCase(prop)] = obj[prop]);
  return out;
}

function route(path, handler, noRoot) {
  app.get(path, function (req, res) {
    co(function*() {
      try {
        let query = {};
        if (req.query) {
          query = req.query = camelCaseObj(req.query);
          if (query.repo && !query.root) {
            try {
              query.root = rootFromRepo(query.repo);
            } catch(err) {
              if (noRoot) {
                console.log(err.stack);
              } else {
                throw err;
              }
            }
          }
        }
        res.sendJson((yield* handler(query, req, res)) || 'OK');
      } catch (err) {
        console.log(err.stack);
        res.sendJson({ error: err.message });
      }
    });
  });
}

route('/open-editor', function* (query) {
  let file = query.file;
  if (!file) {
    throw new Error('No file specified');
  }

  const root = query.root;
  file = path.join(root, file);

  return yield openEditor(config.editor, root, file, query.line, query.column);
});

route('/switch-branch', function* (query) {
  const branch = query.branch;
  const branchRepo = query.branchRepo;
  const pr = query.pr;

  if (!branch) {
    throw new Error('No branch specified');
  }
  const root = rootFromRepo(query.repo);

  if (!branchRepo || !pr) {
    return yield switchBranch(root, branch);
  } else {
    throw new Error('External repo switching not yet supported');
    //return yield switchPrBranch(root, branch, branchRepo, pr);
  }
});

app.listen(port, function () {
  console.log(`Listening on port ${port}`)
});
