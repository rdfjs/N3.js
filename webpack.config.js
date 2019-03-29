const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const webpack = require("webpack");

/*
TODO: Make webpack assign "./N3.js"'s exports to the global name `N3`,
      analogous to browserify's `-s N3` command line argument. `N3-webpack.js`
      is a hack to get the same effect. Using "./N3.js" directly results in all
      of it's members being assigned to window (window.DataFactory, etc):
      `for(var i in a) (typeof exports === 'object' ? exports : root)[i] = a[i];`
 */

module.exports = {
  entry: {
    "n3-webpack": "./N3-webpack.js",
    "n3-webpack.min": "./N3-webpack.js",
  },
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, 'browser'),
    // libraryTarget: 'umd',
    // libraryExport: 'N3',
    // umdNamedDefine: true,
    // // globalObject: 'this'
  },
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin({
      include: /\.min\.js$/
    })]
  }
};
