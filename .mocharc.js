'use strict';

// Here's a JavaScript-based config file.
// If you need conditional logic, you might want to use this type of config.
// Otherwise, JSON or YAML is recommended.

module.exports = {
  slow: 200,
  timeout: 60 * 1000,
  exit: true,
  require: "ts-node/register/transpile-only",
};
