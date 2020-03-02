import {BaseEntity} from "./BaseEntity";
import {RedisOrmQueryError} from "./errors/RedisOrmQueryError";
import {PerformanceHelper} from "./helpers/PerformanceHelper";
import {parser} from "./parser";
import {redisOrm} from "./redisOrm";
import {
    IAggregateObject,
    IArgvColumn,
    IIdType,
    IIndexOperator,
    IOrder, IPerformanceResult,
    IStringOperator,
    IUniqueValueType,
    IValueType,
    IWhereIndexType,
    IWhereStringType,
} from "./types";

export class Query<T extends typeof BaseEntity> {
    private _table: string  = "";
    private _tableName: string  = ""; // prefix + _table
    private _offset = 0;
    private _limit = -1;
    private _whereSearches: {[key: string]: IWhereStringType} = {};
    private _whereIndexes: {[key: string]: IWhereIndexType} = {};
    private _sortBy: {column: string, order: IOrder} | null = null;
    private _skipTrackingId: string  = "";

    constructor(private readonly _entityType: T) {
        this.setTable(redisOrm.getDefaultTable(_entityType));
    }

    // region operation

    public setTable(table: string) {
        this._table = table;
        this._tableName = redisOrm.getTablePrefix(this._entityType) + this._table;
        return this;
    }

    // endregion

    // region find

    public async find(id: IIdType): Promise<[InstanceType<T> | undefined, IPerformanceResult]> {
        // make sure id is valid
        if (typeof id !== "string" && typeof id !== "number") {
            return [undefined, PerformanceHelper.getEmptyResult()];
        }
        
        // if we have a valid entity id
        const entityId = id.toString();
        const primaryKey = redisOrm.getPrimaryKey(this._entityType);
        let entity: InstanceType<T> | undefined;
        const entityStorageKey = redisOrm.getEntityStorageKey(this._tableName, entityId);

        // we do internal skip tracking of performance
        const redis = await this._getRedis();
        const performanceHelper = await redisOrm.getPerformanceHelper(this._entityType, !!this._skipTrackingId);
        const trackingId = this._skipTracking();
        const storageStrings = await redis.hgetall(entityStorageKey) as {[key: string]: string};
        const performanceResult =  await performanceHelper.getResult();
        this._resumeTracking(trackingId);

        // make sure id exists
        if (primaryKey in storageStrings) {
                entity = this._entityType.newFromStorageStrings(storageStrings);
                // update the table
                entity.setTable(this._table);
        }

        return [entity, performanceResult];
    }

    public async findMany(ids: IIdType[]): Promise<[Array<InstanceType<T>>, IPerformanceResult]> {
        const promises = [];

        // we do internal skip tracking of performance
        const performanceHelper = await redisOrm.getPerformanceHelper(this._entityType, !!this._skipTrackingId);
        const trackingId = this._skipTracking();
        for (const id of ids) {
            promises.push(this.find(id));
        }
        const result = await Promise.all(promises);
        const performanceResult =  await performanceHelper.getResult();

        this._resumeTracking(trackingId);

        const entities = result.map(x => x[0]).filter(x => x) as Array<InstanceType<T>>;
        return [entities, performanceResult];
    }

    public async findUnique(column: IArgvColumn<T>, value: IUniqueValueType): Promise<[InstanceType<T> | undefined, IPerformanceResult]> {
        if (!redisOrm.isUniqueKey(this._entityType, column as string)) {
            throw new RedisOrmQueryError(`(${this._entityType.name}) Invalid unique column: ${column}`);
        }

        // we do internal skip tracking of performance
        const redis = await this._getRedis();
        const performanceHelper = await redisOrm.getPerformanceHelper(this._entityType, !!this._skipTrackingId);
        const trackingId = this._skipTracking();
        const id = await redis.hget(
            redisOrm.getUniqueStorageKey(this._tableName, column as string),
            value.toString(),
        );

        let entity: InstanceType<T> | undefined;
        if (id) {
            [entity] = await this.find(id);
        }
        const performanceResult =  await performanceHelper.getResult();
        this._resumeTracking(trackingId);

        return [entity, performanceResult];
    }

    public async findUniqueMany(column: IArgvColumn<T>, values: IUniqueValueType[]):
        Promise<[Array<InstanceType<T>>, IPerformanceResult]> {

        const promises = [];

        // we do internal skip tracking of performance
        const performanceHelper = await redisOrm.getPerformanceHelper(this._entityType);
        const trackingId = this._skipTracking();
        for (const value of values) {
            promises.push(this.findUnique(column, value));
        }
        const result = await Promise.all(promises);
        const performanceResult =  await performanceHelper.getResult();
        this._resumeTracking(trackingId);

        const entities = result.map(x => x[0]).filter(x => x) as Array<InstanceType<T>>;
        return [entities, performanceResult];
    }

    // endregion

    // region take

    public async runOnce(): Promise<[InstanceType<T> | undefined, IPerformanceResult]> {
        this.offset(0);
        this.limit(1);
        const [entities, performanceResult] = await this.run();
        return [entities.length ? entities[0] : undefined, performanceResult];
    }

    public async run(): Promise<[Array<InstanceType<T>>, IPerformanceResult]> {
        return await this._run();
    }

    public where(column: IArgvColumn<T>, operator: IStringOperator | IIndexOperator, value: IValueType) {
        const columnString = column as string;
        if (redisOrm.isIndexKey(this._entityType, columnString)) {
            if (!redisOrm.isIndexKey(this._entityType, columnString)) {
                throw new RedisOrmQueryError(`(${this._entityType.name}) Invalid index column: ${column}`);
            }

            // convert value into string value
            if (value !== "-inf" && value !== "+inf") {
                const entityColumn = redisOrm.getEntityColumn(this._entityType, columnString);
                value = parser.parseValueToStorageString(entityColumn.type, value);
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

        } else if (redisOrm.isSearchableColumn(this._entityType, columnString)) {
            if (!["=", "!=", "like"].includes(operator)) {
                throw new RedisOrmQueryError(`(${this._entityType.name}) Invalid operator (${operator}) for non index column: ${column}`);
            }

            // convert value into string value
            const entityColumn = redisOrm.getEntityColumn(this._entityType, columnString);
            value = parser.parseValueToStorageString(entityColumn.type, value);
            this._whereSearches[columnString] = {operator: operator as IStringOperator, value};

        } else {
            throw new RedisOrmQueryError(`(${this._entityType.name}) Invalid search column: ${column}`);

        }

        return this;
    }

    public sortBy(column: IArgvColumn<T>, order: IOrder) {
        if (this._sortBy !== null) {
            throw new RedisOrmQueryError(`(${this._entityType.name}) You can only order by 1 column`);
        }

        if (!redisOrm.isSortableColumn(this._entityType, column as string)) {
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

    // endregion

    // region aggregate

    public async count(): Promise<[number, IPerformanceResult]>;
    public async count(groupBy: string): Promise<[IAggregateObject, IPerformanceResult]>;
    public async count(groupBy?: string) {
        return await this._aggregate("count", "", groupBy as any) as any;
    }

    public async min(column: IArgvColumn<T>): Promise<[number, IPerformanceResult]>;
    public async min(column: IArgvColumn<T>, groupBy: string): Promise<[IAggregateObject, IPerformanceResult]>;
    public async min(column: IArgvColumn<T>, groupBy?: string) {
        return await this._aggregate("min", column as string, groupBy as any) as any;
    }

    public async max(column: IArgvColumn<T>): Promise<[number, IPerformanceResult]>;
    public async max(column: IArgvColumn<T>, groupBy: string): Promise<[IAggregateObject, IPerformanceResult]>;
    public async max(column: IArgvColumn<T>, groupBy?: string) {
        return await this._aggregate("max", column as string, groupBy as any) as any;
    }

    public async sum(column: IArgvColumn<T>): Promise<[number, IPerformanceResult]>;
    public async sum(column: IArgvColumn<T>, groupBy: string): Promise<[IAggregateObject, IPerformanceResult]>;
    public async sum(column: IArgvColumn<T>, groupBy?: string) {
        return await this._aggregate("sum", column as string, groupBy as any) as any;
    }

    public async avg(column: IArgvColumn<T>): Promise<[number, IPerformanceResult]>;
    public async avg(column: IArgvColumn<T>, groupBy: string): Promise<[IAggregateObject, IPerformanceResult]>;
    public async avg(column: IArgvColumn<T>, groupBy?: string) {
        return await this._aggregate("avg", column as string, groupBy as any) as any;
    }

    // endregion

    // region rank

    public async rank(column: IArgvColumn<T>, id: IIdType, isReverse: boolean = false):
        Promise<[number, IPerformanceResult]> {

        if (!redisOrm.isIndexKey(this._entityType, column as string)) {
            throw new RedisOrmQueryError(`(${this._entityType.name}) Invalid index column: ${column}`);
        }

        // make sure id is valid
        if (typeof id !== "string" && typeof id !== "number") {
            return [-1, PerformanceHelper.getEmptyResult()];
        }

        const indexStorageKey = redisOrm.getIndexStorageKey(this._tableName, column as string);
        const entityId = id.toString();

        let offset = -1;
        const redis = await this._getRedis();
        const performanceHelper = await redisOrm.getPerformanceHelper(this._entityType);
        let tempOffset: number | null = null;
        if (isReverse) {
            tempOffset = await redis.zrevrank(indexStorageKey, entityId);
        } else {
            tempOffset = await redis.zrank(indexStorageKey, entityId);
        }
        const performanceResult =  await performanceHelper.getResult();

        if (tempOffset !== null) {
            offset = tempOffset;
        }

        return [offset, performanceResult];
    }

    // endregion

    // region private methods

    private async _run(): Promise<[Array<InstanceType<T>>, IPerformanceResult]> {
        let whereIndexKeys = Object.keys(this._whereIndexes);
        const whereSearchKeys = Object.keys(this._whereSearches);

        // we add a default index
        if (whereIndexKeys.length === 0) {
            if (this._sortBy && redisOrm.isIndexKey(this._entityType, this._sortBy.column)) {
                this.where(this._sortBy.column as any, "<=", "+inf");
            } else {
                this.where("createdAt", "<=", "+inf");
            }
            whereIndexKeys = Object.keys(this._whereIndexes);
        }

        // if we only search with only one index and ordering is same as the index
        if (whereIndexKeys.length === 1 && whereSearchKeys.length === 0 &&
            (!this._sortBy || this._sortBy.column === whereIndexKeys[0])) {
            return this._runSimple();
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

        // calculate performance and handle skip tracking
        const redis = await this._getRedis();
        const performanceHelper = await redisOrm.getPerformanceHelper(this._entityType);
        const trackingId = this._skipTracking();
        const ids =  await (redis as any).commandAtomicMixedQuery([], params);
        const [entities] =  await this.findMany(ids);
        const performanceResult =  await performanceHelper.getResult();
        this._resumeTracking(trackingId);

        return [entities, performanceResult];
    }

    // only work for query with index and same ordering
    private async _runSimple(): Promise<[Array<InstanceType<T>>, IPerformanceResult]> {
        const whereIndexKeys = Object.keys(this._whereIndexes);
        const column = whereIndexKeys[0];
        const min = this._whereIndexes[column].min;
        const max = this._whereIndexes[column].max;
        const order = this._sortBy ? this._sortBy.order : "asc";

        // redis params
        const indexStorageKey = redisOrm.getIndexStorageKey(this._tableName, column);

        // collect result ids
        const redis = await this._getRedis();
        let ids: string[] = [];

        const performanceHelper = await redisOrm.getPerformanceHelper(this._entityType);
        const trackingId = this._skipTracking();
        if (order === "asc") {
            ids = await redis.zrangebyscore(indexStorageKey, min, max, "LIMIT", this._offset, this._limit);
        } else if (order === "desc") {
            ids = await redis.zrevrangebyscore(indexStorageKey, max, min, "LIMIT", this._offset, this._limit);
        }
        const [entities] = await this.findMany(ids);
        const performanceResult =  await performanceHelper.getResult();
        this._resumeTracking(trackingId);

        return [entities, performanceResult];
    }

    private async _aggregate(aggregate: string, aggregateColumn: string): Promise<[number, IPerformanceResult]>;
    private async _aggregate(aggregate: string, aggregateColumn: string, groupBy: string): Promise<[IAggregateObject, IPerformanceResult]>;
    private async _aggregate(aggregate: string, aggregateColumn: string, groupBy?: string) {
        if (aggregate !== "count") {
            if (!redisOrm.isNumberColumn(this._entityType, aggregateColumn)) {
                throw new RedisOrmQueryError(`(${this._entityType.name}) Column: ${aggregateColumn} is not in the type of number`);
            }
        }

        if (groupBy) {
            if (!redisOrm.isValidColumn(this._entityType, groupBy as string)) {
                throw new RedisOrmQueryError(`(${this._entityType.name}) Invalid groupBy column: ${groupBy}`);
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
        if (aggregate === "count" && !groupBy &&
            whereIndexKeys.length === 1 && whereSearchKeys.length === 0) {
            return await this._aggregateSimple() as any;
        }

        const params = [
            whereIndexKeys.length,
            whereSearchKeys.length,
            this._limit, // not used
            this._offset, // not used
            this._tableName,
            aggregate,
            aggregateColumn,
            groupBy || "",
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
        const performanceHelper = await redisOrm.getPerformanceHelper(this._entityType);
        const commandResult =  await (redis as any).commandAtomicMixedQuery([], params);
        const performanceResult =  await performanceHelper.getResult();
        let result = JSON.parse(commandResult);

        if (!groupBy) {
            result = result["*"] as number || 0;
        }

        return [result, performanceResult];
    }

    private async _aggregateSimple(): Promise<[number, IPerformanceResult]> {
        let count = 0;

        const whereIndexKeys = Object.keys(this._whereIndexes);
        const column = whereIndexKeys[0];
        const min = this._whereIndexes[column].min;
        const max = this._whereIndexes[column].max;
        const redis = await this._getRedis();

        const performanceHelper = await redisOrm.getPerformanceHelper(this._entityType);
        if (max === "+inf" && min === "-inf") {
            count = await redis.zcard(redisOrm.getIndexStorageKey(this._tableName, column));
        } else {
            count = await redis.zcount(redisOrm.getIndexStorageKey(this._tableName, column), min, max);
        }
        const performanceResult =  await performanceHelper.getResult();

        return [count, performanceResult];
    }

    private async _getRedis() {
        return await redisOrm.getRedis(this._entityType);
    }

    private _skipTracking() {
        if (!this._skipTrackingId) {
            this._skipTrackingId = Math.random().toString();
            return this._skipTrackingId;
        }
    }

    private _resumeTracking(skipTrackingId?: string) {
        if (skipTrackingId && this._skipTrackingId === skipTrackingId) {
            this._skipTrackingId = "";
        }
    }

    // endregion
}
