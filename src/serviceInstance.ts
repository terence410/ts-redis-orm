import Debug from "debug";
import * as fs from "fs";
import IORedis from "ioredis";
import * as path from "path";
import {configLoader} from "./configLoader";
import {RedisOrmDecoratorError} from "./errors/RedisOrmDecoratorError";
import {RedisOrmQueryError} from "./errors/RedisOrmQueryError";
import {IEntityMeta, IRedisContainer, ISchema, ISchemas} from "./types";

const debug = Debug("tsredisorm/default");

const IOREDIS_ERROR_RETRY_DELAY = 1000;
const IOREDIS_CONNECT_TIMEOUT = 10000;
const IOREDIS_REIGSTER_LUA_DELAY = 100;

class ServiceInstance {
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
        return this.getConnectionConfigByConnection(connection);
    }

    public getConnectionConfigByConnection(connection: string): any {
        const configFile = configLoader.getConfigFile();

        if (!configFile) {
            throw new RedisOrmDecoratorError(`Config file not found. Please create redisorm.default.json in the project root folder.`);
        }

        const rawData = fs.readFileSync(configFile);
        const connectionConfigs = JSON.parse(rawData.toString());
        if (!(connection in connectionConfigs)) {
            throw new RedisOrmDecoratorError(`Invalid connection: ${connection}. Please check ${configFile}`);
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

    public getDefaultTable(target: object): string {
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
        if (idObject === null || idObject === undefined) {
            throw new RedisOrmQueryError(`(${(target as any).name}) Invalid id: ${idObject}`);

        } else if (typeof idObject === "string") {
            return idObject;

        } else if (typeof idObject === "number") {
            return idObject.toString();

        } else if (typeof idObject === "object") {
            if (!primaryKeys.every(column => column in idObject)) {
                throw new RedisOrmQueryError(`(${(target as any).name}) Invalid id ${JSON.stringify(idObject)}`);
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
        const keys = serviceInstance.getColumns(target);
        return keys.includes(column);
    }

    public isSearchableColumn(target: object, column: string) {
        const schemas = serviceInstance.getSchemas(target);
        return (column in schemas && [String, Number, Date, Boolean].includes(schemas[column].type));
    }

    public isUniqueKey(target: object, column: string) {
        const keys = serviceInstance.getUniqueKeys(target);
        return keys.includes(column);
    }

    public isPrimaryKey(target: object, column: string) {
        const keys = serviceInstance.getPrimaryKeys(target);
        return keys.includes(column);
    }

    public isSortableColumn(target: object, column: string): boolean {
        const schema = serviceInstance.getSchema(target, column);
        return schema.type === Number || schema.type === Boolean || schema.type === Date;
    }

    public isNumberColumn(target: object, column: string) {
        const schema = serviceInstance.getSchema(target, column);
        return schema.type === Number;
    }

    public isDateColumn(target: object, column: string) {
        const schema = serviceInstance.getSchema(target, column);
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

            debug(`(${(target as any).name}) created redis connection`);
        }

        if (registerRedis) {
            await this._registerLuaLock(target, redisContainer);
        }

        return redisContainer.redis;
    }

    public async compareSchemas(target: object, table: string): Promise<string[]> {
        let errors: string[] = [];

        try {
            const remoteSchemas = await this.getRemoteSchemas(target, table);
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

    public async getRemoteSchemas(target: object, table: string): Promise<{[key: string]: ISchema} | null> {
        const redis = await serviceInstance.getRedis(target);
        const storageKey = this.getSchemasStorageKey();
        const remoteSchemasString = await redis.hget(storageKey, table);
        if (remoteSchemasString) {
            return JSON.parse(remoteSchemasString);
        }

        return null;
    }

    // endregion

    // region public methods: storage key

    public getEntityStorageKey(table: string, entityId: string) {
        return `entity:${table}:${entityId}`;
    }

    public getIndexStorageKey(table: string, column: string) {
        return `index:${table}:${column}`;
    }

    public getUniqueStorageKey(table: string, column: string) {
        return `unique:${table}:${column}`;
    }

    public getSchemasStorageKey() {
        return `meta:schemas`;
    }

    // endregion

    // region operations

    public getEntityTypes() {
        return [...this._entityMetas.keys()];
    }

    public async getRemoveSchemasList(connection: string = "default") {
        const schemasList: ISchemas = {};
        const connectionConfig = serviceInstance.getConnectionConfigByConnection(connection);
        if (connectionConfig) {
            const redis = new IORedis(connectionConfig);
            const storageKey = serviceInstance.getSchemasStorageKey();

            const result = await redis.hgetall(storageKey);
            for (const [table, schemasString] of Object.entries(result)) {
                schemasList[table] = JSON.parse(schemasString as string);
            }
        }

        return schemasList;
    }

    // endregion

    // region private methods

    private async _registerLuaLock(target: object, redisContainer: IRedisContainer) {
        // allow multiple call to registerLua for same model if it's not completed registering yet
        while (redisContainer.connecting) {
            await new Promise(resolve => setTimeout(resolve, IOREDIS_REIGSTER_LUA_DELAY));
        }

        if (!redisContainer.ready) {
            redisContainer.connecting = true;

            // register lua
            try {
                await this._registerLua(target, redisContainer);

                debug(`(${(target as any).name}) registered lua`);
            } catch (err) {
                redisContainer.error = err;
            }

            redisContainer.ready = true;
            redisContainer.connecting = false;
        }
    }
    
    private async _registerLua(target: object, redisContainer: IRedisContainer) {
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
                errors.push(`Incompatible type on column: ${column}, current value: ${clientSchema.type}, remove value: ${remoteSchema.type}`);
            }

            if (clientSchema.index !== remoteSchema.index) {
                errors.push(`Incompatible index on column: ${column}, current value: ${clientSchema.index}, remove value: ${remoteSchema.index}`);
            }

            if (clientSchema.unique !== remoteSchema.unique) {
                errors.push(`Incompatible unique on column: ${column}, current value: ${clientSchema.unique}, remove value: ${remoteSchema.unique}`);
            }

            if (clientSchema.autoIncrement !== remoteSchema.autoIncrement) {
                errors.push(`Incompatible autoIncrement on column: ${column}, current value: ${clientSchema.autoIncrement}, remove value: ${remoteSchema.autoIncrement}`);
            }

            if (clientSchema.primary !== remoteSchema.primary) {
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

export const serviceInstance = new ServiceInstance();
export function schemaJsonReplacer(key: any, value: any) {
    if (key === "type" && [String, Number, Boolean, Date, Array, Object].includes(value)) {
        return value.name;
    }

    return value;
}
