import "reflect-metadata";
import {log} from "util";
import {RedisOrmDecoratorError} from "..";
import {redisOrm} from "../redisOrm";
import {IEntityColumn, IEntityColumnBase} from "../types";

function validEntityColumn(target: object, name: string, entityColumn: IEntityColumn) {
    if (entityColumn.primary) {
        if (entityColumn.type !== String && entityColumn.type !== Number) {
            throw new RedisOrmDecoratorError(`(${(target as any).name}) Primary key only supports String or Number`);
        }

        if (entityColumn.unique) {
            throw new RedisOrmDecoratorError(`(${(target as any).name}) Primary key should not be set to unique`);
        }
    }

    if (entityColumn.autoIncrement && !entityColumn.primary) {
        throw new RedisOrmDecoratorError(`(${(target as any).name}) AutoIncrement can be applied on primary key only`);
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

    if (name === "createdAt") {
        throw new RedisOrmDecoratorError(`(${(target as any).name}) createdAt is a preserved column name`);
    }
}

export function Column(entityColumn: {[P in keyof IEntityColumnBase]?: IEntityColumnBase[P]} = {}) {
    return (target: object, column: string) => {
        const propertyType = Reflect.getMetadata("design:type", target, column);
        let newEntityColumn: IEntityColumn = {
            type: propertyType,
            primary: column === "id",
            autoIncrement: false,
            index: false,
            unique: false,
        };
        newEntityColumn = Object.assign(newEntityColumn, entityColumn);

        // validate column
        validEntityColumn(target.constructor, column, newEntityColumn);

        // everything ok , add the column
        redisOrm.addColumn(target.constructor, column, newEntityColumn);

        // define getter / setter
        if (!Object.getOwnPropertyDescriptor(target.constructor.prototype, column)) {
            Object.defineProperty(target.constructor.prototype, column, {
                get() {
                    return this._get(column);
                },
                set(value) {
                    return this._set(column, value);
                },
            });
        }
    };
}
