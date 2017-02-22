'use strict';

const Promise = require('bluebird');
const wrap = require('bluebird-co').wrap;
const fs = Promise.promisifyAll(require('fs'));
const gitLib = require('./git');
const config = require('./config');

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
      fetched = true;
    } catch(err) {
      console.log('Could not fetch:', err.message);
    }
  }
  if (config.pullOnSwitch) {
    if (!fetched) {
      console.log('Not merging because fetch failed');
    } else {
      if (yield git.isDirty()) {
        console.log('Not pulling because the working directory is dirty');
      } else {
        try {
          yield git.mergeTracking(true);
        } catch (err) {
          console.log('Could not merge remote:', err.message);
        }
      }
    }
  }
  return result;
});
