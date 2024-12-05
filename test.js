function sampleFunc() {
    return {
        foo: 'foo',
        bar: 'bar'
    }
}

const {foo, bar: baz} = sampleFunc();
console.log(foo)
// console.log(bar)
console.log(baz)