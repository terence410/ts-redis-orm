import * as fs from "fs";
import IORedis from "ioredis";
import * as path from "path";
import {configLoader} from "./configLoader";
import {RedisOrmDecoratorError} from "./errors/RedisOrmDecoratorError";
import {PerformanceHelper} from "./helpers/PerformanceHelper";
import {ConnectionConfig, IEntityColumn, IEntityColumns, IEntityMeta, IIdType, IRedisContainer} from "./types";

const IOREDIS_ERROR_RETRY_DELAY = 1000;
const IOREDIS_CONNECT_TIMEOUT = 10000;
const IOREDIS_REIGSTER_LUA_DELAY = 100;

// Notes: Schemas is similar to entitySchemas, schemas refers to entire table structure while entityColumns refer to decorator structure
class RedisOrm {
    private _entityMetas = new Map<object, IEntityMeta>();
    private _entityColumns = new Map<object, {[key: string]: IEntityColumn}>();
    private _entitySchemasJsons = new Map<object, string>(); // cache for faster JSON.stringify
    private _connectionConfigs!: {[key: string]: ConnectionConfig};

    // region public methods: set

    /** @internal */
    public addEntity(target: object, entityMeta: IEntityMeta) {
        if (!this._entityMetas.has(target)) {
            this._entityMetas.set(target, entityMeta);
        }
    }

    /** @internal */
    public addColumn(target: object, column: string, entityColumn: IEntityColumn) {
        let columns = this._entityColumns.get(target);
        if (!columns) {
            columns = {};
            this._entityColumns.set(target, columns);
        }
        columns[column] = entityColumn;
    }

    // endregion
    
    // region public methods: get

    public getConnectionConfig(target: object): ConnectionConfig {
        const connection = this.getConnection(target);
        return this.getConnectionConfigByConnection(connection);
    }

    public getConnectionConfigByConnection(connection: string): ConnectionConfig {
        if (!this._connectionConfigs) {
            const configFile = configLoader.getConfigFile();
            const rawData = fs.readFileSync(configFile);
            const connectionConfigs = JSON.parse(rawData.toString());

            // add retry add retry strategy if needed to trigger connect error

            for (const key of Object.keys(connectionConfigs)) {
                const connectionConfig = connectionConfigs[key];
                const maxConnectRetry = connectionConfig.maxConnectRetry;
                if (maxConnectRetry) {
                    const connectTimeout = connectionConfig.connectTimeout || IOREDIS_CONNECT_TIMEOUT;
                    connectionConfig.retryStrategy = (times: number) => {
                        return times > maxConnectRetry ? null : IOREDIS_ERROR_RETRY_DELAY;
                    };
                }
            }

            this._connectionConfigs = connectionConfigs;
        }

        if (!(connection in this._connectionConfigs)) {
            throw new RedisOrmDecoratorError(`Invalid connection: ${connection}. Please check ${configLoader.getConfigFile()}`);
        }

        return this._connectionConfigs[connection];
    }

    public getEntityMeta(target: object): IEntityMeta {
        return this._entityMetas.get(target) as IEntityMeta;
    }

    public getDefaultTable(target: object): string {
        return this.getEntityMeta(target).table;
    }

    public getTablePrefix(target: object): string {
        return this.getEntityMeta(target).tablePrefix;
    }

    public getConnection(target: object): string {
        return this.getEntityMeta(target).connection;
    }

    public hasPrimaryKey(target: object): boolean {
        const entityColumns = this.getEntityColumns(target);
        return Object.entries(entityColumns).some(x => x[1].primary);
    }

    public getPrimaryKey(target: object): string {
        return "id";
    }

    public getAutoIncrementKey(target: object): string {
        const entityColumns = this.getEntityColumns(target);
        const filteredEntityColumns = Object.entries(entityColumns).find(x => x[1].primary && x[1].autoIncrement);
        return filteredEntityColumns ? filteredEntityColumns[0] : "";
    }

    public getIndexKeys(target: object): string[] {
        const entityColumns = this.getEntityColumns(target);
        return Object.entries(entityColumns).filter(x => x[1].index).map(x => x[0]);
    }

    public getUniqueKeys(target: object): string[] {
        const entityColumns = this.getEntityColumns(target);
        return Object.entries(entityColumns).filter(x => x[1].unique).map(x => x[0]);
    }

    public getEntityColumns(target: object): {[key: string]: IEntityColumn} {
        return this._entityColumns.get(target) || {};
    }

    public getSchemasJson(target: object): string {
        if (!this._entitySchemasJsons.has(target)) {
            const entityColumns = this.getEntityColumns(target);
            const keys = Object.keys(entityColumns).sort();
            const sortedEntityColumns = keys.reduce((a: any, b) => Object.assign(a, {[b]: entityColumns[b]}), {});
            this._entitySchemasJsons.set(target, JSON.stringify(sortedEntityColumns, schemaJsonReplacer));
        }

        return this._entitySchemasJsons.get(target) as string;
    }

    public getEntityColumn(target: object, column: string): IEntityColumn {
        const entityColumn = this.getEntityColumns(target);
        return entityColumn[column];
    }

    public getColumns(target: object): string[] {
        const entityColumns = this._entityColumns.get(target) || {};
        return Object.keys(entityColumns);
    }

    // endregion

    // region public methods: conditions

    public isIndexKey(target: object, column: string) {
        const keys = this.getIndexKeys(target);
        return keys.includes(column);
    }

    public isValidColumn(target: object, column: string) {
        const keys = redisOrm.getColumns(target);
        return keys.includes(column);
    }

    public isSearchableColumn(target: object, column: string) {
        const entityColumns = redisOrm.getEntityColumns(target);
        return (column in entityColumns && [String, Number, Date, Boolean].includes(entityColumns[column].type));
    }

    public isUniqueKey(target: object, column: string) {
        const keys = redisOrm.getUniqueKeys(target);
        return keys.includes(column);
    }

    public isPrimaryKey(target: object, column: string) {
        const key = redisOrm.getPrimaryKey(target);
        return key === column;
    }

    public isSortableColumn(target: object, column: string): boolean {
        const entityColumns = redisOrm.getEntityColumn(target, column);
        return entityColumns.type === Number || entityColumns.type === Boolean || entityColumns.type === Date;
    }

    public isNumberColumn(target: object, column: string) {
        const entityColumns = redisOrm.getEntityColumn(target, column);
        return entityColumns.type === Number;
    }

    public isDateColumn(target: object, column: string) {
        const entityColumns = redisOrm.getEntityColumn(target, column);
        return entityColumns.type === Date;
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
            await this._registerLuaLock(target, redisContainer);
        }

        return redisContainer.redis;
    }

    public async compareSchemas(target: object, tableName: string): Promise<string[]> {
        let errors: string[] = [];

        try {
            const remoteSchemas = await this.getRemoteSchemas(target, tableName);
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

    public async getRemoteSchemas(target: object, tableName: string): Promise<{[key: string]: IEntityColumn} | null> {
        const redis = await redisOrm.getRedis(target);
        const storageKey = this.getSchemasStorageKey();
        const remoteSchemasString = await redis.hget(storageKey, tableName);
        if (remoteSchemasString) {
            return JSON.parse(remoteSchemasString);
        }

        return null;
    }

    // endregion

    // region public methods: storage key

    public getEntityStorageKey(tableName: string, entityId: string) {
        return `entity:${tableName}:${entityId}`;
    }

    public getIndexStorageKey(tableName: string, column: string) {
        return `index:${tableName}:${column}`;
    }

    public getUniqueStorageKey(tableName: string, column: string) {
        return `unique:${tableName}:${column}`;
    }

    public getSchemasStorageKey() {
        return `meta:schemas`;
    }

    // endregion

    // region operations

    public getEntityTypes() {
        return [...this._entityMetas.keys()];
    }

    public async getRemoteSchemasList(connection: string = "default") {
        const schemasList: IEntityColumns = {};
        const connectionConfig = redisOrm.getConnectionConfigByConnection(connection);
        if (connectionConfig) {
            const redis = new IORedis(connectionConfig);
            const storageKey = redisOrm.getSchemasStorageKey();

            const result = await redis.hgetall(storageKey);
            for (const [table, schemasString] of Object.entries(result)) {
                schemasList[table] = JSON.parse(schemasString as string);
            }
        }

        return schemasList;
    }

    public async getPerformanceHelper(target: object, skipTracking?: boolean) {
        // remove everything
        const redis = await redisOrm.getRedis(target);
        const connectionConfig = this.getConnectionConfig(target);
        const performanceHelper = new PerformanceHelper(redis,
            {trackRedisInfo: connectionConfig.trackRedisInfo, skipTracking});
        await performanceHelper.start();
        return performanceHelper;
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

            const clientEntityColumn = clientSchemas[column] as IEntityColumn;
            const remoteEntityColumn = remoteSchemas[column] as IEntityColumn;

            if (clientEntityColumn.type !== remoteEntityColumn.type) {
                errors.push(`Incompatible type on column: ${column}, current value: ${clientEntityColumn.type}, remove value: ${remoteEntityColumn.type}`);
            }

            if (clientEntityColumn.index !== remoteEntityColumn.index) {
                errors.push(`Incompatible index on column: ${column}, current value: ${clientEntityColumn.index}, remove value: ${remoteEntityColumn.index}`);
            }

            if (clientEntityColumn.unique !== remoteEntityColumn.unique) {
                errors.push(`Incompatible unique on column: ${column}, current value: ${clientEntityColumn.unique}, remove value: ${remoteEntityColumn.unique}`);
            }

            if (clientEntityColumn.autoIncrement !== remoteEntityColumn.autoIncrement) {
                errors.push(`Incompatible autoIncrement on column: ${column}, current value: ${clientEntityColumn.autoIncrement}, remove value: ${remoteEntityColumn.autoIncrement}`);
            }

            if (clientEntityColumn.primary !== remoteEntityColumn.primary) {
                errors.push(`Incompatible primary on column: ${column}, current value: ${clientEntityColumn.primary}, remove value: ${remoteEntityColumn.primary}`);
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

export const redisOrm = new RedisOrm();
export function schemaJsonReplacer(key: any, value: any) {
    if (key === "type" && [String, Number, Boolean, Date, Array, Object].includes(value)) {
        return value.name;
    }

    return value;
}
