(() => {

    const ESCAPE_MAP = {
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

        if (value.indexOf(MAGIC_FLAG) === 0) {

            return value;

        }

        return value.replace(/[<>'"]/g, c => {

            return ESCAPE_MAP[c];

        });

    }

    /**
     * Remove the magic flags
     */
    function printEscaped(html) {

        return html ? html.toString().replace(FLAG_REGEX, '') : '';

    }

    function parse(markup) {

        let el = document.createElement('div');

        el.innerHTML = printEscaped(markup);

        if (el.children.length > 1) {
            console.error('Components must have only one root node.');
        }

        el = el.firstElementChild;

        return el;

    }

    function isVmEligible(value) {

        return value && !Array.isArray(value) && typeof value === 'object' && !value.outerHTML;

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

            return eval(expression);

        }

    }

    function bind(template, vm, replace) {

        const matches = template.match(/{(.*?)}/g);

        if (matches) {

            let firstTime = true;

            function binding() {

                let content = template;

                matches.forEach(match => {

                    const prop = match.substring(1, match.length - 1);

                    if (firstTime) {

                        vm._currentlyCreatingBinding = binding;

                    }

                    const value = evaluate(prop, vm);

                    delete vm._currentlyCreatingBinding;

                    if (typeof value === 'boolean') {

                        content = content.replace(match, value ? prop : '');
                    
                    } else if (typeof value === 'function') {

                        content = value;

                    } else {

                        content = content.replace(match, value);

                    }

                });

                replace(content);

            }

            binding();

            firstTime = false;

        }

    }

    function renderLoopContent(el, template, vm) {

        const div = parse(`<div>${template}</div>`);

        [...div.childNodes].forEach(child => {

            el.appendChild(child);

        });

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

            const el = document.createElement(tag);

            delete vm._currentlyCreatingBinding;

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

            replace(el);

        }

        binding();

        firstTime = false;

    }

    function render(el, vm) {

        for (let i = 0; i < el.attributes.length; i++) {

            const attribute = el.attributes[i];

            if (attribute.specified && attribute.name !== 'as') {

                if (attribute.name === 'loop' && el.attributes.as) {

                    loop(el.tagName,
                        attribute.value,
                        el.attributes.as.value, 
                        el.innerHTML, 
                        vm,
                        child => {
                            el.parentNode.replaceChild(child, el);
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

        }

        el.childNodes.forEach(child => {

            if (child.nodeType === 3) {

                bind(child.textContent, vm, value => {

                    child.textContent = value;

                });

            } else {

                const tag = child.tagName.toLowerCase();

                if (vm[tag] !== undefined && vm[tag]._element) {

                    el.replaceChild(vm[tag]._element, child);

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

    window.oat = oat;

    if (typeof module !== 'undefined' && module.exports) {

        module.exports = oat;

    }

})();