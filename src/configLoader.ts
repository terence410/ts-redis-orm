import * as fs from "fs";
import * as path from "path";

class ConfigLoader {
    public getConfigFile(): string | null {
        const name = process.env.NODE_ENV || "default";
        let configFiles = [`redisorm.default.json`];

        if (process.env.NODE_ENV) {
            configFiles.push(`redisorm.${name}.json`);
        }

        if (process.env.REDISORM_CONFIG_PATH) {
            configFiles = [process.env.REDISORM_CONFIG_PATH];
        }

        for (const configFile of configFiles) {
            try {
                const result = fs.accessSync(configFile, fs.constants.F_OK);
                return path.join(process.cwd(), configFile);
            } catch (err) {
                //
            }
        }

        return null;
    }
}

export const configLoader = new ConfigLoader();
