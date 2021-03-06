'use strict';
const {
  convertToValidSignal,
  emitExperimentalWarning
} = require('internal/util');
const {
  ERR_INVALID_ARG_TYPE,
  ERR_SYNTHETIC
} = require('internal/errors').codes;

// If report is enabled, extract the binding and
// wrap the APIs with thin layers, with some error checks.
// user options can come in from CLI / ENV / API.
// CLI and ENV is intercepted in C++ and the API call here (JS).
// So sync up with both sides as appropriate - initially from
// C++ to JS and from JS to C++ whenever the API is called.
// Some events are controlled purely from JS (signal | exception)
// and some from C++ (fatalerror) so this sync-up is essential for
// correct behavior and alignment with the supplied tunables.
const nr = internalBinding('report');

// Keep it un-exposed; lest programs play with it
// leaving us with a lot of unwanted sanity checks.
let config = {
  events: [],
  signal: 'SIGUSR2',
  filename: '',
  path: ''
};
const report = {
  setOptions(options) {
    emitExperimentalWarning('report');
    const previousConfig = config;
    const newConfig = {};

    if (options === null || typeof options !== 'object')
      options = {};

    if (Array.isArray(options.events))
      newConfig.events = options.events.slice();
    else if (options.events === undefined)
      newConfig.events = [];
    else
      throw new ERR_INVALID_ARG_TYPE('events', 'Array', options.events);

    if (typeof options.filename === 'string')
      newConfig.filename = options.filename;
    else if (options.filename === undefined)
      newConfig.filename = '';
    else
      throw new ERR_INVALID_ARG_TYPE('filename', 'string', options.filename);

    if (typeof options.path === 'string')
      newConfig.path = options.path;
    else if (options.path === undefined)
      newConfig.path = '';
    else
      throw new ERR_INVALID_ARG_TYPE('path', 'string', options.path);

    if (typeof options.signal === 'string')
      newConfig.signal = convertToValidSignal(options.signal);
    else if (options.signal === undefined)
      newConfig.signal = 'SIGUSR2';
    else
      throw new ERR_INVALID_ARG_TYPE('signal', 'string', options.signal);

    if (previousConfig.signal)
      process.removeListener(previousConfig.signal, handleSignal);

    if (newConfig.events.includes('signal'))
      process.on(newConfig.signal, handleSignal);

    config = newConfig;
    nr.syncConfig(config, true);
  },
  triggerReport(file, err) {
    emitExperimentalWarning('report');

    if (typeof file === 'object' && file !== null) {
      err = file;
      file = undefined;
    } else if (file !== undefined && typeof file !== 'string') {
      throw new ERR_INVALID_ARG_TYPE('file', 'String', file);
    } else if (err === undefined) {
      err = new ERR_SYNTHETIC();
    } else if (err === null || typeof err !== 'object') {
      throw new ERR_INVALID_ARG_TYPE('err', 'Object', err);
    }

    return nr.triggerReport('JavaScript API', 'API', file, err.stack);
  },
  getReport(err) {
    emitExperimentalWarning('report');

    if (err === undefined)
      err = new ERR_SYNTHETIC();
    else if (err === null || typeof err !== 'object')
      throw new ERR_INVALID_ARG_TYPE('err', 'Object', err);

    return nr.getReport(err.stack);
  }
};

function handleSignal(signo) {
  if (typeof signo !== 'string')
    signo = config.signal;
  nr.triggerReport(signo, 'Signal', null, '');
}

module.exports = {
  config,
  handleSignal,
  report,
  syncConfig: nr.syncConfig
};
