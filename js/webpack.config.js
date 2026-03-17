const config = require('flarum-webpack-config');
const webpack = require('webpack');

const base = config();

// Flarum 1.x: app is provided by the parent as global `app`. Run first so we
// override 2.0-style flarum.reg.get() and the bundle works on 1.8.x.
function flarumAppExternal(context, request, callback) {
  if (request === 'flarum/admin/app' || request === 'flarum/forum/app') {
    return callback(null, 'var app');
  }
  callback();
}
const externals = [flarumAppExternal].concat(base.externals || []);

// Flarum 1.x: prepend polyfill at the very start of forum.js so it runs before
// the webpack runtime (which expects flarum.reg._webpack_runtimes on 2.0).
const flarumRegPolyfill = '(function(){if(typeof window.flarum==="undefined")window.flarum={};if(typeof window.flarum.reg==="undefined")window.flarum.reg={};if(typeof window.flarum.reg._webpack_runtimes==="undefined")window.flarum.reg._webpack_runtimes={};})();';

class PrependForumPolyfillPlugin {
  apply(compiler) {
    compiler.hooks.compilation.tap('PrependForumPolyfillPlugin', (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: 'PrependForumPolyfillPlugin',
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE,
        },
        (assets) => {
          const name = Object.keys(assets).find((k) => k === 'forum.js' || k.endsWith('/forum.js'));
          if (!name) return;
          const asset = assets[name];
          if (!asset) return;
          const source = typeof asset.source === 'function' ? asset.source() : asset.source;
          const next = typeof source === 'string' ? source : source.toString();
          compilation.updateAsset(name, new (compilation.compiler.webpack.sources.RawSource || webpack.sources.RawSource)(flarumRegPolyfill + next));
        }
      );
    });
  }
}

const plugins = (base.plugins || []).concat([new PrependForumPolyfillPlugin()]);

module.exports = Object.assign({}, base, { externals, plugins });

