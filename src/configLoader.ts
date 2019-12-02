import Debug from "debug";
import * as fs from "fs";
import * as path from "path";

const debug = Debug("redisorm/default");

class ConfigLoader {
    public getConfigFile(): string | null {
        let configFiles = [`redisorm.default.json`];

        if (process.env.NODE_ENV) {
            const name = process.env.NODE_ENV || "default";
            configFiles.splice(0, 0, `redisorm.${name}.json`);
        }

        if (process.env.REDISORM_CONFIG_PATH) {
            configFiles = [process.env.REDISORM_CONFIG_PATH];
        }

        for (const configFile of configFiles) {
            debug(`Check if config file exists: ${configFile}`);
            try {
                const result = fs.accessSync(configFile, fs.constants.F_OK);
                debug(`Config file exists: ${configFile}`);
                return path.join(process.cwd(), configFile);
            } catch (err) {
                //
            }
        }

        return null;
    }
}

export const configLoader = new ConfigLoader();
