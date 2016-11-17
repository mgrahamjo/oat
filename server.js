/**
 * Filesystem utilities
 */
const path = require('path'),
  fs = require('fs'),

  /**
   * HTML escaping map
   */
  ESCAPE_MAP = {
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    '\'': '&apos;'
  },

  /**
   * Flag for marking strings as escaped
   */
  MAGIC_FLAG = '&zwnj;',

  /**
   * Regex for removing the magic flag
   */
  FLAG_REGEX = new RegExp(MAGIC_FLAG, 'g');

/**
 * The HTML to send to the browser
 */
let appHTML,

  /**
   * The un-rendered HTML
   */
  emptyAppHTML,

  /**
   * The function to run on each request
   */
  app,

  /**
   * Flag that turns off HTML escaping when true
   */
  trust,

  /**
   * Default view model
   */
  defaultVM;

/**
 * Convert a relative path to an absolute path
 */
function absolutePath(relativePath) {

  return path.join(path.dirname(require.main.filename), relativePath);

}

/**
 * Convert a string, number, or array into a string
 */
function stringify(value) {

  return Array.isArray(value) ? value.map(v => {

    return v.toString();

  }).join('') : value.toString();

}

/**
 * HTML escape a string unless it has been marked safe
 */
function htmlEscape(value) {

  value = stringify(value);

  if (value.indexOf(MAGIC_FLAG) === 0 || trust) {

    return value;

  }

  return value.replace(/[<>'"]/g, c => {

    return ESCAPE_MAP[c];

  });

}

/**
 * Template string tag for HTML escaping
 */
function oat(strings, ...values) {

  return MAGIC_FLAG + strings.map((string, i) => {
    
    return string + (values[i] === undefined ? '' : htmlEscape(values[i]));

  }).join('');

}

/**
 * Turn off HTML escaping before rendering
 */
oat.trust = (...args) => {

  trust = true;

  const result = oat.apply(undefined, args);

  trust = false;

  return result;

};

/**
 * DOM events can noop on the server
 */
oat.event = () => {

  return () => {};

};

/**
 * Set the content of a component's placeholder element
 */
function replaceHTML(name, html) {

  const rx = new RegExp(`<[^>]*?data-oat=["']${name}["'].*?>`),

    match = appHTML.match(rx);

  if (match) {

    appHTML = appHTML.replace(rx, match[0] + html).replace(FLAG_REGEX, '');

  }

}

/**
 * Insert the default VM into the DOM
 */
function hydrateState() {

  if (Object.keys(defaultVM).length) {

    const rx = /<script.*?>/,

      match = appHTML.match(rx),

      html = `<script id="_oat_vm" type="text/template">${JSON.stringify(defaultVM)}</script>`;

    if (match) {

      appHTML = appHTML.replace(rx, html + match[0]);

    }

  }

}

/**
 * Given a name, optional init function, and
 * a render function, return a component function.
 */
oat.component = (name, init, render) => {

  return (...args) => {

    const vm = Object.create(defaultVM);

    if (render) {

      /**
       * Initialize the view model, and
       * pass a noop for the update function.
       */
      init(vm, () => {});

    } else {

      render = init;

    }

    args.unshift(vm);

    const output = render.apply(undefined, args);

    replaceHTML(name, output);

    return output;

  };

};

/**
 * noop on the server
 */
oat.go = () => {};

/**
 * Create links, but without event handlers.
 */
oat.link = (route, event) => {

  return event ? '' : `href=${route}`;

};

/**
 * Creates a map of routes to components.
 * Returns a function that renders the app.
 */
oat.app = fn => {

  const routes = new Map();

  fn(routes);

  return () => {

    routes.forEach((component, route) => {

      if (typeof route === 'string') {

        route = `^${route}$`;

      }

      const matches = oat.request.url.match(route);

      if (matches) {

        matches.shift();

        oat.request.params = matches;

        component();

      }

    });

  };

};

/**
 * Component or app functions to run
 */
oat.use = (_app) => {

  app = _app;

};

/**
 * Gets and saves the unrendered HTML
 */
oat.setViewSync = (viewPath) => {

  viewPath = absolutePath(viewPath);
  
  emptyAppHTML = fs.readFileSync(viewPath).toString();

};

/**
 * Given a new request, reset everything,
 * render the page, and return the HTML.
 */
oat.respond = (req, vm = {}) => {

  defaultVM = vm;

  oat.request = req;

  oat.request.href = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

  appHTML = emptyAppHTML;

  app();

  hydrateState();

  return appHTML;

};

/**
 * A tiny hack to trick module bundlers into
 * using browser.js instead of server.js
 */
global.oatServer = require;

module.exports = oat;
