'use strict';

const wrap = require('bluebird-co').wrap;
const gitLib = require('./git');
const config = require('./config').config;

module.exports = wrap(function* (projectRoot, branch, branchRepo, pr) {
  const git = gitLib.bind(projectRoot);
  let fetched = false;
  //If the branch already exists locally, just switch to it. It may not be up to date, however.
  const branchExists = yield git.branchExists(branch);
  if (!branchExists) {
    const remote = yield git.remote();
    if (!(yield git.branchExists(`${remote}/pull/${pr}`))) {
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
