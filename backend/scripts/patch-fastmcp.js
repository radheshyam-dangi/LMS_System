const fs = require('fs');
const path = require('path');

const targetPkgPath = path.join(__dirname, '../node_modules/@prefecthq/fastmcp-ts/package.json');

if (fs.existsSync(targetPkgPath)) {
  try {
    const pkg = JSON.parse(fs.readFileSync(targetPkgPath, 'utf8'));
    let modified = false;

    if (pkg.exports && pkg.exports['./server'] && !pkg.exports['./server'].default) {
      pkg.exports['./server'].default = './dist/server.js';
      modified = true;
    }

    if (pkg.exports && pkg.exports['./client'] && !pkg.exports['./client'].default) {
      pkg.exports['./client'].default = './dist/client.js';
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(targetPkgPath, JSON.stringify(pkg, null, 2) + '\n');
      console.log('Successfully patched @prefecthq/fastmcp-ts exports for CommonJS/Node compatibility.');
    }
  } catch (err) {
    console.error('Failed to patch @prefecthq/fastmcp-ts:', err);
  }
}

