const path = require('path');
process.env.NODE_ENV='development';

function resolve(dir) {
  return path.join(__dirname, '..', dir);
}

const webpackConfig = {
  entry: './index.js',
  output: {
    path: `${__dirname}/lib`,
    filename: 'index.js',
    publicPath: '/',
    libraryTarget: 'umd',
  },
  target: 'web',
  resolve: {
    extensions: ['.js', '.json'],
    modules: [resolve('vnd'), 'node_modules'],
  },
  module: {
    rules: [
      {
        test: /\.worker\.js$/,
        loader: 'worker-loader',
        include: [resolve('src'), resolve('test')],
        options: { inline: true, fallback: false },
      },
      {
        test: /\.js$/,
        loader: 'babel-loader',
        include: [resolve('src'), resolve('test')],
      },
      {
        loader: require.resolve('file-loader'),
        // Exclude `js` files to keep "css" loader working as it injects
        // it's runtime that would otherwise processed through "file" loader.
        // Also exclude `html` and `json` extensions so they get processed
        // by webpacks internal loaders.
        exclude: [/\.(js|jsx|mjs)$/, /\.html$/, /\.json$/],
        options: {},
      },
    ],
  },
};

module.exports = webpackConfig;
