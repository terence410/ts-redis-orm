import Debug from "debug";
import {BaseEntity} from "./BaseEntity";
import {RedisOrmQueryError} from "./errors/RedisOrmQueryError";
import {parser} from "./parser";
import {serviceInstance} from "./serviceInstance";
import {
    IAggregateObject,
    IArgColumn,
    IIdObject,
    IIndexOperator,
    IOrder,
    IStringOperator,
    IUniqueValueType,
    IValueType,
    IWhereIndexType,
    IWhereStringType,
} from "./types";

// debug
const debugPerformance = Debug("redisorm/performance");

export class Query<T extends typeof BaseEntity> {
    private _table: string  = "";
    private _tableName: string  = ""; // prefix + _table
    private _onlyDeleted = false;
    private _offset = 0;
    private _limit = -1;
    private _whereSearches: {[key: string]: IWhereStringType} = {};
    private _whereIndexes: {[key: string]: IWhereIndexType} = {};
    private _sortBy: {column: string, order: IOrder} | null = null;
    private _groupByColumn: string | null = null;
    private _groupByDateFormat: string = ""; // this is experimental feature
    private _timer: [number, number] = [0, 0];
    private _timerType = "";

    constructor(private readonly _entityType: T) {
        this.setTable(serviceInstance.getDefaultTable(_entityType));
    }

    // region operation

    public setTable(table: string) {
        this._table = table;
        this._tableName = serviceInstance.getTablePrefix(this._entityType) + this._table;
        return this;
    }

    // endregion

    // region find

    public async find(idObject: IIdObject<InstanceType<T>>): Promise<InstanceType<T> | undefined> {
        this._timerStart("find");
        const entityId = serviceInstance.convertAsEntityId(this._entityType, idObject);
        const primaryKeys = serviceInstance.getPrimaryKeys(this._entityType);
        
        // if we have a valid entity id
        let entity: InstanceType<T> | undefined;
        if (entityId) {
            const entityStorageKey = serviceInstance.getEntityStorageKey(this._tableName, entityId);

            if (!entityStorageKey) {
                throw new RedisOrmQueryError(`(${this._entityType.name}) Invalid id ${JSON.stringify(idObject)}`);
            }

            // we need to make sure if have all the keys exist in the storage strings
            const redis = await this._getRedis();
            const storageStrings = await redis.hgetall(entityStorageKey);
            if (primaryKeys.every(primaryKey => primaryKey in storageStrings)) {
                if ((storageStrings.deletedAt !== "NaN") === this._onlyDeleted) {
                    entity = this._entityType.newFromStorageStrings(storageStrings);
                    // update the table
                    entity.setTable(this._table);
                }
            }
        }

        this._timerEndCustom("find", `id: ${JSON.stringify(idObject)}`);
        return entity;
    }

    public async findMany(idObjects: Array<IIdObject<InstanceType<T>>>): Promise<Array<InstanceType<T>>> {
        this._timerStart("findMany");
        const promises = [];
        for (const idObject of idObjects) {
            promises.push(this.find(idObject));
        }

        const result = await Promise.all(promises);
        const entities = result.filter(x => x) as Array<InstanceType<T>>;

        this._timerEndCustom("findMany", `Total Id: ${idObjects.length}`);
        return entities;
    }

    public async findUnique(column: IArgColumn<T>, value: IUniqueValueType): Promise<InstanceType<T> | undefined> {
        this._timerStart("findUnique");

        if (!serviceInstance.isUniqueKey(this._entityType, column as string)) {
            throw new RedisOrmQueryError(`(${this._entityType.name}) Invalid unique column: ${column}`);
        }

        const redis = await this._getRedis();
        const id = await redis.hget(
            serviceInstance.getUniqueStorageKey(this._tableName, column as string),
            value.toString(),
        );

        let entity: InstanceType<T> | undefined;
        if (id) {
            entity = await this.find(id);
        }

        this._timerEndCustom("findUnique", `Column: ${column}, Value: ${value}`);
        return entity;
    }

    public async findUniqueMany(column: IArgColumn<T>, values: IUniqueValueType[]):
        Promise<Array<InstanceType<T>>> {
        this._timerStart("findUniqueMany");

        const promises = [];
        for (const value of values) {
            promises.push(this.findUnique(column, value));
        }

        const result = await Promise.all(promises);
        const entities = result.filter(x => x) as Array<InstanceType<T>>;

        this._timerEndCustom("findUniqueMany", `Column: ${column}, Total values: ${values.length}`);
        return entities;
    }

    // endregion

    // region take

    public async first(): Promise<InstanceType<T> | undefined> {
        this.offset(0);
        this.limit(1);
        const entities = await this.get();
        return entities.length ? entities[0] : undefined;
    }

    public async get(): Promise<Array<InstanceType<T>>> {
        this._timerStart("get");
        const result = await this._get();
        this._timerEnd("get");
        return result;
    }

    public where(column: IArgColumn<T>, operator: IStringOperator | IIndexOperator, value: IValueType) {
        const columnString = column as string;
        if (serviceInstance.isIndexKey(this._entityType, columnString)) {
            if (this._onlyDeleted) {
                throw new RedisOrmQueryError(`(${this._entityType.name}) You cannot apply indexing clause for onlyDeleted query`);
            }

            if (!serviceInstance.isIndexKey(this._entityType, columnString)) {
                throw new RedisOrmQueryError(`(${this._entityType.name}) Invalid index column: ${column}`);
            }

            // convert value into string value
            if (value !== "-inf" && value !== "+inf") {
                const schema = serviceInstance.getSchema(this._entityType, columnString);
                value = parser.parseValueToStorageString(schema.type, value);
            }

            let whereIndexType: IWhereIndexType = {min: "-inf", max: "+inf"};
            if (columnString in this._whereIndexes) {
                whereIndexType = this._whereIndexes[columnString];
            }

            switch (operator) {
                case "=":
                    whereIndexType.min = value;
                    whereIndexType.max = value;
                    break;

                case ">=":
                    whereIndexType.min = value;
                    break;

                case "<=":
                    whereIndexType.max = value;
                    break;

                case ">":
                    whereIndexType.min = "(" + value;
                    break;

                case "<":
                    whereIndexType.max = "(" + value;
                    break;

                default:
                    throw new RedisOrmQueryError(`(${this._entityType.name}) Invalid operator (${operator}) for index column: ${column}`);
            }

            this._whereIndexes[columnString] = whereIndexType;

        } else if (serviceInstance.isSearchableColumn(this._entityType, columnString)) {
            if (!["=", "!=", "like"].includes(operator)) {
                throw new RedisOrmQueryError(`(${this._entityType.name}) Invalid operator (${operator}) for non index column: ${column}`);
            }

            // convert value into string value
            const schema = serviceInstance.getSchema(this._entityType, columnString);
            value = parser.parseValueToStorageString(schema.type, value);
            this._whereSearches[columnString] = {operator: operator as IStringOperator, value};

        } else {
            throw new RedisOrmQueryError(`(${this._entityType.name}) Invalid search column: ${column}`);

        }

        return this;
    }

    public onlyDeleted(): Query<T> {
        if (Object.keys(this._whereIndexes).length > 0) {
            throw new RedisOrmQueryError(`(${this._entityType.name}) You cannot apply extra where indexing clause for only deleted query`);
        }

        this.where("deletedAt", "<=", "+inf");
        this.where("deletedAt", ">=", "-inf");
        this._onlyDeleted = true;
        return this;
    }

    public sortBy(column: IArgColumn<T>, order: IOrder) {
        if (this._sortBy !== null) {
            throw new RedisOrmQueryError(`(${this._entityType.name}) You can only order by 1 column`);
        }

        if (!serviceInstance.isSortableColumn(this._entityType, column as string)) {
            throw new RedisOrmQueryError(`(${this._entityType.name}) Not sortable Column: ${column}. You can only sort column type of Number, Boolean or Date`);
        }

        this._sortBy = {column: column as string, order};
        return this;
    }

    public offset(value: number) {
        this._offset = value;
        return this;
    }

    public limit(value: number) {
        this._limit = value;
        return this;
    }

    public take(value: number) {
        this._limit = value;
        this._offset = 0;
        return this;
    }

    public groupBy(column: IArgColumn<T>) {
        if (this._groupByColumn !== null) {
            throw new RedisOrmQueryError(`(${this._entityType.name}) You can only group by 1 column`);
        }

        if (!serviceInstance.isValidColumn(this._entityType, column as string)) {
            throw new RedisOrmQueryError(`(${this._entityType.name}) Invalid column: ${column}`);
        }

        this._groupByColumn = column as string;
        return this;
    }

    // endregion

    // region aggregate

    public async count(): Promise<number> {
        this._timerStart("count");
        const result = await this._aggregate("count", "") as number;
        this._timerEnd("count");
        return result;
    }

    public async min(column: IArgColumn<T>) {
        this._timerStart("min");
        const result = await this._aggregate("min", column as string);
        this._timerEnd("min");
        return result;
    }

    public async max(column: IArgColumn<T>) {
        this._timerStart("max");
        const result = await this._aggregate("max", column as string);
        this._timerEnd("max");
        return result;
    }

    public async sum(column: IArgColumn<T>) {
        this._timerStart("sum");
        const result = await this._aggregate("sum", column as string);
        this._timerEnd("sum");
        return result;
    }

    public async avg(column: IArgColumn<T>) {
        this._timerStart("avg");
        const result = await this._aggregate("avg", column as string);
        this._timerEnd("avg");
        return result;
    }

    // endregion

    // region rank

    public async rank(column: IArgColumn<T>, idObject: IIdObject<InstanceType<T>>, isReverse: boolean = false):
        Promise<number> {

        this._timerStart("rank");

        if (!serviceInstance.isIndexKey(this._entityType, column as string)) {
            throw new RedisOrmQueryError(`(${this._entityType.name}) Invalid index column: ${column}`);
        }

        const indexStorageKey = serviceInstance.getIndexStorageKey(this._tableName, column as string);
        const entityId = serviceInstance.convertAsEntityId(this._entityType, idObject);

        let offset = -1;
        if (entityId) {
            const redis = await this._getRedis();
            let tempOffset: number | null = null;
            if (isReverse) {
                tempOffset = await redis.zrevrank(indexStorageKey, entityId);
            } else {
                tempOffset = await redis.zrank(indexStorageKey, entityId);
            }

            if (tempOffset !== null) {
                offset = tempOffset;
            }
        }

        this._timerEnd("rank");
        return offset;
    }

    // endregion

    // region private methods

    private async _get(): Promise<Array<InstanceType<T>>> {
        let whereIndexKeys = Object.keys(this._whereIndexes);
        const whereSearchKeys = Object.keys(this._whereSearches);

        // we add a default index
        if (whereIndexKeys.length === 0) {
            if (this._sortBy && serviceInstance.isIndexKey(this._entityType, this._sortBy.column)) {
                this.where(this._sortBy.column as any, "<=", "+inf");
            } else {
                this.where("createdAt", "<=", "+inf");
            }
            whereIndexKeys = Object.keys(this._whereIndexes);
        }

        // if we only search with only one index and ordering is same as the index
        if (whereIndexKeys.length === 1 && whereSearchKeys.length === 0 &&
            (!this._sortBy || this._sortBy.column === whereIndexKeys[0])) {
            return this._getSimple();
        }
        
        // we send to redis lua to do complex query
        const params = [
            whereIndexKeys.length,
            whereSearchKeys.length,
            this._offset,
            this._limit,
            this._tableName,
            "", // aggregate
            "", // aggregate column
            "", // group by column
            "", // group by date format
            this._sortBy ? this._sortBy.column : "",
            this._sortBy ? this._sortBy.order : "",
        ];

        // whereIndexes
        for (const [column, {min, max}] of Object.entries(this._whereIndexes)) {
            params.push(column);
            params.push(min);
            params.push(max);
        }

        // whereSearches
        for (const [column, {operator, value}] of Object.entries(this._whereSearches)) {
            params.push(column);
            params.push(operator);
            params.push(value);
        }

        // whereSearches
        const redis = await this._getRedis();
        const ids =  await (redis as any).commandAtomicMixedQuery([], params);
        return await this.findMany(ids);
    }

    // only work for query with index and same ordering
    private async _getSimple(): Promise<Array<InstanceType<T>>> {
        const whereIndexKeys = Object.keys(this._whereIndexes);
        const column = whereIndexKeys[0];
        const min = this._whereIndexes[column].min;
        const max = this._whereIndexes[column].max;
        const order = this._sortBy ? this._sortBy.order : "asc";

        // redis params
        const indexStorageKey = serviceInstance.getIndexStorageKey(this._tableName, column);
        const extraParams = ["LIMIT", this._offset.toString(), this._limit.toString()];

        // collect result ids
        const redis = await this._getRedis();
        let ids: string[] = [];

        if (order === "asc") {
            ids = await redis.zrangebyscore(indexStorageKey, min, max, ...extraParams);
        } else if (order === "desc") {
            ids = await redis.zrevrangebyscore(indexStorageKey, max, min, ...extraParams);
        }

        return await this.findMany(ids);
    }

    private async _aggregate(aggregate: string, aggregateColumn: string): Promise<number | IAggregateObject> {
        if (aggregate !== "count") {
            if (!serviceInstance.isNumberColumn(this._entityType, aggregateColumn)) {
                throw new RedisOrmQueryError(`(${this._entityType.name}) Column: ${aggregateColumn} is not in the type of number`);
            }
        }

        let whereIndexKeys = Object.keys(this._whereIndexes);
        const whereSearchKeys = Object.keys(this._whereSearches);

        // we add a default index
        if (whereIndexKeys.length === 0) {
            this.where("createdAt", "<=", "+inf");
            whereIndexKeys = Object.keys(this._whereIndexes);
        }

        // aggregate in simple way
        if (aggregate === "count" && !this._groupByColumn &&
            whereIndexKeys.length === 1 && whereSearchKeys.length === 0) {
            return await this._aggregateSimple();
        }

        const params = [
            whereIndexKeys.length,
            whereSearchKeys.length,
            this._limit, // not used
            this._offset, // not used
            this._tableName,
            aggregate,
            aggregateColumn,
            this._groupByColumn,
            this._groupByDateFormat,
            "", // sortBy.column
            "", // sortBy.order
        ];

        // whereIndexes
        for (const [column, {min, max}] of Object.entries(this._whereIndexes)) {
            params.push(column);
            params.push(min);
            params.push(max);
        }

        // whereSearches
        for (const [column, {operator, value}] of Object.entries(this._whereSearches)) {
            params.push(column);
            params.push(operator);
            params.push(value);
        }

        const redis = await this._getRedis();
        const commandResult =  await (redis as any).commandAtomicMixedQuery([], params);
        const result = JSON.parse(commandResult);

        if (!this._groupByColumn) {
            return result["*"] as number || 0;
        }

        return result;
    }

    private async _aggregateSimple(): Promise<number> {
        let count = 0;

        const whereIndexKeys = Object.keys(this._whereIndexes);
        const column = whereIndexKeys[0];
        const min = this._whereIndexes[column].min;
        const max = this._whereIndexes[column].max;
        const redis = await this._getRedis();

        if (max === "+inf" && min === "-inf") {
            count = await redis.zcard(serviceInstance.getIndexStorageKey(this._tableName, column));
        } else {
            count = await redis.zcount(serviceInstance.getIndexStorageKey(this._tableName, column), min, max);
        }

        return count;
    }

    private async _getRedis() {
        return await serviceInstance.getRedis(this._entityType);
    }

    private _timerStart(type: string) {
        if (debugPerformance.enabled && this._timerType === "") {
            this._timer = process.hrtime();
            this._timerType = type;
        }
    }

    private _timerEnd(type: string) {
        if (debugPerformance.enabled && this._timerType === type) {
            const diff = process.hrtime(this._timer);
            const executionTime = (diff[1] / 1000000).toFixed(2);
            const indexWhere = `Index: ${JSON.stringify(this._whereIndexes)}`;
            const searchWhere = `Search: ${JSON.stringify(this._whereSearches)}`;
            const sort = `Sort by: ${JSON.stringify(this._sortBy)}`;
            const groupBy = `Group by: ${JSON.stringify(this._groupByColumn)}`;
            const offset = `offset: ${this._offset}`;
            const limit = `limit: ${this._limit}`;
            debugPerformance(`(${this._entityType.name}, ${this._tableName}) ${type} executed in ${executionTime}ms. ${indexWhere}. ${searchWhere}. ${sort}. ${groupBy}. ${offset}. ${limit}`);
        }
    }

    private _timerEndCustom(type: string, data: any) {
        if (debugPerformance.enabled && this._timerType === type) {
            const diff = process.hrtime(this._timer);
            const executionTime = (diff[1] / 1000000).toFixed(2);
            debugPerformance(`(${this._entityType.name}, ${this._tableName}) ${type} executed in ${executionTime}ms. ${data}`);
        }
    }

    // endregion
}
