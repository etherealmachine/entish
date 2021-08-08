const path = require("path");
const nodeExternals = require("webpack-node-externals");

const entry = { entmoot: "./src/entmoot.ts" };

module.exports = {
  mode: process.env.NODE_ENV ? process.env.NODE_ENV : "development",
  target: "node",
  devtool: "inline-source-map",
  entry: entry,
  output: {
    path: path.resolve(__dirname, "build"),
    filename: "[name].js",
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".peg", ".ent", ".md"],
  },
  // don't compile node_modules
  externals: [nodeExternals()],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: "ts-loader",
            options: {
              configFile: "tsconfig.json",
              compilerOptions: {
                noEmit: false
              }
            },
          },
        ],
      },
      {
        test: /\.(peg|ent|md)$/,
        use: 'raw-loader',
      },
    ],
  },
};

