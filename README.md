# Oat

Oat is proof that modern JavaScript frameworks are cluttered with unnecessary cruft and arbitrary limitations. Believe it or not, vanilla JavaScript provides you with everything you need to write a full-featured single page application complete with templating and routing. Oat simply provides some nifty tricks for handling common tasks like HTML escaping, managing events, and organizing parent and child components - all in less than 1kb.

## Example

```html
<div id="app"></div>

<script src="../oat.js"></script>

<script>

function listItem(item) {

  const click = oat.event(e => {
    console.log(`you clicked ${item}`);
  });

  return oat.html`<li class="item" onclick=${click}>${item}</li>`;
}

oat.component({
  
  name: 'todoList',

  selector: '#app',

  route: 'todo',

  init: resolve => {
    // Good place to get AJAX data
    resolve(['a', 'b', 'c']);
  },

  render: items => {
    return oat.html`<ul class="todos">${items.map(listItem)}</div>`;
  }

});
</script>
```

This example renders the following markup:

```html
<div id="app">
  <ul class="todos">
    <li class="item" onclick="oat.events['#app'][0](event)">a</li>
    <li class="item" onclick="oat.events['#app'][1](event)">b</li>
    <li class="item" onclick="oat.events['#app'][2](event)">c</li>
  </ul>
</div>
```

There's a lot going on in this example. Let's break it down:

## Component options

To create a component, pass a configuration object to `oat.component()`. Options include:

- `name` (string, required): This is the identifier for the component. You can render a component at any time by calling `oat.componentName()`, where `componentName` is this identifier.

- `selector` (string, optional): If supplied, the component will render in the element that matches this CSS selector.

- `route` (string or regex, optional): If supplied, the component will only appear when the hash portion of the URL matches this string or regular expression.

- `init` (function, optional): If supplied, this function will be passed a resolve callback. The initial render will not occur until resolve is called, optionally with data to pass to the render method.

- `render` (function, required): This function should return a string of HTML to render.

## Templates

The Oat way is to simply use ES2015 template strings tagged with `oat.html`. This tag does two things:

- It HTML-escapes your template variables, with a bit of magic to avoid escaping the parts of child component templates that aren't variables. 

- It allows you to use template variables that are strings, numbers, or arrays of strings or numbers, as in the example above.

Don't want to HTML escape a particular template? Don't tag it with `oat.html`.

## Events

Handling events with Oat feels a lot like handling events with React. Just register an event handler with `oat.event()`, and reference it using native DOM syntax in your template.

```javascript
const submit = oat.event(e => {
  e.preventDefault();
  $.post('/api', {
    data: data
  });
});

return oat.html`<form onsubmit=${submit}>
  <button type="submit">Submit</button>
</form>`;
```

## Child Components

If you don't configure a component to render inside a specific element with the `selector` option, you can render it inside any other component's template. Here's an example:

```javascript
oat.component({
  
  name: 'app',

  selector: '#app',

  render: () => {
    return oat.html`<div class="container">
      ${oat.content()}
    </div>`;
  }

});

oat.component({
  
  name: 'content',

  render: () => {
    return oat.html`<span>This is a child template.</span>`;
  }

});
```

### Passing data to children

Here's a slightly more complex example that passes data to the child component.

```javascript
oat.component({
  
  name: 'app',

  selector: '#app',

  init: resolve => {
    resolve({
      example: 'foo'
    });
  }

  render: data => {
    return oat.html`<div class="container">
      ${oat.content(data)}
    </div>`;
  }

});

oat.component({
  
  name: 'content',

  render: data => {
    return oat.html`<span>Example data: ${data.example}</span>`;
  }

});
```
