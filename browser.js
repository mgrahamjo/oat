(() => {

  /**
   * DOMParser for converting strings to DOM nodes
   */
  const parser = new DOMParser(),

    /**
     * HTML escaping map
     */
    ESCAPE_MAP = {
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      '\'': '&apos;'
    };

  /**
   * Tracks the top-level DOM node
   * so we know when to reset
   */
  let topNode,

    /**
     * For re-rendering the app after a route change
     */
    renderAll,

    /**
     * Tracks the parent of the currently rendering component
     */
    parent,

    /**
     * Flag that turns off HTML escaping when true
     */
    trust,

    /**
     * Parse the default view model from the DOM
     */
    defaultVM = document.querySelector('script#_oat_vm');

  defaultVM = defaultVM ? JSON.parse(defaultVM.innerHTML) : {};

  /**
   * reset parent to default state
   */
  function resetParent() {

    parent = {
      id: '',
      children: {},
      rendered: {}
    };

  }

  resetParent();

  /**
   * Given an HTML string, returns a DOM node.
   */
  function parse(string) {

    return parser
      .parseFromString(string, 'text/html')
      .querySelector('body')
      .firstElementChild;
  }

  /**
   * Given a value, returns its HTML-escaped equivalent
   */
  function htmlEscape(value) {

    return value.toString().replace(/[<>'"]/g, c => ESCAPE_MAP[c]);

  }

  /**
   * Given an array, number, or string, returns an HTML-escaped string.
   * Handles arrays containing DOM elements.
   */
  function stringify(value) {

    if (Array.isArray(value)) {

      value = value.map(v => {

        return v.outerHTML || htmlEscape(v);

      }).join('');

    } else if (!trust) {

      value = htmlEscape(value);

    }

    return value;

  }

  /**
   * Template tag function. Given a template string, 
   * interpolates, stringifies, and escapes template variables.
   * Returns a new DOM node.
   */
  function oat(strings, ...values) {

    const nodes = [];
    
    let value;

    /**
     * Parse the template string into a new DOM node
     */
    const newNode = parse(strings.map((string, i) => {

      if (values[i] === undefined) {

        value = '';

      /**
       * If a value is a DOM node, save a reference to it
       * and give it a placeholder in the new HTML string.
       */
      } else if (values[i].outerHTML) {

        nodes.push(values[i]);

        value = `<i id="oat-index-${nodes.length - 1}"></i>`;

      } else {

        value = stringify(values[i]);

      }

      return string + value;

    }).join(''));

    /**
     * Iterate through the DOM nodes we saved, and insert them
     * at their respective placeholders in the new node.
     */
    nodes.forEach((node, i) => {

      const tempNode = newNode.querySelector(`#oat-index-${i}`);

      tempNode.parentNode.replaceChild(node, tempNode);

    });

    return newNode;

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
   * Determine whether the component should be re-rendered
   * based on whether the arguments may have changed
   */
  function argsMayHaveChanged(args, id) {

    for (let i = 0; i < args.length; i++) {

      /**
       * Deep equality checks on objects would be too expensive,
       * so if the arg is an object, just re-render the component :(
       */
      if (typeof args[i] === 'object' || args[i] !== oat.component[id].args[i]) {

        return true;

      }

    }

    return false;

  }

  /**
   * Given a name, an optional initialization function,
   * and a render function, returns a component function.
   */
  oat.component = (name, init, render = init) => {

    const component = (...args) => {

      /**
       * Make sure we're rendering into the correct placeholder.
       * If no parent node has been established, or we've finished
       * a render and the current parent is now the top node,
       * reset the top node.
       */
      if (!parent.node 
        || !parent.node.parentNode 
          || parent.node.parentNode.isSameNode(topNode)) {

        parent.node = document.querySelector(`[data-oat="${name}"]`);

        topNode = parent.node ? parent.node.parentNode : parent.node;

      }

      /**
       * Track the number of times that this component has 
       * been rendered into the current parent node.
       */
      parent.rendered[name] = parent.rendered[name] || 0;

      /**
       * Track the total number of children of this name
       * that should be rendered into the current parent.
       */
      parent.children[name] = parent.children[name] || [];

      /**
       * Establish a unique ID for this instance of this component. 
       */
      const id = parent.id + name + parent.rendered[name];

      component.id = id;

      /**
       * Only render this child into a new node
       * if it hasn't already been done before.
       */
      if (!oat.component[id]) {

        /**
         * Force the component to re-render
         */
        function update() {

          oat.component[id]();

        }

        /**
         * Initial state for the object we will
         * insert into the component tree
         */
        const child = {
            id,
            node: document.createElement('div'),
            children: {},
            rendered: {}
          },
          
          tempID = parent.id,
          
          vm = Object.create(defaultVM);

        /**
         * If a view model initializer was passed, run it,
         * using this component as the parent so as not
         * to trigger an infinite render loop.
         */
        if (render !== init) {

          parent.id = id;

          init(vm, update);

          parent.id = tempID;

        }

        /**
         * Insert this component into the parent
         */
        parent.children[name].push(1);

        parent.node.appendChild(child.node);
 
        /**
         * Create a closure that will re-render
         * this component into its parent node
         */
        oat.component[id] = (newArgs = args) => {

          const temp = parent;

          parent = child;

          parent.rendered = {};

          oat.event[id] = [];

          const oldNode = oat.component[id].node,

            newNode = render(vm, ...newArgs);

          oldNode.parentNode.replaceChild(newNode, oldNode);

          oat.component[id].node = newNode;

          oat.component[id].args = newArgs;

          parent = temp;

          return newNode;

        };

        oat.component[id].node = child.node;

        oat.component[id].node = oat.component[id]();

      /**
       * If this component has been rendered before, but
       * it's arguments may have changed, then re-render.
       */
      } else if (argsMayHaveChanged(args, id)) {

        oat.component[id](args);
      
      }

      parent.rendered[name]++;

      return oat.component[id].node;

    };
 
    /**
     * Remove all components of this name
     * Used to clean up during route transitions
     */
    component.destroy = () => {

      resetParent();

      delete oat.component[component.id];

      document.querySelectorAll(`[data-oat="${name}"]`).forEach(el => {

        el.innerHTML = '';

      });

    };

    return component;

  };

  /**
   * Associates an event handler with a specific
   * instance of a component, stores a reference
   * to it in the global namespace, and returns the
   * reference for use in a template string.
   */
  oat.event = (handler = () => {}) => {

    return (...args) => {

      const id = parent.id,
        index = oat.event[id].length;

      oat.event[id].push(e => {

        args.push(e);

        handler.apply(undefined, args);

        oat.component[id]();
      
      });

      return `oat.event['${id}'][${index}](event)`;

    };

  };

  /**
   * Force a route transition to the given URL
   */
  oat.go = route => {

    window.history.pushState({}, '', route);

    renderAll();

  };

  /**
   * Given a route and optional event name,
   * creates an Oat event and returns a
   * reference to it for use in a template.
   */
  oat.link = (route, event) => {

    const go = oat.event(e => {

      e.preventDefault();

      oat.go(route);

    });

    return event ? `on${event}=${go()}` : `href=${route} onclick=${go()}`;

  };

  /**
   * Returns the deserialized query string.
   */
  function getQuery() {

    const query = {};

    if (window.location.search) {

      window.location.search.substring(1).split('&').forEach(set => {

        const pair = set.split('=');

        query[pair[0]] = pair[1];

      });

    }

    return query;

  }

  /**
   * Populate the universal request object with route information
   */
  function resetRequest() {
    oat.request = {
      href: window.location.href,
      hostname: window.location.hostname,
      path: window.location.pathname,
      query: getQuery()
    };
  }

  /**
   * Creates a map of routes to components.
   * Sets the renderAll function, which re-renders
   * the whole app for the current route.
   */
  oat.app = fn => {

    const routes = new Map();

    fn(routes);

    renderAll = () => {

      resetRequest();

      routes.forEach((component, route) => {
        
        /**
         * Match against the full path
         */
        if (typeof route === 'string') {
          route = `^${route}$`;
        }

        const matches = window.location.pathname.match(route);

        component.destroy();

        if (matches) {

          /**
           * The first item in matches is the whole string
           */
          matches.shift();

          oat.request.params = matches;

          component();

        }

      });

    };

    renderAll();

  };

  window.oatServer = false;

  window.oat = oat;

  if (typeof module !== 'undefined' && module.exports) {

    module.exports = oat;

  }

})();
