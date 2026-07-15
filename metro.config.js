const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react-native-gesture-handler") {
    return {
      filePath: path.resolve(
        __dirname,
        "node_modules/react-native-gesture-handler/lib/commonjs/index.js",
      ),
      type: "sourceFile",
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
