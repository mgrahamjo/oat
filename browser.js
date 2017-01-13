(() => {

    const ESCAPE_MAP = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        '\'': '&apos;'
    };

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
    function escape(value) {

        return stringify(value).replace(/[<>'"]/g, c => {

            return ESCAPE_MAP[c];

        });

    }

    function parse(markup) {

        let el = document.createElement('div');

        el.innerHTML = markup;

        if (el.children.length > 1) {
            console.error('Components must have only one root node.');
        }

        el = el.firstElementChild;

        return el;

    }

    function isVmEligible(value) {

        return value && !Array.isArray(value) && typeof value === 'object';

    }

    function bindPropertiesToSetter(obj, setter) {

        Object.keys(obj).forEach(key => {

            let value = obj[key];

            Object.defineProperty(obj, key, {

                get: () => value,
                set: newVal => {

                    value = newVal;

                    setter('_childPropertyModified');

                }

            });

            if (isVmEligible(obj[key])) {

                bindPropertiesToSetter(obj[key], setter);

            }

        });

    }

    function makeVM(model) {

        const vm = {
            _bindings: {}
        };

        Object.keys(model).forEach(key => {

            function get() {

                if (vm._currentlyCreatingBinding) {

                    vm._bindings[key] = vm._bindings[key] || [];

                    vm._bindings[key].push(vm._currentlyCreatingBinding);

                }

                return model[key];

            }

            function set(value) {

                if (model[key] !== value) {

                    if (value !== '_childPropertyModified') {

                        if (isVmEligible(value)) {

                            bindPropertiesToSetter(value, set);

                        }

                        model[key] = value;

                    }

                    if (vm._bindings[key]) {

                        vm._bindings[key].forEach(binding => binding());

                    }

                }

            }

            Object.defineProperty(vm, key, {
                get,
                set
            });

            if (isVmEligible(model[key])) {

                bindPropertiesToSetter(model[key], set);

            }

        });

        return vm;

    }

    function evaluate(expression, scope) {

        with (scope) {

            try {

                return eval(expression);

            } catch(err) {

                return '_invalidExpression';

            }

        }

    }

    function bind(template, vm, replace) {

        const matches = template.match(/{(.*?)}/g);

        if (matches) {

            let firstTime = true;

            function binding() {

                let content = template;

                let value;

                matches.forEach(match => {

                    const prop = match.substring(1, match.length - 1);

                    if (firstTime) {

                        vm._currentlyCreatingBinding = binding;

                    }

                    value = evaluate(prop, vm);

                    delete vm._currentlyCreatingBinding;

                    

                    if (typeof value === 'boolean') {

                        content = content.replace(match, value ? prop : '');
                    
                    } else if (typeof value === 'function') {

                        content = value;

                    } else if (value && typeof value === 'object' && value._element) {

                        content = value._element;

                    } else {

                        value = value === '_invalidExpression' ? '' : escape(value);

                        content = content.replace(match, value);

                    }

                });

                replace(content);

            }

            binding();

            firstTime = false;

        }

    }

    function copyChildren(from, to) {

        [...from.childNodes].forEach(child => {

            to.appendChild(child);

        });

    }

    function renderLoopContent(el, template, vm) {

        const div = parse(`<div>${template}</div>`);

        copyChildren(div, el);

        render(el, vm);

    }

    function loop(tag, prop, temp, template, vm, replace) {

        let firstTime = true;

        function binding() {

            let parts = [];

            if (firstTime) {

                vm._currentlyCreatingBinding = binding;

            }

            const model = evaluate(prop, vm);

            delete vm._currentlyCreatingBinding;

            const el = document.createElement(tag);

            if (model !== '_invalidExpression') {

                if (Array.isArray(model)) {

                    const tempOriginalValue = vm[temp];

                    model.forEach(item => {

                        vm[temp] = item;

                        renderLoopContent(el, template, vm);

                    });

                    vm[temp] = tempOriginalValue;

                } else {

                    if (typeof temp === 'string') {

                        temp = temp.split('.');

                    }

                    Object.keys(model).forEach(key => {

                        const keyOriginalValue = vm[temp[0]],
                              valOriginalValue = vm[temp[1]];

                        vm[temp[0]] = key;
                        vm[temp[1]] = model[key];

                        renderLoopContent(el, template, vm);

                        vm[temp[0]] = keyOriginalValue;
                        vm[temp[1]] = valOriginalValue;

                    });

                }

            }

            replace(el);

        }

        binding();

        firstTime = false;

    }

    function forEachAttribute(el, callback) {

        for (let i = 0; i < el.attributes.length; i++) {

            callback(el.attributes[i]);

        }

    }

    function render(el, vm) {

        forEachAttribute(el, attribute => {

            if (attribute.specified && attribute.name !== 'as') {

                if (attribute.name === 'loop' && el.attributes.as) {

                    loop(el.tagName,
                        attribute.value,
                        el.attributes.as.value, 
                        el.innerHTML, 
                        vm,
                        child => {
                            el.parentNode.replaceChild(child, el);
                            forEachAttribute(el, attr => {
                                child.setAttribute(attr.name, attr.value);
                            });
                            el = child;
                        }
                    );

                    el.removeAttribute('loop');
                    el.removeAttribute('as');

                } else {

                    bind(attribute.value, vm, value => {

                        if (typeof value === 'function') {

                            el.removeAttribute(attribute.name);

                            el[attribute.name] = value;

                        } else {

                            attribute.value = value;

                        }

                    });

                }

            }

        });

        el.childNodes.forEach(child => {

            if (child.nodeType === 3) {

                bind(child.textContent, vm, value => {

                    child.textContent = value;

                });

            } else {

                const tag = child.tagName.toLowerCase();

                if (vm[tag] !== undefined && vm[tag]._element) {

                    bind(`{${tag}}`, vm, newChild => {

                        el.replaceChild(newChild, child);

                        child = newChild;

                    });

                } else {

                    render(child, vm);

                }

            }

        });

        return el;

    }

    function oat(vm, template, parentSelector) {

        vm._element = render(parse(template), vm);

        if (parentSelector) {

            const app = document.querySelector(parentSelector);

            app.innerHTML = '';

            app.appendChild(vm._element);

        }

        return vm;

    }

    oat.vm = makeVM;

    oat.placeholder = {
        _element: document.createElement('div')
    };

    window.oat = oat;

    if (typeof module !== 'undefined' && module.exports) {

        module.exports = oat;

    }

})();