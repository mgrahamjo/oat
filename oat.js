(() => {

  const ESCAPE_MAP = {
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      '\'': '&apos;'
    },
    MAGIC_FLAG = '&zwnj;',
    FLAG_REGEX = new RegExp(MAGIC_FLAG, 'g'),
    state = {
      routes: []
    };

  function stringify(value) {
    return Array.isArray(value) ? value.map(v => {
      return v.toString();
    }).join('') : value.toString();
  }

  function htmlEscape(value) {

    value = stringify(value);

    if (value.indexOf(MAGIC_FLAG) === 0) {
      return value;
    }

    return value.replace(/[<>'"]/g, c => {
      return ESCAPE_MAP[c];
    });

  }

  function oat(selector, callback) {

    return callback ? document.querySelectorAll(selector).forEach(callback) : document.querySelector(selector);

  }

  oat.events = {};

  oat.html = (strings, ...values) => {

    return MAGIC_FLAG + strings.map((string, i) => {

      if (values[i] === undefined) {
        values[i] = '';
      }
      
      return string + htmlEscape(values[i]);

    }).join('');

  };

  oat.event = handler => {

    const selector = state.current.selector,
      name = state.current.name;

    oat.events[selector] = oat.events[selector] || [];

    const index = oat.events[selector].length;

    oat.events[selector].push(e => {

      handler(e);
      
      if (!['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
      
        oat[name]();
      
      }
    
    });

    return `oat.events['${selector}'][${index}](event)`;

  };

  function getHash() {
    return window.location.hash.replace('#', '');
  }

  function renderAsync(config) {

    const render = config.init ? () => { 
      new Promise(config.init).then(data => {
        oat[config.name].data = data;
        oat[config.name](data);
      });
    } : oat[config.name];

    window.setTimeout(render, 0);

  }

  function runIfRouteMatches(hash, config) {

    if (hash.match(config.route)) {

      renderAsync(config);

    } else {

      oat(config.selector, el => {

        el.innerHTML = '';

      });

    }

  }

  function initialize(config) {

    if (config.route !== undefined) {

      state.routes.push(config);

      runIfRouteMatches(getHash(), config);

    } else {

      renderAsync(config);

    }

  }

  oat.component = config => {

    if (config.selector) {

      oat[config.name] = (...args) => {

        state.current = config;
        
        oat.events[config.selector] = [];

        args.push(oat[config.name].data);

        const html = stringify(config.render.apply(window, args));

        oat(config.selector).innerHTML = html.replace(FLAG_REGEX, '');

        delete state.current;

      };

      initialize(config);

    } else {

      oat[config.name] = config.render;

    }

  };

  window.onhashchange = () => {

    const hash = getHash();

    state.routes.forEach(config => {
      runIfRouteMatches(hash, config);
    });
    
  };

  window.oat = oat;

})();
