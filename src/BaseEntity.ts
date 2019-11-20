import Debug from "debug";
import {entityExporter} from "./entityExporter";
import {RedisOrmEntityError} from "./errors/RedisOrmEntityError";
import {RedisOrmSchemaError} from "./errors/RedisOrmSchemaError";
import {eventEmitters} from "./eventEmitters";
import {parser} from "./parser";
import {Query} from "./Query";
import {serviceInstance} from "./serviceInstance";
import {IArgValues, IEvent, IIdObject, IInstanceValues, ISaveResult} from "./types";

// debug
const debug = Debug("tsredisorm/default");

export class BaseEntity {
    // region static methods

    public static async connect(table: string = "") {
        // validate the schema
        table = table || serviceInstance.getDefaultTable(this);
        const schemaErrors = await serviceInstance.compareSchemas(this, table);
        if (schemaErrors.length) {
            throw new RedisOrmSchemaError(`(${this.name}) Invalid Schemas`, schemaErrors);
        }

        return await serviceInstance.getRedis(this);
    }

    public static newFromStorageStrings<T extends typeof BaseEntity>(
        this: T, storageStrings: { [key: string]: string }): InstanceType<T> {
        const entity = this.create({});
        entity.assignStorageStrings(storageStrings);
        return entity;
    }

    public static query<T extends typeof BaseEntity>(this: T): Query<T> {
        return new Query(this);
    }

    public static async find<T extends typeof BaseEntity>(this: T, id: IIdObject<InstanceType<T>>):
        Promise<InstanceType<T> | undefined> {
        return await this.query().find(id);
    }

    public static async findMany<T extends typeof BaseEntity>(this: T, idObjects: Array<IIdObject<InstanceType<T>>>):
        Promise<Array<InstanceType<T>>> {
        return await this.query().findMany(idObjects);
    }

    public static create<T extends typeof BaseEntity>(this: T, values: IArgValues<InstanceType<T>>): InstanceType<T> {
        return (new this() as InstanceType<T>).set(values);
    }

    public static async all<T extends typeof BaseEntity>(this: T): Promise<Array<InstanceType<T>>> {
        return await this.query().get();
    }

    public static async count(): Promise<number> {
        return await this.query().count();
    }

    // get the current redis instance, do not use internally
    public static async getRedis() {
        return await serviceInstance.getRedis(this, false);
    }

    public static async resyncDb<T extends typeof BaseEntity>(this: T, table: string = "") {
        // get redis,
        table = table || serviceInstance.getDefaultTable(this);
        const redis = await serviceInstance.getRedis(this);
        const remoteSchemas = await serviceInstance.getRemoteSchemas(this, table);

        // we resync only if we found any schema exist
        if (remoteSchemas) {
            // prepare arguments
            const keys: [] = [];
            const params = [
                serviceInstance.getSchemasJson(this),
                table,
            ];

            // remove everything
            const commandResult = await (redis as any).commandAtomicResyncDb(keys, params);
            const saveResult = JSON.parse(commandResult) as ISaveResult;

            if (saveResult.error) {
                throw new RedisOrmEntityError(`(${this.name}) ${saveResult.error}`);
            }
            
            debug(`(${this.name}, ${table}) resync db complete`);
        } else {
            debug(`(${this.name}, ${table}) no schemas exist for resync db`);
        }
    }

    public static async truncate(className: string, table: string = "") {
        if (className !== this.name) {
            throw new RedisOrmEntityError(`(${this.name}) You need to provide the class name for truncate`);
        }

        // get redis,
        table = table || serviceInstance.getDefaultTable(this);
        const redis = await serviceInstance.getRedis(this);
        const remoteSchemas = await serviceInstance.getRemoteSchemas(this, table);

        // we truncate only if we found any schema exist
        if (remoteSchemas) {
            // prepare arguments
            const keys: [] = [];
            const params = [table];

            // remove everything
            await (redis as any).commandAtomicTruncate(keys, params);

            debug(`(${this.name}, ${table}) truncate complete`);
        } else {
            debug(`(${this.name}, ${table}) no schemas exist for truncate`);
        }
    }

    public static getEventEmitter<T extends typeof BaseEntity>(this: T): IEvent<InstanceType<T>> {
        return eventEmitters.getEventEmitter(this);
    }

    public static getSchemas() {
        const schemas = serviceInstance.getSchemas(this);
        const indexKeys = serviceInstance.getIndexKeys(this);
        const uniqueKeys = serviceInstance.getUniqueKeys(this);
        const primaryKeys = serviceInstance.getPrimaryKeys(this);
        const autoIncrementKey = serviceInstance.getAutoIncrementKey(this);
        const entityMeta = serviceInstance.getEntityMeta(this);

        // convert to column objects
        const columnTypes: any = Object.keys(schemas)
            .reduce<object>((a, b) => Object.assign(a, {[b]: schemas[b].type}), {});

        return {
            columnTypes,
            indexKeys,
            uniqueKeys,
            primaryKeys,
            autoIncrementKey,
            table: entityMeta.table,
            connection: entityMeta.connection,
            indexUpdatedAt: entityMeta.indexUpdatedAt,
        };
    }

    // endregion

    // region static method: import/export

    public static async export(file: string, table: string = "") {
        table = table || serviceInstance.getDefaultTable(this);
        const all = await this.query().setTable(table).get();
        const allDeleted = await this.query().onlyDeleted().get();
        await this.exportEntities([...all, ...allDeleted], file);
    }

    public static async exportEntities<T extends BaseEntity>(entities: T[], file: string) {
        await entityExporter.exportEntities(this, entities, file);
    }

    public static async import(file: string, skipSchemasCheck: boolean = false, table: string = "") {
        table = table || serviceInstance.getDefaultTable(this);
        await entityExporter.import(this, file, skipSchemasCheck, table);
    }

    // endregion

    // region constructor / variables
    private _table: string = "";

    // flags
    private _isNew: boolean = true;

    // cache the column values
    private _values: { [key: string]: any } = {};

    // the actual storage value in redis
    private _storageStrings: { [key: string]: string } = {};

    // store the increment commands
    private _increments: { [key: string]: number } = {};

    constructor() {
        const now = new Date();
        this.createdAt = now;
        this.updatedAt = now;
        this._table = serviceInstance.getDefaultTable(this.constructor);
    }

    // endregion

    // region public get properties: conditions

    public get isDeleted(): boolean {
        return !isNaN(Number(this._storageStrings.deletedAt));
    }

    public get isNew(): boolean {
        return this._isNew;
    }

    // endregion

    // region public properties: createdAt, updatedAt, deletedAt

    public get createdAt(): Date {
        return this._get("createdAt");
    }

    public set createdAt(value: Date) {
        this._set("createdAt", value);
    }

    public get updatedAt(): Date {
        return this._get("updatedAt");
    }

    public set updatedAt(value: Date) {
        this._set("updatedAt", value);
    }

    public get deletedAt(): Date {
        return this._get("deletedAt");
    }

    public set deletedAt(value: Date) {
        this._set("deletedAt", value);
    }

    // endregion

    // region public methods

    public setTable(table: string) {
        this._table = table;
    }

    public getTable() {
        return this._table;
    }

    public getEntityId(): string {
        const primaryKeys = serviceInstance.getPrimaryKeys(this.constructor).sort();
        const values: string[] = [];

        for (const column of primaryKeys) {
            const value = this._get(column);
            if (typeof value === "number") {
                if (value && Number.isInteger(value)) {
                    values.push(value.toString().replace(/:/g, ""));
                } else {
                    throw new RedisOrmEntityError(`(${this.constructor.name}) Invalid number value: ${value} for primary key: ${column}`);
                }

            } else if (typeof value === "string") {
                if (value) {
                    values.push(value.replace(/:/g, ""));
                } else {
                    throw new RedisOrmEntityError(`(${this.constructor.name}) Invalid string value: '${value}' for primary key: ${column}`);
                }
            } else {
                throw new RedisOrmEntityError(`(${this.constructor.name}) Invalid value: ${value} for primary key: ${column}`);
            }
        }

        return values.join(":");
    }

    public getValues<T extends BaseEntity>(this: T) {
        const values: any = {};
        const columns = serviceInstance.getColumns(this.constructor);
        for (const column of columns) {
            values[column] = this._get(column);
        }

        return values as IInstanceValues<T>;
    }

    public increment<T extends BaseEntity>(this: T, column: keyof T, value: number = 1) {
        if (this.isNew) {
            throw new RedisOrmEntityError(`(${this.constructor.name}) You cannot increment a new entity`);
        }

        if (serviceInstance.isPrimaryKey(this.constructor, column as string)) {
            throw new RedisOrmEntityError(`(${this.constructor.name}) You cannot increment primary key`);
        }

        if (serviceInstance.isUniqueKey(this.constructor, column as string)) {
            throw new RedisOrmEntityError(`(${this.constructor.name}) You cannot increment unique key`);
        }

        if (!serviceInstance.isNumberColumn(this.constructor, column as string)) {
            throw new RedisOrmEntityError(`(${this.constructor.name}) Column need to be in the type of Number`);
        }

        if (!Number.isInteger(value)) {
            throw new RedisOrmEntityError(`(${this.constructor.name}) Increment value need to be an integer`);
        }

        this._increments[column as string] = value;
        return this;
    }

    public set<T extends BaseEntity>(this: T, values: IArgValues<T>) {
        Object.assign(this, values);
        return this;
    }

    public async save() {
        return await this._saveInternal();
    }

    public async delete() {
        return await this._deleteInternal({forceDelete: false});
    }

    public async forceDelete() {
        return await this._deleteInternal({forceDelete: true});
    }

    public async restore() {
        return await this._saveInternal({isRestore: true});
    }

    public clone(): this {
        const entity = new (this.constructor as any)() as this;
        entity.set(this.getValues());
        return entity;
    }

    public toJSON() {
        return this.getValues();
    }

    // endregion

    // region protected methods

    protected assignStorageStrings(storageStrings: { [key: string]: string }) {
        this._isNew = false;
        this._storageStrings = storageStrings;

        // we preserve default values by removing existing _values only
        for (const column of Object.keys(storageStrings)) {
            delete this._values[column];
        }
    }

    // endregion

    // region private methods: value get / set

    private _get(column: string): any {
        if (!(column in this._values)) {
            const schema = serviceInstance.getSchema(this.constructor, column);
            this._values[column] = parser.parseStorageStringToValue(schema.type, this._storageStrings[column]);
        }

        return this._values[column];
    }

    private _set(column: string, value: any, updateStorageString = false) {
        const schema = serviceInstance.getSchema(this.constructor, column);
        const storageString = parser.parseValueToStorageString(schema.type, value);
        this._values[column] = parser.parseStorageStringToValue(schema.type, storageString);

        if (updateStorageString) {
            this._storageStrings[column] = storageString;
        }
    }

    // endregion

    // region private methods: common

    private async _saveInternal({isRestore = false} = {}) {
        if (this.isDeleted && !isRestore) {
            throw new RedisOrmEntityError(`(${this.constructor.name}) You cannot update a deleted entity`);
        }

        const changes = this._getChanges();
        if (Object.keys(changes).length === 0) {
            // no changes and no increments, no need to save
            if (!isRestore && Object.keys(this._increments).length === 0) {
                return this;
            }
        }

        // update updatedAt if user didn't update it explicitly
        if (!changes.updatedAt) {
            changes.updatedAt = parser.parseValueToStorageString(Date, new Date());
        }

        // remove deletedAt for all situation
        changes.deletedAt = parser.parseValueToStorageString(Date, new Date(Number.NaN));

        // prepare redis lua command parameters
        const indexKeys = serviceInstance.getIndexKeys(this.constructor);
        const uniqueKeys = serviceInstance.getUniqueKeys(this.constructor);
        const autoIncrementKey = serviceInstance.getAutoIncrementKey(this.constructor);
        let entityId = "";

        // we must assign an entity id for the following case
        // - if it's not new
        // - if it's not auto increment
        // - if the auto increment key is not 0
        if (!this.isNew || !autoIncrementKey || changes[autoIncrementKey] !== "0") {
            entityId = this.getEntityId();
        }

        // prepare argument
        const params = [
            serviceInstance.getSchemasJson(this.constructor),
            entityId,
            this.isNew,
            this._table,
            autoIncrementKey,
            JSON.stringify(indexKeys),
            JSON.stringify(uniqueKeys),
            JSON.stringify(changes),
            JSON.stringify(this._increments),
            isRestore,
        ];

        const redis = await serviceInstance.getRedis(this.constructor);
        const commandResult =  await (redis as any).commandAtomicSave([], params);
        const saveResult = JSON.parse(commandResult) as ISaveResult;

        if (saveResult.error) {
            if (saveResult.error === "Invalid Schemas") {
                const schemaErrors = await serviceInstance.compareSchemas(this.constructor, this._table);
                throw new RedisOrmSchemaError(`(${this.constructor.name}) ${saveResult.error}`, schemaErrors);
            } else {
                throw new RedisOrmEntityError(`(${this.constructor.name}) ${saveResult.error}`);
            }
        }

        // update storage strings
        Object.assign(this._storageStrings, changes);

        // if we do not have id and it's auto increment
        if (this.isNew && autoIncrementKey && saveResult.autoIncrementKeyValue) {
            this._set(autoIncrementKey, saveResult.autoIncrementKeyValue, true);
        }

        // if we have increment result
        if (saveResult.increments) {
            for (const [column, value] of Object.entries(saveResult.increments)) {
                this._set(column, value, true);
            }
        }

        // clean up
        this._increments = {};
        this._values = {};

        // update the flags
        const isNew = this._isNew;
        this._isNew = false;

        // fire event
        if (isRestore) {
            eventEmitters.getEventEmitter(this.constructor as any).emit("restore", this);

        } else {
            if (isNew) {
                eventEmitters.getEventEmitter(this.constructor as any).emit("create", this);
            } else {
                eventEmitters.getEventEmitter(this.constructor as any).emit("update", this);
            }
        }

        return this;
    }

    private async _deleteInternal({forceDelete = false} = {}) {
        // checking
        if (this.isNew) {
            throw new RedisOrmEntityError(`(${this.constructor.name}) You cannot delete a new entity`);
        }

        // if it's soft delete
        const entityMeta = serviceInstance.getEntityMeta(this.constructor);
        if (!forceDelete && this.isDeleted) {
            throw new RedisOrmEntityError(`(${this.constructor.name}) You cannot delete a deleted entity`);
        }

        // if we didn't set deletedAt, set a new one
        let deletedAt = this.deletedAt;
        if (isNaN(deletedAt.getTime())) {
            deletedAt = new Date();
        }

        // prepare redis lua command parameters
        const entityId = this.getEntityId();
        const indexKeys = serviceInstance.getIndexKeys(this.constructor);
        const uniqueKeys = serviceInstance.getUniqueKeys(this.constructor);

        const keys: [] = [];
        const params = [
            serviceInstance.getSchemasJson(this.constructor),
            entityId,
            !forceDelete,
            this._table,
            deletedAt.getTime(),
            JSON.stringify(indexKeys),
            JSON.stringify(uniqueKeys),
        ];

        const redis = await serviceInstance.getRedis(this.constructor);
        const commandResult =  await (redis as any).commandAtomicDelete(keys, params);
        const saveResult = JSON.parse(commandResult) as ISaveResult;

        // throw error if there is any
        if (saveResult.error) {
            throw new RedisOrmEntityError(`(${this.constructor.name}) ${saveResult.error}`);
        }

        // update deleted At
        this._set("deletedAt", deletedAt, true);

        // fire event
        if (forceDelete) {
            eventEmitters.getEventEmitter(this.constructor as any).emit("forceDelete", this);
        } else {
            eventEmitters.getEventEmitter(this.constructor as any).emit("delete", this);
        }

        return this;
    }

    private _getChanges(): { [key: string]: string } {
        let hasChanges = false;
        const changes: { [key: string]: string } = {};
        const schemas = serviceInstance.getSchemas(this.constructor);
        for (const [column, schema] of Object.entries(schemas)) {
            // if no such value before, it must be a changes
            const currentValue = this._get(column);
            const storageString = parser.parseValueToStorageString(schema.type, currentValue);
            if (!(column in this._storageStrings) || storageString !== this._storageStrings[column]) {
                changes[column] = storageString;
                hasChanges = true;
            }
        }

        return changes;
    }

    // endregion
}
