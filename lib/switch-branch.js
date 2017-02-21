'use strict';

const Promise = require('bluebird');
const wrap = require('bluebird-co').wrap;
const fs = Promise.promisifyAll(require('fs'));
const gitLib = require('./git');

module.exports = wrap(function* (projectRoot, branch) {
  const git = gitLib.bind(projectRoot);
  let fetched = false;
  //If the branch already exists locally, just switch to it. It may not be up to date, however.
  const branchExists = yield git.branchExists(branch);
  if (!branchExists) {
    const remote = yield git.remote();
    if (!(yield git.branchExists(`${remote}/${branch}`))) {
      yield git.fetch(branch);
      fetched = true;
    }
  }
  const result = yield git.checkOut(branch, !branchExists);
  if (!fetched) {
    try {
      yield git.fetch(branch);
    } catch(err) {
      //ignore
    }
  }
  return result;
});
