#!/usr/bin/env node

var fs = require('fs'),
    path = require('path');

// Modules to be included in the browser version
var submodules = [
  'Lexer',
  'Parser',
  'Writer',
  'Store',
  'Util',
]

// Set up paths
var sourcePath = path.join(__dirname, '../lib/'),
    destinationPath = path.join(__dirname, '../build/');
if (!fs.existsSync(destinationPath))
  fs.mkdirSync(destinationPath);

var scriptFile = destinationPath + 'n3-browser.js',
    script = fs.createWriteStream(scriptFile, { encoding: 'utf8' });

// Start main wrapping function
script.write('(function (N3) {\n');

// Shim for process.nextTick
script.write('var process = { nextTick: function(f) { setTimeout(f, 0); } };\n');

// Add modules
submodules.forEach(function (name) {
  var submodule = fs.readFileSync(sourcePath + 'N3' + name + '.js', { encoding: 'utf8' });
  // Remove imports
  submodule = submodule.replace(/(\w+)\s*=\s*require\([^)]+\)/g, '$1unused');
  // Replace exports by assignments on the N3 object
  submodule = submodule.replace(/module.exports/g, '\nN3.' + name);
  script.write(submodule);
});

// End and execute main wrapping function
script.write('})(typeof exports !== "undefined" ? exports : this.N3 = {});\n');
script.end();
console.log('browser version written to', scriptFile);
