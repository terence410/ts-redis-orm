/// <reference types="ioredis" />
import { Query } from "./Query";
import { IArgValues, IEvent, IIdObject, IInstanceValues } from "./types";
export declare class BaseEntity {
    static connect(): Promise<import("ioredis").Redis>;
    static newFromStorageStrings<T extends typeof BaseEntity>(this: T, storageStrings: {
        [key: string]: string;
    }): InstanceType<T>;
    static query<T extends typeof BaseEntity>(this: T): Query<T>;
    static find<T extends typeof BaseEntity>(this: T, id: IIdObject<InstanceType<T>>): Promise<InstanceType<T> | undefined>;
    static findMany<T extends typeof BaseEntity>(this: T, idObjects: Array<IIdObject<InstanceType<T>>>): Promise<Array<InstanceType<T>>>;
    static create<T extends typeof BaseEntity>(this: T, values: IArgValues<InstanceType<T>>): InstanceType<T>;
    static all<T extends typeof BaseEntity>(this: T): Promise<Array<InstanceType<T>>>;
    static count(): Promise<number>;
    static getRedis(): Promise<import("ioredis").Redis>;
    static resyncDb<T extends typeof BaseEntity>(this: T): Promise<void>;
    static truncate(className: string): Promise<void>;
    static getEventEmitter<T extends typeof BaseEntity>(this: T): IEvent<InstanceType<T>>;
    static export(file: string): Promise<void>;
    static exportEntities<T extends BaseEntity>(entities: T[], file: string): Promise<void>;
    static getImportFileMeta(): void;
    static import(file: string, skipSchemasCheck?: boolean): Promise<void>;
    private _isNew;
    private _values;
    private _storageStrings;
    private _increments;
    constructor();
    readonly isDeleted: boolean;
    readonly isNew: boolean;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date;
    getEntityId(): string;
    getValues<T extends BaseEntity>(this: T): IInstanceValues<T>;
    increment<T extends BaseEntity>(this: T, column: keyof T, value?: number): T;
    set<T extends BaseEntity>(this: T, values: IArgValues<T>): T;
    save(): Promise<this>;
    delete(): Promise<this>;
    forceDelete(): Promise<this>;
    restore(): Promise<this>;
    clone(): this;
    toJSON(): IInstanceValues<this>;
    protected assignStorageStrings(storageStrings: {
        [key: string]: string;
    }): void;
    private _get;
    private _set;
    private _saveInternal;
    private _deleteInternal;
    private _getChanges;
}
