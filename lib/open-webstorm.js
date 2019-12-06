'use strict';

const Promise = require('bluebird');
const wrap = require('bluebird-co').wrap;
const path = require('path');
const exec = Promise.promisify(require('child_process').exec);
const config = require('./config').config;

const isWin = /^win/.test(process.platform);

let focusWebstorm;
let processWindows;
if (isWin) {
  focusWebstorm = function() {
    if (!processWindows) {
      processWindows = require('node-process-windows');
    }
    processWindows.focusWindow('webstorm');
  }
} else {
  focusWebstorm = function() {};
}

const openWebstorm = wrap(function* (projectRoot, file, line, column) {
  const executable = path.normalize(config.paths.webstorm);
  const lineStr = line ? ` --line ${line}` : '';
  const command = `"${executable}" ${projectRoot}${lineStr} "${file.replace(/\\/g,'\\\\')}"`;
  console.log(command);
  const result = (yield exec(command, {
      cwd: projectRoot
    })).stdout;
  focusWebstorm();
  return result;
});

module.exports = openWebstorm;
