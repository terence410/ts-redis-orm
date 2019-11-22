import * as IORedis from "ioredis";
import {BaseEntity} from "./BaseEntity";

// decorator
export type ISchemas = {[key: string]: ISchema};
export interface ISchemaBase {
    primary: boolean;
    autoIncrement: boolean;
    index: boolean;
    unique: boolean;
}

export interface ISchema extends ISchemaBase {
    type: any;
}

export interface IEntityBaseMeta {
    table: string;
    connection: string;
    indexUpdatedAt: boolean;
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
export type IInstanceColumn<T> = Exclude<keyof T, keyof BaseEntity> | "createdAt" | "updatedAt" | "deletedAt";
export type IArgColumn<T extends typeof BaseEntity> = IInstanceColumn<InstanceType<T>>;
export type IArgValues<T> = {[P in Exclude<keyof T, keyof BaseEntity>]?: T[P]} |
    {createdAt: Date} | {updatedAt: Date} | {deletedAt: Date};
export type IInstanceValues<T> = {[P in Exclude<keyof T, keyof BaseEntity>]: T[P]} &
    {createdAt: Date, updatedAt: Date, deletedAt: Date};
export type IIdObject<T> = IArgValues<T> | number | string;

// event
export type IEventType = "create" | "update" | "delete" | "forceDelete" | "restore";

export interface IEvent<T> {
    on(type: IEventType, callback: (entity: T) => void): any;
    addListener(type: IEventType, callback: (entity: T) => void): any;
    removeListener(type: IEventType, callback: (entity: T) => void): any;
    once(type: IEventType, callback: (entity: T) => void): any;
    off(type: IEventType, callback: (entity: T) => void): any;
    emit(type: IEventType, entity: T): any;
}

