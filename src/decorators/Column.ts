import "reflect-metadata";
import {RedisOrmDecoratorError} from "..";
import {serviceInstance} from "../serviceInstance";
import {ISchema, ISchemaBase} from "../types";

function validSchema(target: object, schema: ISchema) {
    // only one schema
    const autoIncrementKey = serviceInstance.getAutoIncrementKey(target);
    if (autoIncrementKey) {
        if (schema.autoIncrement) {
            throw new RedisOrmDecoratorError(`(${(target as any).name}) AutoIncrement already exist for column: ${autoIncrementKey}`);
        }

        if (schema.primary) {
            throw new RedisOrmDecoratorError(`(${(target as any).name}) AutoIncrement can only work with one primary key`);
        }
    }

    if (schema.autoIncrement && !schema.primary) {
        throw new RedisOrmDecoratorError(`(${(target as any).name}) AutoIncrement needs pair up with primary key`);
    }

    if (schema.primary) {
        if (schema.type !== String && schema.type !== Number) {
            throw new RedisOrmDecoratorError(`(${(target as any).name}) Primary key only supports String or Number`);
        }
    }

    if (schema.index) {
        if (schema.type !== Number && schema.type !== Boolean && schema.type !== Date) {
            throw new RedisOrmDecoratorError(`(${(target as any).name}) Index only supports Number, Boolean or Date`);
        }
    }

    if (schema.unique) {
        if (schema.type !== String && schema.type !== Number) {
            throw new RedisOrmDecoratorError(`(${(target as any).name}) Unique only supports String or Number`);
        }
    }
}

export function Column(schema: {[P in keyof ISchemaBase]?: ISchemaBase[P]} = {}) {
    return (target: object, propertyKey: string) => {
        const propertyType = Reflect.getMetadata("design:type", target, propertyKey);
        const propertyType1 = Reflect.getMetadataKeys(target, propertyKey);
        let newSchema: ISchema = {
            type: propertyType,
            primary: false,
            autoIncrement: false,
            index: false,
            unique: false,
        };
        newSchema = Object.assign(newSchema, schema);

        // validate schema
        validSchema(target.constructor, newSchema);

        // everything ok , add the schema
        serviceInstance.addColumn(target.constructor, propertyKey, newSchema);

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
