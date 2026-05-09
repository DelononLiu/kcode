const esbuild = require('esbuild');

esbuild.build({
    entryPoints: ['src/kcodeView/webview/app.ts'],
    bundle: true,
    outfile: 'out/kcodeView/webview/app.bundle.js',
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    sourcemap: true,
    external: [],
}).catch(() => process.exit(1));
