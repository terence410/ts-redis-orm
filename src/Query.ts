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

export class Query<T extends typeof BaseEntity> {
    private _onlyDeleted = false;
    private _offset = 0;
    private _limit = -1;
    private _whereSearches: {[key: string]: IWhereStringType} = {};
    private _whereIndexes: {[key: string]: IWhereIndexType} = {};
    private _sortBy: {column: string, order: IOrder} | null = null;
    private _groupByColumn: string | null = null;
    private _groupByDateFormat: string = ""; // this is experimental feature

    constructor(private readonly _entityType: T) {
    }

    // region find

    public async find(idObject: IIdObject<InstanceType<T>>): Promise<InstanceType<T> | undefined> {
        const entityId = serviceInstance.convertAsEntityId(this._entityType, idObject);
        const primaryKeys = serviceInstance.getPrimaryKeys(this._entityType);
        
        // if we have a valid entity id
        if (entityId) {
            const entityStorageKey = serviceInstance.getEntityStorageKey(this._entityType, entityId);

            if (!entityStorageKey) {
                throw new RedisOrmQueryError(`(${this._entityType.name}) Invalid id ${JSON.stringify(idObject)}`);
            }

            // we need to make sure if have all the keys exist in the storage strings
            const redis = await this._getRedis();
            const storageStrings = await redis.hgetall(entityStorageKey);
            if (primaryKeys.every(primaryKey => primaryKey in storageStrings)) {
                if ((storageStrings.deletedAt !== "NaN") === this._onlyDeleted) {
                    return this._entityType.newFromStorageStrings(storageStrings);
                }
            }
        }
    }

    public async findMany(idObjects: Array<IIdObject<InstanceType<T>>>): Promise<Array<InstanceType<T>>> {
        const promises = [];
        for (const idObject of idObjects) {
            promises.push(this.find(idObject));
        }

        const result = await Promise.all(promises);
        return result.filter(x => x) as Array<InstanceType<T>>;
    }

    public async findUnique(column: IArgColumn<T>, value: IUniqueValueType): Promise<InstanceType<T> | undefined> {
        if (!serviceInstance.isUniqueKey(this._entityType, column as string)) {
            throw new RedisOrmQueryError(`(${this._entityType.name}) Invalid unique column: ${column}`);
        }

        const redis = await this._getRedis();
        const id = await redis.hget(
            serviceInstance.getUniqueStorageKey(this._entityType, column as string),
            value.toString(),
        );

        if (id) {
            return await this.find(id);
        }
    }

    public async findUniqueMany(column: IArgColumn<T>, values: IUniqueValueType[]):
        Promise<Array<InstanceType<T>>> {
        const promises = [];
        for (const value of values) {
            promises.push(this.findUnique(column, value));
        }

        const result = await Promise.all(promises);
        return result.filter(x => x) as Array<InstanceType<T>>;
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
        return this._get();
    }

    public where(column: IArgColumn<T>, operator: IStringOperator | IIndexOperator, value: IValueType) {
        const columnString = column as string;
        if (serviceInstance.isIndexKey(this._entityType, columnString)) {
            if (this._onlyDeleted) {
                throw new RedisOrmQueryError(`(${this._entityType.name}) You cannot apply extra where indexing clause for only deleted query`);
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
        return await this._aggregate("count", "") as number;
    }

    public async min(column: IArgColumn<T>) {
        return await this._aggregate("min", column as string);
    }

    public async max(column: IArgColumn<T>) {
        return await this._aggregate("max", column as string);
    }

    public async sum(column: IArgColumn<T>) {
        return await this._aggregate("sum", column as string);
    }

    public async avg(column: IArgColumn<T>) {
        return await this._aggregate("avg", column as string);
    }

    // endregion

    // region: rank

    public async rank(column: IArgColumn<T>, idObject: IIdObject<InstanceType<T>>, isReverse: boolean = false):
        Promise<number> {
        if (!serviceInstance.isIndexKey(this._entityType, column as string)) {
            throw new RedisOrmQueryError(`(${this._entityType.name}) Invalid index column: ${column}`);
        }

        const indexStorageKey = serviceInstance.getIndexStorageKey(this._entityType, column as string);
        const entityId = serviceInstance.convertAsEntityId(this._entityType, idObject);

        if (entityId) {
            const redis = await this._getRedis();
            let offset: number | null = null;
            if (isReverse) {
                offset = await redis.zrevrank(indexStorageKey, entityId);
            } else {
                offset = await redis.zrank(indexStorageKey, entityId);
            }

            if (offset !== null) {
                return offset;
            }
        }

        return -1;
    }

    // endregion

    // region private methods

    private async _get(): Promise<Array<InstanceType<T>>> {
        let whereIndexKeys = Object.keys(this._whereIndexes);
        const whereSearchKeys = Object.keys(this._whereSearches);

        // we add a default index
        if (whereIndexKeys.length === 0) {
            this.where("createdAt", "<=", "+inf");
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
            serviceInstance.getTable(this._entityType),
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
        const indexStorageKey = serviceInstance.getIndexStorageKey(this._entityType, column);
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
            serviceInstance.getTable(this._entityType),
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
            count = await redis.zcard(serviceInstance.getIndexStorageKey(this._entityType, column));
        } else {
            count = await redis.zcount(serviceInstance.getIndexStorageKey(this._entityType, column), min, max);
        }

        return count;
    }

    private async _getRedis() {
        return await serviceInstance.getRedis(this._entityType);
    }

    // endregion
}
