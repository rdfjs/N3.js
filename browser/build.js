#!/usr/bin/env node

var fs = require('fs'),
    path = require('path'),
    spawn = require('child_process').spawn;

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
    destinationPath = path.join(__dirname, '../build/'),
    uglifyjsPath = path.join(__dirname, '../node_modules/uglify-js/bin/uglifyjs');
if (!fs.existsSync(destinationPath))
  fs.mkdirSync(destinationPath);

var scriptFile = destinationPath + 'n3-browser.js',
    minifiedFile = destinationPath + 'n3-browser.min.js',
    script = fs.createWriteStream(scriptFile, { encoding: 'utf8' });

// Add license information
script.write('/** @license MIT - N3.js library (browser version) - ©Ruben Verborgh */\n');

// Start main wrapping function
script.write('(function (N3) {\n');

// Shim for setImmediate
script.write('function setImmediate(f) { setTimeout(f, 0); }\n');

// Add modules
submodules.forEach(function (name) {
  var submodule = fs.readFileSync(sourcePath + 'N3' + name + '.js', { encoding: 'utf8' });
  // Remove imports
  submodule = submodule.replace(/(\w+)\s*=\s*require\([^)]+\)/g, '$1_Unused');
  // Replace exports by assignments on the N3 object
  submodule = submodule.replace(/module.exports/g, '\nN3.' + name);
  script.write(submodule);
});

// End and execute main wrapping function
script.write('})(typeof exports !== "undefined" ? exports : this.N3 = {});\n');
script.end(function () {
  console.log('browser version written to', scriptFile);
  // Write minified file
  var minifier = spawn('node',
                       [ uglifyjsPath, scriptFile, '--comments', '-m', '-c', '-o', minifiedFile ],
                       { stdio: 'inherit' });
  minifier.on('exit', function () {
    console.log('minified version written to', minifiedFile);
  });
});
