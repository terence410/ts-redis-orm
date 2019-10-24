"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs = __importStar(require("fs"));
var path = __importStar(require("path"));
var ConfigLoader = /** @class */ (function () {
    function ConfigLoader() {
    }
    ConfigLoader.prototype.getConfigFile = function () {
        var name = process.env.NODE_ENV || "default";
        var configFiles = ["redisorm.default.json"];
        if (process.env.NODE_ENV) {
            configFiles.push("redisorm." + name + ".json");
        }
        if (process.env.REDISORM_CONFIG_PATH) {
            configFiles = [process.env.REDISORM_CONFIG_PATH];
        }
        for (var _i = 0, configFiles_1 = configFiles; _i < configFiles_1.length; _i++) {
            var configFile = configFiles_1[_i];
            try {
                var result = fs.accessSync(configFile, fs.constants.F_OK);
                return path.join(process.cwd(), configFile);
            }
            catch (err) {
                //
            }
        }
        return null;
    };
    return ConfigLoader;
}());
exports.configLoader = new ConfigLoader();
