(function() {
  let chrome = this['chrome'];

  function makeStub(cmd, args) {
    if (typeof args === 'string') {
      args = args.split(/,\s*/);
    }
    return function() {
      const options = { cmd };
      args.forEach((arg, ix) => options[arg] = arguments[ix]);
      return new Promise((resolve, reject) => chrome.runtime.sendMessage(
        options,
        function(response) {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        }
      ));
    }
  }

  const openEditor = makeStub('openEditor', 'repo, ref, file, line, column');
  const switchBranch = makeStub('switchBranch', 'repo, branch, branchRepo, pr');

  function getRepo() {
    const repoLink = document.querySelector('div.repohead-details-container>h1>strong[itemprop="name"]>a');
    const repoHref = repoLink && repoLink.href;
    return repoHref.replace(/^.*github.com\//, '');
  }

  function handleLinkClick(e) {
    const target = e.target;
    if (target && !e.altKey && e.ctrlKey && !e.shiftKey) {
      const parent = target.parentNode;
      if (!/\bfile-info\b/.test(parent.className)) return;
      if (!target.title) return;
      const repo = getRepo();
      e.preventDefault();
      e.stopPropagation();
      openEditor(repo, getLocationRef(), target.title).then(null, err => flashMessage(err));
    }
  }

  function getLocationRef(url) {
    url = url || location.href;
    const locRef = /github\.com\/[^/]+\/[^/]+\/(?:raw|blob|commit|tree|pull\/\d+\/files)\/([a-f0-9]+)(:?\/|$|#|\?)/.exec(url);
    if (locRef) return locRef[1];
  }

  function handleDiffTableClick(e) {
    let target = e.target;
    while (target && target.nodeName !== 'TD') {
      target = target.parentElement;
    }
    if (target && !e.altKey && e.ctrlKey && !e.shiftKey) {
      const code = /\bblob-code\b/.test(target.className);
      const num = /\bblob-num\b/.test(target.className);
      if (!code && !num) return;
      let numBefore, numAfter, line;
      if (code) {
        numAfter = target.previousElementSibling;
        numBefore = numAfter.previousElementSibling;
      } else {
        const prev = target.previousElementSibling;
        if (prev) {
          numBefore = prev;
          numAfter = target;
        } else {
          numBefore = target;
          numAfter = target.nextElementSibling;
        }
      }
      if (numAfter && numAfter.dataset.lineNumber) {
        line = numAfter.dataset.lineNumber;
      } else if (numBefore && numBefore.dataset.lineNumber) {
        line = numBefore.dataset.lineNumber;
      }

      let file;
      let ref = getLocationRef();

      const locFile = /github\.com\/[^/]+\/[^/]+\/blob\/([^/]+)\/([^#?]*)/.exec(location.href);
      let link;
      if (locFile) {
        ref = locFile[1];
        file = locFile[2];
      } else {
        try {
          link = link || target.parentNode.parentNode.parentNode.parentNode.parentNode.previousElementSibling.querySelector('div.file-info a');
        } catch (err) {}
        try {
          link = link || target.parentNode.parentNode.parentNode.parentNode.parentNode.querySelector('a.file-info');
        } catch (err) {}
        try {
          link = link || target.parentNode.parentNode.parentNode.parentNode.parentNode.querySelector('a[title][href*="/files/"]');
        } catch (err) {}
        if (!link) return;
        file = link.title || link.innerText;
        ref = getLocationRef(link.href) || ref;
      }

      if (!file) return;
      const repo = getRepo();
      e.preventDefault();
      e.stopPropagation();
      openEditor(repo, ref, file, line).then(null, err => flashMessage(err));
    }
  }

  function okMessage(response, msg) {
    if (response === 'OK') {
      response = msg;
    }
    flashMessage(response);
  }

  function handleBranchClick(e) {
    let target = e.target;
    const parent = target.parentNode;
    if (/\bcommit-ref\b/.test(parent.className)) {
      target = parent;
    }
    if (target && !e.altKey && e.ctrlKey && !e.shiftKey) {
      const repo = getRepo();
      let branchRepo = repo;
      let pr = undefined;
      e.preventDefault();
      e.stopPropagation();
      let branch = target.innerText.trim();
      if (/\bselect-menu-button\b/.test(parent.className) && parent.title && !/:|Switch branches/i.test(parent.title)) {
        target = parent;
        branch = target.title;
      }
      if (/:/.test(branch) && target.title) {
        let split = target.title.trim().split(':');
        branchRepo = split[0];
        branch = split[1];
        pr = /github\.com\/[^/]+\/[^/]+\/pull\/([^#?]*)/.exec(location);
        if (pr) {
          pr = pr[1];
        }
      }
      switchBranch(repo, branch, branchRepo, pr).then(response => okMessage(response, `Switched to ${branch}`), err => flashMessage(err));
    }
  }

  function query(...selectors) {
    return Array.from(document.querySelectorAll(selectors.join(',')));
  }

  function attach() {
    query(
      'span.current-branch>span',
      'span.commit-ref>span',
      'div.branch-select-menu span.js-select-button',
      'button.branch span.js-select-button',
      'div.RecentBranches-item a.RecentBranches-item-link',
      'a.sha',
      'a.branch-name',
      'span.sha',
      '.branch-select-menu>.select-menu-button',
      '.commit-ref>a'
    ).forEach(function(tag) {
      if (tag.dataset.addOpen) return;
      tag.dataset.addOpen = true;
      tag.addEventListener('click', handleBranchClick);
    });

    query('a[title]').forEach(function(tag) {
      if (tag.dataset.addOpen) return;
      tag.dataset.addOpen = true;
      tag.addEventListener('click', handleLinkClick);
    });

    query(
      'table.diff-table',
      'table.highlight'
    ).forEach(function(tag) {
      if (tag.dataset.addOpen) return;
      tag.dataset.addOpen = true;
      tag.addEventListener('click', handleDiffTableClick);
    });
  }

  let flashQueue = [];
  let flashing = false;

  function flashMessage(msg, error) {
    flashQueue.push(msg);
    showNextFlash();
  }

  function showNextFlash() {
    if (flashing) return;
    let message = flashQueue.shift();
    if (!message) return;
    let error = false;
    if (message instanceof Error) {
      message = message.message;
      error = true;
    }

    flashing = true;

    let div = document.createElement('div');
    let style = div.style;

    Object.assign(style, {
      position: 'fixed',
      top: '-50px',
      left: '150px',
      background: error ? '#822' : '#228',
      color: 'white',
      boxShadow: '1px 2px 5px rgba(0, 0, 40, 0.2)',
      padding: '10px',
      transition: 'top 0.5s ease-in',
      zIndex: 99999999
    });

    div.innerHTML = message;
    document.body.appendChild(div);
    setTimeout(() => {
      style.top = '50px';
      style.transition= 'top 0.5s ease-out'
    }, 1);

    setTimeout(() => {
      flashing = false;
      showNextFlash();
      style.top = '-50px';
      setTimeout(() => {
        div.remove();
      }, 500);
    }, 3000);
  }

  if (MutationObserver) {
    let observer = new MutationObserver(function(mutations) {
      attach();
    });
    //tiny delay needed for firefox
    setTimeout(observe, 100);

    function observe() {
      if (!document.body) {
        return setTimeout(observe, 100);
      }

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      setTimeout(() => attach(), 1);
    }
  } else {
    attach();
  }
}());
