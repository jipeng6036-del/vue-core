const { createRequire } = require('node:module')
const path = require('node:path')
const fs = require('node:fs')
const consumer = path.resolve(process.argv[2])
const req = createRequire(path.join(consumer, 'package.json'))
const tooling = createRequire(path.resolve(process.argv[3], 'package.json'))
const { chromium } = tooling('playwright')
const Vue = req('vue')
const { renderToString } = req('@vue/server-renderer')
const values = [
  '{ red; blue }', '[red; blue]',
  '{ outer: [one; two]; inner: { three; four } }',
  '[one; { two; three }; four]',
  'fn([one; two], { three; four })',
  String.raw`{ "};]"; \}; [one; two] }`,
  "';'", "':)'", '"a;b"'
]
values.push(
  'url(https://example.com/[)', 'URL(https://example.com/{)',
  'url(https://example.com/[;x)', String.raw`url(https://example.com/a\)b[)`,
  String.raw`\75rl(https://example.com/[)`, String.raw`u\72l(https://example.com/[)`,
  String.raw`\url(https://example.com/[)`, String.raw`\000075 rl(https://example.com/[)`,
  'url( \t\nhttps://example.com/[)', 'fn(url(https://example.com/[); [one; two])',
  '<!--url(https://example.com/[)',
  ...['myurl', '-url', '--url', '_url', 'éurl', String.raw`\6d yurl`, '#url', '@url', String.raw`#\75rl`].map(name => `${name}(fn(a); [one; two])`),
  'url("https://example.com/[")', "URL( 'https://example.com/{' )"
)

const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll("'", '&#39;')
const report = { resolved: {}, results: [] }
for (const name of ['vue', '@vue/server-renderer', '@vue/shared']) {
  const resolved = req.resolve(name)
  if (!resolved.startsWith(consumer + path.sep)) throw new Error('Module resolved outside installed consumer: ' + name)
  report.resolved[name] = path.relative(consumer, resolved).split(path.sep).join('/')
}
;(async () => {
  for (const value of values) {
    const style = `--tokens: ${value}; color: red`
    const expected = `<div style="--tokens:${escape(value)};color:red;"></div>`
    for (const mode of ['render', 'template']) {
      const app = Vue.createSSRApp(mode === 'render'
        ? { render: () => Vue.h('div', { style: [style] }) }
        : { template: `<div style="${escape(style)}"></div>` })
      const actual = await renderToString(app)
      report.results.push({mode: 'ssr-' + mode, value, expected, actual, pass: actual === expected})
    }
  }
  const browser = await chromium.launch({headless:true})
  try {
    report.browser = browser.version()
    const page = await browser.newPage()
    await page.addScriptTag({path: path.join(consumer, 'node_modules/vue/dist/vue.global.js')})
    report.results.push(...await page.evaluate(async ({values}) => {
      const result = []
      const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll("'", '&#39;')
      for (const value of values) {
        const style = `--tokens: ${value}; color: red`
        const native = document.createElement('div').style
        native.setProperty('--tokens', value)
        const expected = native.getPropertyValue('--tokens').trim()
        const nativeRejectedCustomFunction = value.startsWith('--url(')
        if ((!nativeRejectedCustomFunction && expected !== value) || (nativeRejectedCustomFunction && expected !== '')) {
          throw new Error('Unexpected native CSSOM fixture result: ' + value)
        }
        for (const mode of ['render', 'template']) {
          const host = document.createElement('main')
          document.body.append(host)
          const app = Vue.createApp(mode === 'render'
            ? {render: () => Vue.h('div', {style: [style]})}
            : {template: `<div style="${escape(style)}"></div>`})
          app.mount(host)
          const actual = host.firstElementChild.style.getPropertyValue('--tokens').trim()
          const color = host.firstElementChild.style.color
          result.push({mode: 'browser-' + mode, value, expected, nativeRejectedCustomFunction, actual, color, pass: actual === expected && color === 'red'})
          app.unmount()
          host.remove()
        }
        const host = document.createElement('main')
        document.body.append(host)
        const state = Vue.ref('--tokens: initial; color: blue')
        const app = Vue.createApp({render: () => Vue.h('div', {style: [state.value]})})
        app.mount(host)
        native.setProperty('--tokens', 'initial')
        native.setProperty('--tokens', value)
        const expectedUpdate = native.getPropertyValue('--tokens').trim()
        state.value = style
        await Vue.nextTick()
        const actual = host.firstElementChild.style.getPropertyValue('--tokens').trim()
        const color = host.firstElementChild.style.color
        result.push({mode:'browser-update', value, expected:expectedUpdate, nativeRejectedCustomFunction, actual, color, pass: actual === expectedUpdate && color === 'red'})
        app.unmount()
        host.remove()
      }
      return result
    }, {values}))
  } finally { await browser.close() }
  report.passed = report.results.filter(x=>x.pass).length
  report.total = report.results.length
  fs.writeFileSync(path.join(consumer, 'proof-native-result.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({passed:report.passed,total:report.total}))
  if(report.passed !== report.total) process.exitCode = 1
})().catch(error=>{console.error(error);process.exitCode=1})
