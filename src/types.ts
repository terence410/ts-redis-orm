import * as IORedis from "ioredis";
import {BaseEntity} from "./BaseEntity";

// decorator
export type IEntityColumns = {[key: string]: IEntityColumn};
export interface IEntityColumnBase {
    primary: boolean;
    autoIncrement: boolean;
    index: boolean;
    unique: boolean;
}
export interface IEntityColumn extends IEntityColumnBase {
    type: any;
}
export interface IEntityBaseMeta {
    table: string;
    tablePrefix: string;
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
export type IArgvColumns<T> = Exclude<keyof T, keyof BaseEntity> | "createdAt" | "updatedAt" | "deletedAt";
export type IArgvColumn<T extends typeof BaseEntity> = IArgvColumns<InstanceType<T>>;
export type IArgvValues<T> = {[P in Exclude<keyof T, keyof BaseEntity>]?: T[P]} |
    {createdAt: Date} | {updatedAt: Date} | {deletedAt: Date};
export type IInstanceValues<T> = {[P in Exclude<keyof T, keyof BaseEntity>]: T[P]} &
    {createdAt: Date, updatedAt: Date, deletedAt: Date};
export type IIdObject<T> = IArgvValues<T> | number | string;

// event
export type IEventType = "create" | "update" | "delete" | "forceDelete" | "restore";
export interface IEvent<T> {
    on(type: IEventType, callback: (entity: T) => void): this;
    addListener(type: IEventType, callback: (entity: T) => void): this;
    removeListener(type: IEventType, callback: (entity: T) => void): this;
    once(type: IEventType, callback: (entity: T) => void): this;
    off(type: IEventType, callback: (entity: T) => void): this;
    emit(type: IEventType, entity: T): void;
}
