import * as fs from "fs";
import IORedis from "ioredis";
import * as path from "path";
import {configLoader} from "./configLoader";
import {RedisOrmDecoratorError} from "./errors/RedisOrmDecoratorError";
import {RedisOrmQueryError} from "./errors/RedisOrmQueryError";
import {RedisOrmSchemaError} from "./errors/RedisOrmSchemaError";
import {IEntityMeta, IRedisContainer, ISchema} from "./types";

const IOREDIS_ERROR_RETRY_DELAY = 1000;
const IOREDIS_CONNECT_TIMEOUT = 10000;
const IOREDIS_REIGSTER_LUA_DELAY = 100;
const CONFIG_FILE = "redisorm.default.json";

class MetaInstance {
    private _entityMetas = new Map<object, IEntityMeta>();
    private _entitySchemas = new Map<object, {[key: string]: ISchema}>();
    private _entitySchemasJsons = new Map<object, string>(); // cache for faster JSON.stringify

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

    public getSchemasJson(target: object): string {
        if (!this._entitySchemasJsons.has(target)) {
            const schemas = this.getSchemas(target);
            const keys = Object.keys(schemas).sort();
            const sortedSchemas = keys.reduce((a: any, b) => Object.assign(a, {[b]: schemas[b]}), {});
            this._entitySchemasJsons.set(target, JSON.stringify(sortedSchemas, schemaJsonReplacer));
        }

        return this._entitySchemasJsons.get(target) as string;
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
            if (!primaryKeys.every(column => column in idObject)) {
                throw new RedisOrmQueryError(`Invalid id ${JSON.stringify(idObject)}`);
            }

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

    public async getRedis(target: object, registerRedis: boolean = true): Promise<IORedis.Redis> {
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

        if (registerRedis) {
            await this._registerRedis(target, redisContainer);

            // if (checkSchemaError) {
            //     if (redisContainer.schemaErrors.length > 0) {
            //         throw new RedisOrmSchemaError(
            //             `Schema Error. Please check err.errors for details. ` +
            //             `You can use resyncSchema() to resync the latest schema to remote host.`,
            //             redisContainer.schemaErrors);
            //     }
            //
            //     // throw the error repeatly for anything happened inside connectRedis
            //     if (redisContainer.error) {
            //         throw redisContainer.error;
            //     }
            // }
        }

        return redisContainer.redis;
    }

    public async compareSchemas(target: object): Promise<string[]> {
        const redis = await metaInstance.getRedis(target);
        let errors: string[] = [];

        try {
            const remoteSchemas = await this.getRemoteSchemas(target, redis);
            if (remoteSchemas) {
                // we do such indirect case is to convert primitive types to strings
                const clientSchemasJson = this.getSchemasJson(target);
                const clientSchemas = JSON.parse(clientSchemasJson);
                errors = this._validateSchemas(clientSchemas, remoteSchemas);
            }
        } catch (err) {
            // just throw directly
            throw err;
        }

        return errors;
    }

    public async getRemoteSchemas(target: object, redis: IORedis.Redis): Promise<{[key: string]: ISchema} | null> {
        const metaStorageKey = this.getMetaStorageKey(target);
        const hashKey = "schemas";
        const remoteSchemasString = await redis.hget(metaStorageKey, hashKey);
        if (remoteSchemasString) {
            return JSON.parse(remoteSchemasString);
        }

        return null;
    }

    public async resyncDb(target: object) {
        const clientSchemasJson = this.getSchemasJson(target);
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

    private async _registerRedis(target: object, redisContainer: IRedisContainer) {
        // allow multiple call to registerLua for same model if it's not completed registering yet
        while (redisContainer.connecting) {
            await new Promise(resolve => setTimeout(resolve, IOREDIS_REIGSTER_LUA_DELAY));
        }

        if (!redisContainer.ready) {
            redisContainer.connecting = true;

            // register lua
            try {
                await this._registerLau(target, redisContainer);
            } catch (err) {
                redisContainer.error = err;
            }

            redisContainer.ready = true;
            redisContainer.connecting = false;
        }
    }
    
    private async _registerLau(target: object, redisContainer: IRedisContainer) {
        try {
            const luaShared = fs.readFileSync(path.join(__dirname, "../lua/shared.lua"), {encoding: "utf8"});

            const lua1 = fs.readFileSync(path.join(__dirname, "../lua/atomicResyncDb.lua"), {encoding: "utf8"});
            await redisContainer.redis.defineCommand("commandAtomicResyncDb",
                {numberOfKeys: 0, lua: luaShared + lua1});

            const lua2 = fs.readFileSync(path.join(__dirname, "../lua/atomicMixedQuery.lua"), {encoding: "utf8"});
            await redisContainer.redis.defineCommand("commandAtomicMixedQuery",
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
                errors.push(`Incompatible type on column: ${column}, current value: ${clientSchema.type}, remove value: ${remoteSchema.type}`);
            }

            if (clientSchema.index !== remoteSchema.index) {
                // tslint:disable-next-line:max-line-length
                errors.push(`Incompatible index on column: ${column}, current value: ${clientSchema.index}, remove value: ${remoteSchema.index}`);
            }

            if (clientSchema.unique !== remoteSchema.unique) {
                // tslint:disable-next-line:max-line-length
                errors.push(`Incompatible unique on column: ${column}, current value: ${clientSchema.unique}, remove value: ${remoteSchema.unique}`);
            }

            if (clientSchema.autoIncrement !== remoteSchema.autoIncrement) {
                // tslint:disable-next-line:max-line-length
                errors.push(`Incompatible autoIncrement on column: ${column}, current value: ${clientSchema.autoIncrement}, remove value: ${remoteSchema.autoIncrement}`);
            }

            if (clientSchema.primary !== remoteSchema.primary) {
                // tslint:disable-next-line:max-line-length
                errors.push(`Incompatible primary on column: ${column}, current value: ${clientSchema.primary}, remove value: ${remoteSchema.primary}`);
            }
        }

        // check client schemas has all keys in remote schemas
        for (const column of Object.keys(remoteSchemas)) {
            if (!(column in clientSchemas)) {
                errors.push(`Column: ${column} does not exist in current schemas`);
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
