const config = require('flarum-webpack-config');

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
module.exports = Object.assign({}, base, { externals });

