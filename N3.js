// Expose the following N3 submodules lazily
[
  'Lexer',
  'Parser',
  'Writer',
  'Store',
  'StreamParser',
  'StreamWriter',
  'Util',
]
.forEach(function (submodule) {
  Object.defineProperty(exports, submodule, {
    configurable: true,
    enumerable: true,
    get: function () {
      delete exports[submodule];
      return exports[submodule] = require('./lib/N3' + submodule);
    },
  });
});
