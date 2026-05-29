const esbuild = require('esbuild');

const builds = [
    { entry: 'src/kcodeView/webview/app.ts', out: 'out/kcodeView/webview/app.bundle.js' },
    { entry: 'src/kcodeView/webview/cardApp.ts', out: 'out/kcodeView/webview/cardApp.bundle.js' },
    { entry: 'src/kcodeView/webview/knowledge.ts', out: 'out/kcodeView/webview/knowledge.bundle.js' },
    { entry: 'src/kcodeView/webview/device.ts', out: 'out/kcodeView/webview/device.bundle.js' },
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
