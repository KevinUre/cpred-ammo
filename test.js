function sampleFunc({foo='foo', bar='bar',baz='baz'} = {}) {
  console.log(`${foo} ${bar} ${baz}`)
}

sampleFunc();
sampleFunc({bar: 'poo'});