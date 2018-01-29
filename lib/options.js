'use strict';

const yargs = require('yargs');
const weblog = require('webpack-log');
const MultiCompiler = require('webpack/lib/MultiCompiler');
const convertArgv = require('webpack-cli/bin/convert-argv');

const defaults = {
  config: {},
  content: [],
  dev: { publicPath: '/' },
  host: 'localhost',
  hot: {},
  http2: false,
  https: false,
  // https: {
  //   key: fs.readFileSync('...key'),
  //   cert: fs.readFileSync('...cert'),
  //   pfx: ...,
  //   passphrase: ...
  // },
  index: 'index.html',
  logLevel: 'info',
  logTime: false,
  open: false,
  // open: { app: <String>, path: <String> }
  port: 8080,
  protocol: 'http'
};

function resolve(options) {
  const { compiler } = options;
  if (compiler) {
    let configs = [];
    if (compiler instanceof MultiCompiler) {
      const { compilers } = compiler;
      configs = compilers.map(c => c.options);
    } else {
      configs = [compiler.options];
    }

    return Promise.resolve(configs);
  }

  if (options.config) {
    return Promise.resolve([options.config]);
  }

  // webpack's bin/convert-args is locked down to use yargs
  // sadly we don't have a choice here.
  const { argv } = yargs;
  let config = convertArgv({}, argv);
  // support webpack options which return a promise by asserting that all
  // passed options are wrapped in a promise
  if (typeof config.then !== 'function') {
    config = Promise.resolve(config);
  }

  return config
    .then(configs => [].concat(configs))
    .catch((e) => {
      throw e;
    });
}

function pull(obj, prefix) {
  let result;
  for (const key of Object.keys(obj)) {
    if (key.indexOf(prefix) === 0) {
      if (!result) {
        result = {};
      }
      const name = key.replace(prefix, '').toLowerCase();
      result[name] = obj[key];
    }
  }
  return result;
}

module.exports = (opts) => {
  const flags = (opts || {});
  const nodeVersion = parseInt(process.version.substring(1), 10);

  return resolve(opts).then((configs) => {
    const [first] = configs;
    const options = Object.assign({}, defaults, opts, flags, configs[0].serve);
    const https = pull(flags, 'https');
    const open = pull(flags, 'open');

    if (https) {
      options.https = https;
      options.protocol = 'https';
    }

    if (open) {
      if (!open.path) {
        open.path = '/';
      }
      options.open = open;
    }

    weblog({
      name: 'serve',
      id: 'webpack-serve',
      logLevel: options.logLevel,
      logTime: options.logTime
    });

    if (typeof options.content === 'string') {
      options.content = [options.content];
    }

    if ((!options.content || !options.content.length) && first.context) {
      options.content = [].concat(first.context);
    }

    if (options.http2 && nodeVersion < 9) {
      throw new Error('webpack-serve: The `http2` option can only be used with Node v9 and higher.');
    }

    // cleanup - doing this here so as not to mutate the options passed in.
    delete options.config;

    // this isn't part of the webpack options schema, and doesn't need to be
    delete configs[0].serve;

    return { configs, options };
  });
};