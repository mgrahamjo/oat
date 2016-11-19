# Oat

Oat is a tiny collection of utilities for building universal JavaScript single page applications. Created for those who are skeptical of frameworks or dependencies, it's a mere 1.36kb of client side code ([babilified](https://babeljs.io/blog/2016/08/30/babili) and gzipped), and has no dependencies. 

## The Philosophy

There is a cost to taking on a dependency or abstracting a feature of native JavaScript. Dependencies release breaking changes, JavaScript grows, and best practices evolve. Eschewing trendy abstractions and simplifying wherever possible leaves the fewest potential points of failure and creates the cleanest path to adopting new practices and language features in the future.

## Install

`npm install oat --save`

## Example

The following is a simple app that displays a button and a count of the number of times the button has been clicked.

```html
<div data-oat="app"></div>
<script src="node_modules/oat/browser.js"></script>
<script>

function init(vm) {
  // Put some data on the view model
  vm.count = 0;
  // Create an event handler
  vm.click = oat.event(() => {
    vm.count++;
  });
}

function render(vm) {
  return oat`
    <div>
      <button onclick=${vm.click()}>Click</button>
      <p>Clicks: ${vm.count}</p>
    </div>`;
}

oat.component('app', init, render)();
</script>
```

## Templates

The Oat way to create templates is to use template strings tagged with `oat`. This tag does three things:

- It HTML-escapes your template variables.
- It allows you to use template variables that are strings, numbers, arrays, or DOM elements.
- It returns a DOM element rather than a string, which enables Oat to avoid re-rendering components whenever possible.

As with other view frameworks, it is required that each template have a single root element to facilitate optimized re-renders. 

> Don't want to HTML escape a template string? You can use `oat.trust` instead of `oat`, but make sure you aren't creating a script injection vulnerability.

## Components

`oat.component([string] name, [function] init, [function] render)`

This method creates and returns a component function. It accepts three arguments:

- `name`: This string is used to identify the component. 
- `init` (optional): This function is passed two arguments - a view model, to which it can append properties and methods for use in the template, and an update function, which can be called to force a re-render.
- `render`: This function is passed the view model after it has been initialized. Additional arguments can be passed to `render` by parent components.

## Component Placeholders

You can specify a DOM element in which to mount a component by setting the `data-oat` attribute to the component's name.

```html
<div data-oat="parent"></div>
<script>
oat.component('parent', vm => {
  vm.greeting = 'Hello';
},
  vm => oat`<h1>${vm.greeting}, World</h1>`
)();
</script>
<!--
  Renders the following:
  <h1>Hello, World</h1>
-->
```

## Nested Components

Components can be rendered inside the templates of other components thusly:

```html
<div data-oat="parent"></div>
<script>
// Child component
const child = oat.component('child', vm => {
  vm.thing = 'World';
},
  vm => oat`<span>${vm.thing}</span>`
);
// Parent component
oat.component('parent', vm => {
  vm.greeting = 'Hello';
},
  vm => oat`<h1>${vm.greeting}, ${child()}</h1>`
)();
</script>
<!--
  Renders the following:
  <h1>Hello, <span>World</span></h1>
-->
```

## Passing data to child components

This example is the same as the above, except that the parent component tells the child component what kind of HTML tag to render.

```html
<div data-oat="parent"></div>
<script>
// Child component
const child = oat.component('child', vm => {
  vm.thing = 'World';
},
  (vm, tag) => oat`<${tag}>${vm.thing}</${tag}>`
);
// Parent component
oat.component('parent', vm => {
  vm.greeting = 'Hello';
},
  vm => oat`<h1>${vm.greeting}, ${child('em')}</h1>`
)();
</script>
<!--
  Renders the following:
  <h1>Hello, <em>World</em></h1>
-->
```

> Note that `vm` is always the first argument of a render function. Any arguments that were passed by a parent component will come after `vm`.

> Performance tip: when possible, avoid passing objects or arrays as arguments to child components. Doing so means that the component will have to be re-rendered every time its parent is rendered, because deep equality checks on objects are prohibitively expensive. Strings, numbers, dates, and even functions are fine.

## Events

Just register an event handler with `oat.event()`, and reference it using native DOM syntax in your template.

```javascript
vm.submit = oat.event(e => {
  e.preventDefault();
  updateViewModelSomehow();
});
...
return oat`<form onsubmit=${vm.submit()}>
  <button type="submit">Submit</button>
</form>`;
```

After an event handler executes, the component will automatically be re-rendered.

`oat.event()` returns a function to which you can pass arbitrary data for use in your event handler. The DOM event will always be appended to the arguments sent to the handler.

```javascript
const component = oat.component('example', vm => {

  vm.click = oat.event((thingA, thingB, event) => {
    console.log(thingA, thingB, event.target.innerHTML);
  });

}, (vm, thingA, thingB) => {

  return oat`<button onclick=${vm.click(thingA, thingB)}>baz</button>`;

});

component('foo', 'bar');
...
```

Given this code, `component('foo', 'bar')` will render a button that logs `foo bar baz` when clicked.

> Event handlers should be the only place you interact with DOM APIs. Don't worry about using browser-only code within event handlers in server-rendered components - event handlers are never run on the server.

## Re-rendering a component

A component will automatically be re-rendered after handling an event created with `oat.event`. If you need to re-render after doing other asynchronous work such as making an AJAX call, just call the second argument of your init function.

```javascript
function init(vm, update) {

  vm.text = 'Waiting...';

  setTimeout(() => {
    vm.text = 'Re-rendered.';
    update();
  }, 2000);

}

function render(vm) {
  return oat`<h1>${vm.text}</h1>`;
}

oat.component('timer', init, render)();
```

## Routing

As in the examples above, simple apps can be run by executing the function returned by `oat.component`. More complex apps can be bootstrapped by the `oat.app` method, which provides the opportunity to perform routing. Though not required, in this example we will assume you are using a module bundler like Webpack or Browserify.

`oat.app()` accepts a callback and passes it an ES2015 map. On this map you can set strings or regular expressions as route keys, and components as values. The components will run only when their respective routes match.

```javascript
const home = require('./components/home'),
  about = require('./components/about'),
  blog = require('./components/blog');

oat.app(route => {
  route.set('/', home);
  route.set('/about', about);
  route.set(/^\/blog/, blog);
});
```

### Route data

Information about the current route can be found on the `oat.request` object, which loosely mirrors Express's `req` object:

- href: the full current URL (excluding the hash fragment when read on the server side)
- hostname: the domain of the host
- path: the portion of the url that excludes the hostname, query string, and hash fragment.
- query: the query string parameters in a deserialized object.
- params: an array of any matches from capturing groups in the route regular expression.

Given this route regex:

```javascript
oat.app(route => {
  route.set(/^\/blog\/([a-z]*)/, blog);
});
```

And this route: `http://localhost:8080/blog/post#top?id=3`

The route object will be as follows:

```javascript
{
  href: 'http://localhost:8080/blog/post#top?id=3', // Excludes hash on the server side
  hostname: 'localhost',
  path: '/blog/post',
  query: { id: 3 },
  params: ['post']
}
```

### Route links

#### From JavaScript

You can trigger a transition using `oat.go('/url')`. The page URL will be updated and the app re-rendered, without a page reload.

#### From HTML

Create a link using `oat.link('/url')` as if it were an attribute on the element.

```javascript
<a ${oat.link('/foo')}>Foo</a>
```

This will create both an `href` attribute (to preserve SEO benefits on server-rendered apps) as well as an `onclick` event.

If you want to transition on an event other than click, just pass the event as the second parameter. In this case an `href` attribute will not be rendered.

```javascript
<form ${oat.link('/foo', 'submit')}>
  <input type="submit"/>
</form>
```

## Server-side rendering

You only have to write an Oat component once, and it can run both in Node (Express) and in the browser. This means that your app will already be rendered on page load, making it search engine friendly and a great UX. Here's an example setup of an Express app using Oat:

Directory structure:
```
- project/
  - index.js
  - universal/
    - app.html
    - my-app.js
    - component.js
```

universal/my-app.js
```javascript
const oat = require('oat'),
  component = require('./component');

module.exports = oat.app(route => {
  route.set('/', component);
});
```

index.js
```javascript
const express = require('express'),
  app = express(),
  // be sure to require 'oat/server' here, not 'oat'
  oatServer = require('oat/server'),
  myApp = require('./universal/my-app');
// Make files in the 'universal' directory accessible to the browser.
app.use(express.static('universal'));
// Set the HTML file in which to run your components.
oatServer.setViewSync('universal/app.html');
// Pass in your app module
oatServer.use(myApp);
// Route handler
app.get('/', (req, res) => {
  const html = oatServer.respond(req);
  res.send(html);
});
app.listen(8080);
```

> As a best practice, do not name your HTML file index.html. If it is located in a directory that Express is serving static files from, requests to the index route ('/') would return the unparsed index.html file.

`oat.respond([object] request, [object] vm)` returns the rendered HTML.
- `request`: the Express request object
- `vm` (optional): the default view model for all components on this request

### Server-generated default view models

The optional `vm` argument can be used to add data to the view model that is only accessble on the server side, such as CSRF tokens or session data. Here's an example route handler:

```javascript
app.get('/form', (req, res) => {
  csrfLibrary.setSession(req.cookies.id);
  csrfLibrary.makeToken(token => {
    const vm = { token },
      html = oat.respond(req, vm);
    res.send(html);
  });
});
```

When using a server-generated default view model, it is recommended to set fallback values in the component. This provides visibility into what properties are expected to be available on the model, and makes it clear if the server failed to populate the `vm`.

```javascript
const form = oat.component('form', vm => {
  vm.token = vm.token || 'TOKEN NOT FOUND';
}, vm => {
  return oat`<form>
    <input type="text" name="input"/>
    <input type="hidden" value=${vm.token}/>
    <button type="submit"></button>
  </form>`;
})
```

If you are wondering how this server-generated data is persisted once the browser takes over, read on:

### State hydration

Oat will automatically convert the server-generated default view model into JSON, insert it into the DOM, and then parse it when the client side code runs, seamlessly persisting your server side view model on the client. Note that JavaScript functions cannot be parsed into JSON. If you must use a method on your default view model, a check or fallback method will be required for the client side.

### Server vs browser checks

In a well-structured application, code that can only run on the server should always be written in an Express route handler, and components should be completely agnostic to their environment. If for some reason you must write a check within a component to see if your code is running on a server or in a browser, you may check the global `oatServer` object for truthiness.

## Browser support

Oat supports Chrome, Firefox, and IE Edge out of the box. For compatiblity back to IE9, use the [babel-polyfill](https://babeljs.io/docs/usage/polyfill/).
