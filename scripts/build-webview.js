const esbuild = require('esbuild');

const builds = [
    { entry: 'src/view/webview/app.ts', out: 'out/view/webview/app.bundle.js' },
    { entry: 'src/view/webview/cardApp.ts', out: 'out/view/webview/cardApp.bundle.js' },
    { entry: 'src/view/webview/knowledge.ts', out: 'out/view/webview/knowledge.bundle.js' },
    { entry: 'src/view/webview/device.ts', out: 'out/view/webview/device.bundle.js' },
];

Promise.all(builds.map(({ entry, out }) =>
    esbuild.build({
        entryPoints: [entry],
        bundle: true,
        outfile: out,
        format: 'iife',
        platform: 'browser',
        target: 'es2020',
        sourcemap: true,
        external: [],
    })
)).catch(() => process.exit(1));
