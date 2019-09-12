import * as fs from "fs";
import IORedis from "ioredis";
import * as path from "path";
import {configLoader} from "./configLoader";
import {RedisOrmDecoratorError} from "./errors/RedisOrmDecoratorError";
import {RedisOrmSchemaError} from "./errors/RedisOrmSchemaError";
import {IEntityMeta, IRedisContainer, ISchema} from "./types";

const IOREDIS_ERROR_RETRY_DELAY = 1000;
const IOREDIS_CONNECT_TIMEOUT = 10000;
const IOREDIS_REIGSTER_LUA_DELAY = 100;
const CONFIG_FILE = "redisorm.default.json";

class MetaInstance {
    private _entityMetas = new Map<object, IEntityMeta>();
    private _entitySchemas = new Map<object, {[key: string]: ISchema}>();

    // region public methods: set
    
    public addEntity(target: object, entityMeta: IEntityMeta) {
        if (!this._entityMetas.has(target)) {
            this._entityMetas.set(target, entityMeta);
        }
    }

    public addColumn(target: object, column: string, schema: ISchema) {
        let schemas = this._entitySchemas.get(target);
        if (!schemas) {
            schemas = {};
            this._entitySchemas.set(target, schemas);
        }
        schemas[column] = schema;
    }

    // endregion
    
    // region public methods: get

    public getConnectionConfig(target: object): any {
        const connection = this.getConnection(target);
        const configFile = configLoader.getConfigFile();

        if (!configFile) {
            throw new RedisOrmDecoratorError(
                `Config file not found. Please create redisorm.default.json in the project root folder.`);
        }

        const rawData = fs.readFileSync(configFile);
        const connectionConfigs = JSON.parse(rawData.toString());
        if (!(connection in connectionConfigs)) {
            throw new RedisOrmDecoratorError(
                `Invalid connection: ${connection}. Please check ${configFile}`);
        }

        // add retry add retry strategy if needed to trigger connect error
        const connectionConfig = connectionConfigs[connection];
        const maxConnectRetry = connectionConfig.maxConnectRetry;
        if (maxConnectRetry) {
            const connectTimeout = connectionConfig.connectTimeout || IOREDIS_CONNECT_TIMEOUT;
            connectionConfig.retryStrategy = (times: number) => {
                return times > maxConnectRetry ? null : IOREDIS_ERROR_RETRY_DELAY;
            };
        }

        return connectionConfig;
    }

    public getEntityMeta(target: object): IEntityMeta {
        return this._entityMetas.get(target) as IEntityMeta;
    }

    public getTable(target: object): string {
        return this.getEntityMeta(target).table;
    }

    public getConnection(target: object): string {
        return this.getEntityMeta(target).connection;
    }

    public getPrimaryKeys(target: object): string[] {
        const schemas = this.getSchemas(target);
        return Object.entries(schemas).filter(x => x[1].primary).map(x => x[0]);
    }

    public getAutoIncrementKey(target: object): string {
        const schemas = this.getSchemas(target);
        const filteredSchemas = Object.entries(schemas).find(x => x[1].autoIncrement);
        return filteredSchemas ? filteredSchemas[0] : "";
    }

    public getIndexKeys(target: object): string[] {
        const schemas = this.getSchemas(target);
        return Object.entries(schemas).filter(x => x[1].index).map(x => x[0]);
    }

    public getUniqueKeys(target: object): string[] {
        const schemas = this.getSchemas(target);
        return Object.entries(schemas).filter(x => x[1].unique).map(x => x[0]);
    }

    public getSchemas(target: object): {[key: string]: ISchema} {
        return this._entitySchemas.get(target) || {};
    }

    public getSchema(target: object, column: string): ISchema {
        const schemas = this.getSchemas(target);
        return schemas[column];
    }

    public getColumns(target: object): string[] {
        const schemas = this._entitySchemas.get(target) || {};
        return Object.keys(schemas);
    }

    public convertAsEntityId(target: object, idObject: {[key: string]: any} | string | number): string | undefined {
        const primaryKeys = this.getPrimaryKeys(target).sort();
        if (typeof idObject === "string") {
            return idObject;

        } else if (typeof idObject === "number") {
            return idObject.toString();

        } else if (typeof idObject === "object") {
            return primaryKeys
                .map(column => idObject[column].toString().replace(/:/g, ""))
                .join(":");
        }
    }

    // endregion

    // region public methods: conditions

    public isIndexKey(target: object, column: string) {
        const keys = this.getIndexKeys(target);
        return keys.includes(column);
    }

    public isValidColumn(target: object, column: string) {
        const keys = metaInstance.getColumns(target);
        return keys.includes(column);
    }

    public isSearchableColumn(target: object, column: string) {
        const schemas = metaInstance.getSchemas(target);
        return (column in schemas && [String, Number, Date, Boolean].includes(schemas[column].type));
    }

    public isUniqueKey(target: object, column: string) {
        const keys = metaInstance.getUniqueKeys(target);
        return keys.includes(column);
    }

    public isPrimaryKey(target: object, column: string) {
        const keys = metaInstance.getPrimaryKeys(target);
        return keys.includes(column);
    }

    public isSortableColumn(target: object, column: string): boolean {
        const schema = metaInstance.getSchema(target, column);
        return schema.type === Number || schema.type === Boolean || schema.type === Date;
    }

    public isNumberColumn(target: object, column: string) {
        const schema = metaInstance.getSchema(target, column);
        return schema.type === Number;
    }

    public isDateColumn(target: object, column: string) {
        const schema = metaInstance.getSchema(target, column);
        return schema.type === Date;
    }

    // endregion

    // region redis

    public async getRedis(target: object, connectRedis: boolean = true): Promise<IORedis.Redis> {
        const entityMeta = this.getEntityMeta(target);
        let redisContainer = entityMeta.redisMaster;
        if (!redisContainer) {
            const connectionConfig = this.getConnectionConfig(target);
            redisContainer = {
                redis: new IORedis(connectionConfig),
                connecting: false,
                ready: false,
                schemaErrors: [],
                error: null,
            };
            entityMeta.redisMaster = redisContainer;
        }

        if (connectRedis) {
            await this._connectRedis(target, redisContainer);

            if (redisContainer.schemaErrors.length > 0) {
                throw new RedisOrmSchemaError(
                    `Connect Errors. Please check the property "errors" for details. ' + 
                    'You can use resyncSchema() to resync the latest schema to remote host.`,
                    redisContainer.schemaErrors);
            }

            // throw the error repeatly for anything happend inside connectRedis
            if (redisContainer.error) {
               throw redisContainer.error;
            }
        }

        return redisContainer.redis;
    }

    public async resyncSchema(target: object) {
        const schemas = this.getSchemas(target);
        const clientSchemasJson = JSON.stringify(schemas, schemaJsonReplacer);
        const metaStorageKey = this.getMetaStorageKey(target);
        const hashKey = "schemas";

        // force update schema
        const redis = await this.getRedis(target, false);
        await redis.hset(metaStorageKey, hashKey, clientSchemasJson);
    }

    // endregion

    // region public methods: storage key

    public getEntityStorageKey(target: object, entityId: string) {
        return `entity:${this.getTable(target)}:${entityId}`;
    }

    public getIndexStorageKey(target: object, column: string) {
        return `index:${this.getTable(target)}:${column}`;
    }

    public getUniqueStorageKey(target: object, column: string) {
        return `unique:${this.getTable(target)}:${column}`;
    }

    public getMetaStorageKey(target: object) {
        return `meta:${this.getTable(target)}`;
    }

    // endregion

    // region private methods

    private async _connectRedis(target: object, redisContainer: IRedisContainer) {
        // allow multiple call to registerLua for same model if it's not completed registering yet
        while (redisContainer.connecting) {
            await new Promise(resolve => setTimeout(resolve, IOREDIS_REIGSTER_LUA_DELAY));
        }

        if (!redisContainer.ready) {
            redisContainer.connecting = true;

            // register lua
            try {
                await this._registerLau(target, redisContainer);

                // check schemas
                redisContainer.schemaErrors = await this._checkSchemas(target, redisContainer);
            } catch (err) {
                redisContainer.error = err;
            }

            redisContainer.ready = true;
            redisContainer.connecting = false;
        }
    }
    
    private async _checkSchemas(target: object, redisContainer: IRedisContainer): Promise<string[]> {
        let errors: string[] = [];
        const schemas = this.getSchemas(target);
        const clientSchemasJson = JSON.stringify(schemas, schemaJsonReplacer);

        const metaStorageKey = this.getMetaStorageKey(target);
        const hashKey = "schemas";
        try {
            const remoteSchemasString = await redisContainer.redis.hget(metaStorageKey, hashKey);
            if (!remoteSchemasString) {
                // if we didn't have remove column metas, save it
                await redisContainer.redis.hset(metaStorageKey, hashKey, clientSchemasJson);
            } else {
                const remoteSchemas = JSON.parse(remoteSchemasString);
                const clientSchemas = JSON.parse(clientSchemasJson);
                errors = this._validateSchemas(clientSchemas, remoteSchemas);
            }

        } catch (err) {
            // just throw directly
            throw err;
        }

        return errors;
    }

    private async _registerLau(target: object, redisContainer: IRedisContainer) {
        try {
            const luaShared = fs.readFileSync(path.join(__dirname, "../lua/shared.lua"), {encoding: "utf8"});

            const lua1 = fs.readFileSync(path.join(__dirname, "../lua/atomicRebuildIndex.lua"), {encoding: "utf8"});
            await redisContainer.redis.defineCommand("commandAtomicRebuildIndex",
                {numberOfKeys: 0, lua: luaShared + lua1});

            const lua2 = fs.readFileSync(path.join(__dirname, "../lua/mixedQuery.lua"), {encoding: "utf8"});
            await redisContainer.redis.defineCommand("commandMixedQuery",
                {numberOfKeys: 0, lua: luaShared + lua2});

            const lua3 = fs.readFileSync(path.join(__dirname, "../lua/atomicSave.lua"), {encoding: "utf8"});
            await redisContainer.redis.defineCommand("commandAtomicSave",
                {numberOfKeys: 0, lua: luaShared + lua3});

            const lua4 = fs.readFileSync(path.join(__dirname, "../lua/atomicDelete.lua"), {encoding: "utf8"});
            await redisContainer.redis.defineCommand("commandAtomicDelete",
                {numberOfKeys: 0, lua: luaShared + lua4});

            const lua5 = fs.readFileSync(path.join(__dirname, "../lua/atomicTruncate.lua"), {encoding: "utf8"});
            await redisContainer.redis.defineCommand("commandAtomicTruncate",
                {numberOfKeys: 0, lua: luaShared + lua5});

        } catch (err) {
            // just throw directly
            throw err;
        }
    }

    private _validateSchemas(clientSchemas: {[key: string]: any}, remoteSchemas: {[key: string]: any}): string[] {
        const errors: string[] = [];

        // check remote schemas has all keys in client schemas
        for (const column of Object.keys(clientSchemas)) {
            if (!(column in remoteSchemas)) {
                errors.push(`Column: ${column} does not exist in remote schemas`);
                continue;
            }

            const clientSchema = clientSchemas[column] as ISchema;
            const remoteSchema = remoteSchemas[column] as ISchema;

            if (clientSchema.type !== remoteSchema.type) {
                // tslint:disable-next-line:max-line-length
                errors.push(`Column: ${column} has different type. The current type: ${clientSchema.type} is different with the remote type: ${remoteSchema.type} `);
            }

            if (clientSchema.index !== remoteSchema.index) {
                // tslint:disable-next-line:max-line-length
                errors.push(`Column: ${column} has different index. The current index: ${clientSchema.index} is different with the remote index: ${remoteSchema.index} `);
            }

            if (clientSchema.unique !== remoteSchema.unique) {
                // tslint:disable-next-line:max-line-length
                errors.push(`Column: ${column} has different unique. The current unique: ${clientSchema.unique} is different with the remote unique: ${remoteSchema.unique} `);
            }

            if (clientSchema.autoIncrement !== remoteSchema.autoIncrement) {
                // tslint:disable-next-line:max-line-length
                errors.push(`Column: ${column} has different autoIncrement. The current autoIncrement: ${clientSchema.autoIncrement} is different with the remote autoIncrement: ${remoteSchema.autoIncrement} `);
            }

            if (clientSchema.primary !== remoteSchema.primary) {
                // tslint:disable-next-line:max-line-length
                errors.push(`Column: ${column} has different primary. The current primary: ${clientSchema.primary} is different with the remote primary: ${remoteSchema.primary} `);
            }
        }

        // check client schemas has all keys in remote schemas
        for (const column of Object.keys(remoteSchemas)) {
            if (!(column in clientSchemas)) {
                errors.push(`Column: ${column} does not exist in client schemas`);
            }
        }

        return errors;
    }

    private async _openFile(file: string): Promise<string> {
        return new Promise((resolve, reject) => {
            fs.readFile(file, "utf8", (err, text) => {
                if (err)  {
                    return reject(err);
                } else {
                    resolve(text);
                }
            });
        });
    }

    // endregion
}

export const metaInstance = new MetaInstance();
export function schemaJsonReplacer(key: any, value: any) {
    if (key === "type" && [String, Number, Boolean, Date, Array, Object].includes(value)) {
        return value.name;
    }

    return value;
}
