const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');
const path = require('path');
const fs = require('fs');

// Load .env file into process.env (if it exists)
require('dotenv').config();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

module.exports = (env, argv) => {
  const mode = argv.mode || 'development';
  const isProd = mode === 'production';

  // BBB version for multi-version support (3.0 or 3.1)
  const bbbVersion = process.env.BBB_VERSION || '3.1';
  const outputDir = isProd ? `dist-${bbbVersion}` : 'dist';
  const manifestSuffix = isProd ? 'prod' : 'dev';

  // Docker builds keep placeholders, replaced by entrypoint.sh at container startup
  const useRuntimeConfig = process.env.USE_RUNTIME_CONFIG === 'true';

  console.log(`📦 BBB Version: ${bbbVersion}`);
  console.log(`📂 Output directory: ${outputDir}`);

  // API URL configuration:
  // - Docker builds: placeholder (replaced at container startup)
  // - Direct builds: FLOWLY_API_URL, or localhost in development
  let apiUrl;
  if (useRuntimeConfig) {
    apiUrl = '__FLOWLY_API_URL__';
    console.log('Build mode:', mode, '(Docker - runtime config)');
  } else {
    apiUrl =
      process.env.FLOWLY_API_URL || (isProd ? '__FLOWLY_API_URL__' : 'http://localhost:3000');
    console.log('Build mode:', mode);
    console.log('Using API URL:', apiUrl);
  }

  // Plugin URL written into production manifests (kept as placeholder for Docker builds)
  const pluginUrl = useRuntimeConfig ? null : process.env.FLOWLY_PLUGIN_URL;

  const certKey = path.join(__dirname, 'certs', 'key.pem');
  const certChain = path.join(__dirname, 'certs', 'cert.pem');
  const hasCerts = fs.existsSync(certKey) && fs.existsSync(certChain);

  return {
    mode,
    entry: './src/index.tsx',
    output: {
      path: path.resolve(__dirname, outputDir),
      filename: 'FlowlyWebIntegration.js',
      library: 'FlowlyWebIntegration',
      libraryTarget: 'umd',
      publicPath: '/',
      globalObject: 'this',
    },
    optimization: {
      minimize: false,
    },
    watchOptions: {
      poll: 1000,
      ignored: /node_modules/,
    },
    devServer: {
      allowedHosts: 'all',
      port: 4701,
      host: '0.0.0.0',
      hot: true,
      liveReload: true,
      // Optional HTTPS: drop key.pem and cert.pem into ./certs
      server: hasCerts
        ? {
            type: 'https',
            options: {
              key: fs.readFileSync(certKey),
              cert: fs.readFileSync(certChain),
            },
          }
        : 'http',
      client: {
        overlay: false,
      },
      headers: CORS_HEADERS,
      onListening: () => {
        const protocol = hasCerts ? 'https' : 'http';
        console.log(`\n🚀 Dev server running on ${protocol}://0.0.0.0:4701`);
        console.log(`🌐 BBB 3.0: ${protocol}://localhost:4701/3.0/manifest.json`);
        console.log(`🌐 BBB 3.1: ${protocol}://localhost:4701/3.1/manifest.json\n`);
      },
      setupMiddlewares: (middlewares, devServer) => {
        if (!devServer) {
          throw new Error('webpack-dev-server is not defined');
        }

        const sendManifest = (version) => (req, res) => {
          res.set({ 'Content-Type': 'application/json', ...CORS_HEADERS });
          res.sendFile(path.resolve(__dirname, 'manifests', `manifest.${version}.dev.json`));
        };

        // The dev bundle is the same for both BBB versions
        const sendBundle = (req, res) => {
          res.set({ 'Content-Type': 'application/javascript', ...CORS_HEADERS });
          res.sendFile(path.resolve(__dirname, 'dist', 'FlowlyWebIntegration.js'));
        };

        devServer.app.get('/manifest.json', sendManifest('3.1'));
        devServer.app.get('/3.0/manifest.json', sendManifest('3.0'));
        devServer.app.get('/3.1/manifest.json', sendManifest('3.1'));
        devServer.app.get('/3.0/FlowlyWebIntegration.js', sendBundle);
        devServer.app.get('/3.1/FlowlyWebIntegration.js', sendBundle);

        // CORS preflight
        devServer.app.options('*', (req, res) => {
          res.set(CORS_HEADERS);
          res.status(200).end();
        });

        return middlewares;
      },
      static: [
        {
          directory: path.join(__dirname, 'dist'),
          serveIndex: true,
          watch: true,
        },
      ],
    },
    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
          },
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: ['.js', '.jsx', '.tsx', '.ts'],
    },
    plugins: [
      new CopyWebpackPlugin({
        patterns: [
          {
            from: `manifests/manifest.${bbbVersion}.${manifestSuffix}.json`,
            to: 'manifest.json',
            transform: (content) =>
              pluginUrl
                ? content.toString().replace(/__FLOWLY_PLUGIN_URL__/g, pluginUrl.replace(/\/$/, ''))
                : content,
          },
        ],
      }),
      new webpack.DefinePlugin({
        FLOWLY_API_URL: JSON.stringify(apiUrl),
        NODE_ENV: JSON.stringify(mode),
        GIPHY_API_KEY: JSON.stringify(process.env.GIPHY_API_KEY || ''),
      }),
    ],
  };
};
