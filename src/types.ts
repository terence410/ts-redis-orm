import * as IORedis from "ioredis";
import {BaseEntity} from "./BaseEntity";

export type ConnectionConfig = {
    host: string;
    port: number;
    connectTimeout: number;
    db: number;
    trackRedisInfo: boolean;
    showFriendlyErrorStack: boolean;
    maxConnectRetry: number;
    retryStrategy?: (times: number) => number;
};

export type IPerformanceResult = {
    executionTime: number;
    commandStats: any;
    diffCommandStats: any;
    usedCpuSys: number;
    diffUsedCpuSys: number;
    usedCpuUser: number;
    diffUsedCpuUser: number;
    usedMemory: number;
    diffUsedMemory: number;
};

// decorator
export type IEntityColumns = {[key: string]: IEntityColumn};
export interface IEntityColumnBase {
    autoIncrement: boolean;
    index: boolean;
    unique: boolean;
}
export interface IEntityColumn extends IEntityColumnBase {
    primary: boolean;
    type: any;
}
export interface IEntityBaseMeta {
    table: string;
    tablePrefix: string;
    connection: string;
}
export interface IEntityMeta extends IEntityBaseMeta {
    redisMaster: IRedisContainer | null;
}
export interface IRedisContainer {
    redis: IORedis.Redis;
    connecting: boolean;
    ready: boolean;
    schemaErrors: string[];
    error: Error | null;
}

// query
export type IIndexOperator = ">" | ">=" | "<" | "<=" | "=";
export type IStringOperator = "=" | "!=" | "like";
export type IValueType = string | number | boolean | Date | null;
export type IUniqueValueType = string | number;
export type IDateValueType = Date | number;
export type IOrder = "asc" | "desc";
export type IAggregateObject = {[key: string]: number};
export type IWhereStringType = {operator: IStringOperator, value: string};
export type IWhereIndexType = {min: string, max: string};

// query result
export type ISaveResult = {
    error: string;
    entityId: string;
    autoIncrementKeyValue: number;
    increments: number[];
};

// entity
export type IArgvColumns<T> = Exclude<keyof T, keyof BaseEntity> | "createdAt";
export type IArgvColumn<T extends typeof BaseEntity> = IArgvColumns<InstanceType<T>>;
export type IArgvValues<T> = {[P in Exclude<keyof T, keyof BaseEntity>]?: T[P]} | {createdAt: Date};
export type IInstanceValues<T> = {[P in Exclude<keyof T, keyof BaseEntity>]: T[P]} & {createdAt: Date};
// export type IIdObject<T> = IArgvValues<T> | number | string;
export type IIdType = number | string;

// event
export type IEventsType = "create" | "update" | "delete";
export interface IEvents<T> {
    on(type: IEventsType, callback: (entity: T) => void): this;
    addListener(type: IEventsType, callback: (entity: T) => void): this;
    removeListener(type: IEventsType, callback: (entity: T) => void): this;
    once(type: IEventsType, callback: (entity: T) => void): this;
    off(type: IEventsType, callback: (entity: T) => void): this;
    emit(type: IEventsType, entity: T): void;
}
