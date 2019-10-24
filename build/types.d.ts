import * as IORedis from "ioredis";
import { BaseEntity } from "./BaseEntity";
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
export declare type IIndexOperator = ">" | ">=" | "<" | "<=" | "=";
export declare type IStringOperator = "=" | "!=" | "like";
export declare type IValueType = string | number | boolean | Date | null;
export declare type IUniqueValueType = string | number;
export declare type IDateValueType = Date | number;
export declare type IOrder = "asc" | "desc";
export declare type IAggregateObject = {
    [key: string]: number;
};
export declare type IWhereStringType = {
    operator: IStringOperator;
    value: string;
};
export declare type IWhereIndexType = {
    min: string;
    max: string;
};
export declare type ISaveResult = {
    error: string;
    entityId: string;
    autoIncrementKeyValue: number;
    increments: number[];
};
export declare type IInstanceColumn<T> = Exclude<keyof T, keyof BaseEntity> | "createdAt" | "updatedAt" | "deletedAt";
export declare type IArgColumn<T extends typeof BaseEntity> = IInstanceColumn<InstanceType<T>>;
export declare type IArgValues<T> = {
    [P in Exclude<keyof T, keyof BaseEntity>]?: T[P];
} | {
    createdAt: Date;
} | {
    updatedAt: Date;
} | {
    deletedAt: Date;
};
export declare type IInstanceValues<T> = {
    [P in Exclude<keyof T, keyof BaseEntity>]: T[P];
} & {
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date;
};
export declare type IIdObject<T> = IArgValues<T> | number | string;
export declare type IEventType = "create" | "update" | "delete" | "forceDelete" | "restore";
export interface IEvent<T> {
    on(type: IEventType, callback: (entity: T) => void): any;
    addListener(type: IEventType, callback: (entity: T) => void): any;
    removeListener(type: IEventType, callback: (entity: T) => void): any;
    once(type: IEventType, callback: (entity: T) => void): any;
    off(type: IEventType, callback: (entity: T) => void): any;
    emit(type: IEventType, entity: T): any;
}
