'use strict';

const Promise = require('bluebird');
const wrap = require('bluebird-co').wrap;
const path = require('path');
const fs = Promise.promisifyAll(require('fs'));
const exec = Promise.promisify(require('child_process').exec);

const bind = function(projectRoot) {
  const m = {};
  Object.keys(module.exports).forEach(func => {
    if (func !== 'bind') {
      m[func] = module.exports[func].bind(null, projectRoot);
    }
  });
  return m;
};

const git = wrap(function* (projectRoot, args) {
  try {
    const command = `git ${args}`;
    console.log(command);
    return yield exec(command, {
      cwd: projectRoot
    });
  } catch (err) {
    if (/^Command failed/.test(err.message)) {
      throw new Error(err.message.replace(/.*\n/,''));
    } else {
      throw err;
    }
  }
});

const branchExists = wrap(function* (projectRoot, branch) {
  try {
    yield git(projectRoot, `rev-parse --verify ${branch}`);
    return true;
  } catch(err) {
    if (/Needed a single revision/i.test(err.message)) return false;
    throw err;
  }
});

const checkOut = wrap(function* (projectRoot, branch, remote) {
  if (remote) {
    if (typeof remote !== 'string') {
      remote = yield module.exports.remote(projectRoot);
    }
    yield git(projectRoot, `checkout -t ${remote}/${branch}`);
  } else {
    yield git(projectRoot, `checkout ${branch}`);
  }
});

const remote = wrap(function* (projectRoot) {
  return (yield git(projectRoot, `remote -v`)).split('\t')[0];
});

const fetch = wrap(function* (projectRoot, branch) {
  if (!branch) {
    return yield git(projectRoot, `fetch`);
  }
  let remote;
  if (branch.indexOf('/') === -1) {
    remote = yield module.exports.remote(projectRoot);
  } else {
    const split = branch.split('/');
    remote = split[0];
    branch = split[1];
  }
  return yield git(projectRoot, `fetch ${remote} ${branch}`);
});

module.exports = {
  bind,
  git,
  branchExists,
  checkOut,
  remote,
  fetch
};
