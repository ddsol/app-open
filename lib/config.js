'use strict';

const path = require('path');

let config;
try {
  config = require(path.join(__dirname, '../config'));
} catch (err) {
  console.log('Please add a config.js');
  config = {
    defaultRoot: '/',
    repoRoots: {},
    editor: 'nano',
    paths: {
      nano: 'nano'
    }
  };
}

module.exports = config;
