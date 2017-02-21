'use strict';

const Promise = require('bluebird');
const wrap = require('bluebird-co').wrap;
const path = require('path');
const fs = Promise.promisifyAll(require('fs'));

const openEditor = wrap(function* (editor, projectRoot, file, line, column) {
  editor = require(path.join(__dirname, 'open-' + editor));
  try {
    yield fs.statAsync(file);
  } catch(err) {
    if (err.code === 'ENOENT') {
      throw new Error(`File "${file}" not found`);
    }
    throw err;
  }
  return yield editor(projectRoot, file, line, column);
});

module.exports = openEditor;
