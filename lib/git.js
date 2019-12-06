'use strict';

const Promise = require('bluebird');
const wrap = require('bluebird-co').wrap;
const path = require('path');
const fs = Promise.promisifyAll(require('fs'));
const exec = Promise.promisify(require('child_process').exec);
const parseDiff = require('parse-diff');

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

const pull = wrap(function* (projectRoot, ffOnly) {
  if (ffOnly) {
    return yield git(projectRoot, `pull --ff-only`);
  }
  return yield git(projectRoot, `pull`);
});

const mergeTracking = wrap(function* (projectRoot, ffOnly) {
  if (ffOnly) {
    return yield git(projectRoot, `merge --ff-only`);
  }
  return yield git(projectRoot, `merge`);
});

const isDirty = wrap(function* (projectRoot) {
  return Boolean((yield git(projectRoot, 'diff --shortstat')).trim());
});

const diff = wrap(function* (projectRoot, { file, refA, refB, ignoreWhiteSpace }) {
  file = file ? ` -- ${file}` : '';
  refA = refA ? ` ${refA}` : '';
  refB = refB ? ` ${refB}` : '';
  ignoreWhiteSpace = ignoreWhiteSpace ? ` --ignore-all-space` : '';
  return yield git(projectRoot, `diff --unified=3${ignoreWhiteSpace}${refA}${refB}${file}`)
});

const parsedDiff = wrap(function* (projectRoot, { file, refA, refB, ignoreWhiteSpace }) {
  console.log('p d', projectRoot, file, refA, refB);
  return parseDiff(yield diff(projectRoot, { file, refA, refB, ignoreWhiteSpace }));
});

const diffLineMap = wrap(function* (projectRoot,  { file, refA, refB, ignoreWhiteSpace }) {
  const diff = yield parsedDiff(projectRoot,  { file, refA, refB, ignoreWhiteSpace });
  const aToB = Object.create(null);
  const bToA = Object.create(null);
  diff.forEach(file => {
    const chunks = file.chunks;
    const map = [];
    let nextOldLine = 1;
    let nextNewLine = 1;
    chunks.forEach(chunk => {
      const { oldStart, newStart } = chunk;

      while (nextOldLine < oldStart && nextNewLine < newStart) {
        map.push([
          { line: nextOldLine, between: false, at: 'catch up both' },
          { line: nextNewLine, between: false  }
        ]);
        nextOldLine++;
        nextNewLine++;
      }
      while (nextOldLine < oldStart) {
        map.push([
          { line: nextOldLine, between: false, at: 'catch up old' },
          { line: nextNewLine, between: true }
        ]);
        nextOldLine++;
      }
      while (nextNewLine < newStart) {
        map.push([
          { line: nextOldLine, between: true, at: 'catch up new' },
          { line: nextNewLine, between: false }
        ]);
        nextNewLine++;
      }
      nextOldLine = oldStart;
      nextNewLine = newStart;

      for (let i = 0; i < chunk.changes.length; i++) {
        const current = chunk.changes[i];
        const next = chunk.changes[i + 1] || {};
        const currentLine  = current.type === 'del' ? current.ln - oldStart : current.ln - newStart;
        let nextLine = next.type === 'del' ? next.ln - oldStart : next.ln - newStart;
        if (current.type === 'del' && next.type === 'add' && currentLine === nextLine) {
          map.push([
            { line: current.ln, between: false, at: 'change' },
            { line: next.ln, between: false }
          ]);
          i++;
          nextOldLine = current.ln + 1;
          nextNewLine = next.ln + 1;
        } else if (current.type === 'del') {
          map.push([
            { line: current.ln, between: false, at: 'delete' },
            { line: nextNewLine - 1, between: true }
          ]);
          nextOldLine = current.ln + 1;
        } else if (current.type === 'add') {
          map.push([
            { line: nextOldLine - 1, between: true, at: 'add' },
            { line: current.ln, between: false }
          ]);
          nextNewLine = current.ln + 1;
        } else  if (current.type === 'normal') {
          map.push([
            { line: current.ln1, between: false, at: 'same' },
            { line: current.ln2, between: false }
          ]);
          nextOldLine = current.ln1 + 1;
          nextNewLine = current.ln2 + 1;
        }
      }
    });
    file.map = map;
    const makeMapper = forward => {
      const srcMapIx = Number(!forward);
      const dstMapIx = Number(Boolean(forward));
      const lastChunk = file.chunks[file.chunks.length - 1];
      let endSrc;
      let endDst;
      if (forward) {
        endSrc = lastChunk.oldStart + lastChunk.oldLines;
        endDst = lastChunk.newStart + lastChunk.newLines;
      } else {
        endSrc = lastChunk.newStart + lastChunk.newLines;
        endDst = lastChunk.oldStart + lastChunk.oldLines;
      }
      const lineMap = Object.create(null);
      map.forEach(m => {
        const src = m[srcMapIx];
        const dst = m[dstMapIx];
        if (!src.between) {
          lineMap[src.line] = dst;
        }
      });
      return line => {
        if (line >= endSrc) {
          return {
            line: line - endSrc + endDst,
            between: false
          };
        }
        return lineMap[line];
      };
    };
    file.mapAToB = makeMapper(true);
    file.mapBToA = makeMapper(false);
    aToB[file.from] = file;
    bToA[file.to] = file;
  });
  if (file) {
    return {
      aToB: aToB[file].aToB || bToA[file].mapAToB,
      bToA: bToA[file].bToA || aToB[file].mapBToA
    }
  }
  return {
    aToB,
    bToA
  };
});

module.exports = {
  bind,
  git,
  branchExists,
  checkOut,
  remote,
  fetch,
  pull,
  mergeTracking,
  isDirty,
  diff,
  parsedDiff,
  diffLineMap
};
