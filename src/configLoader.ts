import * as fs from "fs";
import * as path from "path";
import {RedisOrmOperationError} from "./errors/RedisOrmOperationError";

class ConfigLoader {
    public getConfigFile(): string {
        let configFiles = [`redisorm.default.json`];

        if (process.env.NODE_ENV) {
            const name = process.env.NODE_ENV || "default";
            configFiles.splice(0, 0, `redisorm.${name}.json`);
        }

        if (process.env.REDISORM_CONFIG_PATH) {
            configFiles = [process.env.REDISORM_CONFIG_PATH];
        }

        for (const configFile of configFiles) {
            try {
                const result = fs.accessSync(configFile, fs.constants.F_OK);
                return path.isAbsolute(configFile) ? configFile : path.join(process.cwd(), configFile);
            } catch (err) {
                //
            }
        }

        throw new RedisOrmOperationError(`Config file cannot not be found on the paths: ${configFiles.join(", ")}.`);
    }
}

export const configLoader = new ConfigLoader();
