const path = require("path");
const fs = require("fs");
const REQUIRE_PATH_TEST = /\.txt$/;

/* eslint-disable no-underscore-dangle */

/**
 * Node will load all matched files as raw strings
 *
 * @param {RegExp} pathMatcher
 */
function register(pathMatcher = REQUIRE_PATH_TEST) {
  const Module = require("module");
  const orginalLoad = Module._load;
  const cwd = process.cwd();
  Module._load = function (request, _parent) {
    if (request.match(pathMatcher)) {
      return fs.readFileSync(path.join(path.dirname(_parent ? _parent.filename : cwd), request), "utf8");
    }
    return orginalLoad.apply(this, arguments);
  };

  return () => {
    Module._load = orginalLoad;
  };
}

module.exports = {
  register,
};
