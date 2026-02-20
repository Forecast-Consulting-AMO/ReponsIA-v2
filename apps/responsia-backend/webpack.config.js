const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const nodeExternals = require('webpack-node-externals');
const { join } = require('path');

module.exports = (_, argv) => {
  const isProd = argv.mode === 'production';
  return {
    target: 'node',
    externals: [
      nodeExternals({
        modulesDir: join(__dirname, '../../node_modules'),
      }),
    ],
    output: {
      path: join(__dirname, '../../dist/apps/responsia-backend'),
    },
    plugins: [
      new NxAppWebpackPlugin({
        target: 'node',
        compiler: 'tsc',
        main: './src/main.ts',
        tsConfig: './tsconfig.app.json',
        optimization: false,
        outputHashing: 'none',
        generatePackageJson: true,
        sourceMap: !isProd,
      }),
    ],
    watchOptions: {
      poll: 1000,
    },
  };
};
