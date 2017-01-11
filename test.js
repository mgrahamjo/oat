const vm = oat.vm({
    list: [{
        prop: 'prop',
        list: [4,5,6]
    }],
    things: {
        a: 1,
        b: 2,
        c: 3
    },
    obj: {
        one: 'one',
        two: 'two'
    }
});

const child = oat(vm, `
    <div>
        <div loop="list" as="l">
            {l.prop}
            <div loop="l.list" as="s">
                {s}
            </div>
        </div>
        <div loop="things" as="a.b">
            <p>{a}:{b}</p>
        </div>
    </div>`);

// const vm = oat.vm({
//     visible: true,
//     a: 'foo',
//     b: 'bar',
//     child: child,
//     onclick: () => {
//         console.log('click');
//         vm.a = 'baz';
//     }
// });

// const app = oat(vm, `
//     <div class="app {visible}">
//         {a} {b}
//         <button onclick={onclick}>click</button>
//         <child></child>
//     </div>`);

oat.render('body', child);
