import "reflect-metadata";
import {RedisOrmDecoratorError} from "..";
import {redisOrm} from "../redisOrm";
import {IEntityColumn, IEntityColumnBase} from "../types";

function validEntityColumn(target: object, entityColumn: IEntityColumn) {
    // only one increment key
    const autoIncrementKey = redisOrm.getAutoIncrementKey(target);
    if (autoIncrementKey) {
        if (entityColumn.autoIncrement) {
            throw new RedisOrmDecoratorError(`(${(target as any).name}) AutoIncrement already exist for column: ${autoIncrementKey}`);
        }

        if (entityColumn.primary) {
            throw new RedisOrmDecoratorError(`(${(target as any).name}) AutoIncrement can only work with one primary key`);
        }
    }

    if (entityColumn.autoIncrement && !entityColumn.primary) {
        throw new RedisOrmDecoratorError(`(${(target as any).name}) AutoIncrement needs pair up with primary key`);
    }

    if (entityColumn.primary) {
        if (entityColumn.type !== String && entityColumn.type !== Number) {
            throw new RedisOrmDecoratorError(`(${(target as any).name}) Primary key only supports String or Number`);
        }
    }

    if (entityColumn.index) {
        if (entityColumn.type !== Number && entityColumn.type !== Boolean && entityColumn.type !== Date) {
            throw new RedisOrmDecoratorError(`(${(target as any).name}) Index only supports Number, Boolean or Date`);
        }
    }

    if (entityColumn.unique) {
        if (entityColumn.type !== String && entityColumn.type !== Number) {
            throw new RedisOrmDecoratorError(`(${(target as any).name}) Unique only supports String or Number`);
        }
    }
}

export function Column(entityColumn: {[P in keyof IEntityColumnBase]?: IEntityColumnBase[P]} = {}) {
    return (target: object, propertyKey: string) => {
        const propertyType = Reflect.getMetadata("design:type", target, propertyKey);
        let newEntityColumn: IEntityColumn = {
            type: propertyType,
            primary: false,
            autoIncrement: false,
            index: false,
            unique: false,
        };
        newEntityColumn = Object.assign(newEntityColumn, entityColumn);

        // validate column
        validEntityColumn(target.constructor, newEntityColumn);

        // everything ok , add the column
        redisOrm.addColumn(target.constructor, propertyKey, newEntityColumn);

        // define getter / setter
        if (!Object.getOwnPropertyDescriptor(target.constructor.prototype, propertyKey)) {
            Object.defineProperty(target.constructor.prototype, propertyKey, {
                get() {
                    return this._get(propertyKey);
                },
                set(value) {
                    return this._set(propertyKey, value);
                },
            });
        }
    };
}
