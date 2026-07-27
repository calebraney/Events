import * as esbuild from 'esbuild';
//configure dev server & Directory
const BUILD_DIRECTORY = 'dist';
const PRODUCTION = process.env.NODE_ENV === 'production';
// Config dev server
const LIVE_RELOAD = !PRODUCTION;
const SERVE_PORT = 3000;
const SERVE_ORIGIN = `http://localhost:${SERVE_PORT}`;

const context = await esbuild.context({
  bundle: true,
  entryPoints: ['src/index.js'],
  outdir: BUILD_DIRECTORY,
  minify: PRODUCTION,
  // sourcemap: !PRODUCTION, //Creates a map of the source files for debugging
  target: PRODUCTION ? 'es2020' : 'esnext',
  inject: LIVE_RELOAD ? ['./bin/live-reload.js'] : undefined,
});

//watch the file
await context.watch();
await context
  .serve({
    servedir: BUILD_DIRECTORY,
    port: SERVE_PORT,
  })
  .then(() => {
    //log to console
    console.log(`${SERVE_ORIGIN}/index.js`);
  });
