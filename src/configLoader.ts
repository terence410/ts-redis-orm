import * as fs from "fs";
import * as path from "path";

class ConfigLoader {
    public getConfigFile(): string | null {
        const name = process.env.node_env || "default";
        const configFiles = [`redisorm.default.json`];
        if (process.env.node_env) {
            configFiles.push(`redisorm.${name}.json`);
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
