'use strict';

const path = require('path');
const fs = require('fs');
const file = path.join(__dirname, '../config.json');

let config;
try {
  config = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (err) {
  if (err.name === 'SyntaxError') throw new Error('Error in config.json: ' + err.message);
  config = {
    defaultRoot: '/',
    repoRoots: {},
    editor: 'nano',
    paths: {
      nano: 'nano'
    }
  };
  setConfig(config);
}

function setConfig(config) {
  fs.writeFileSync(file, JSON.stringify(config, 2, null), 'utf8');
  const exported = module.exports.config;
  if (!exported) return;
  Object.keys(exported).forEach(key => { delete exported[key] });
  Object.keys(config).forEach(key => exported[key] = config[key]);
}

module.exports = {
  config,
  setConfig
};
