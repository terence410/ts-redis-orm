"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
var __1 = require("..");
var serviceInstance_1 = require("../serviceInstance");
function validSchema(target, schema) {
    // only one schema
    var autoIncrementKey = serviceInstance_1.serviceInstance.getAutoIncrementKey(target);
    if (autoIncrementKey) {
        if (schema.autoIncrement) {
            throw new __1.RedisOrmDecoratorError("(" + target.name + ") AutoIncrement already exist for column: " + autoIncrementKey);
        }
        if (schema.primary) {
            throw new __1.RedisOrmDecoratorError("(" + target.name + ") AutoIncrement can only work with one primary key");
        }
    }
    if (schema.autoIncrement && !schema.primary) {
        throw new __1.RedisOrmDecoratorError("(" + target.name + ") AutoIncrement needs pair up with primary key");
    }
    if (schema.primary) {
        if (schema.type !== String && schema.type !== Number) {
            throw new __1.RedisOrmDecoratorError("(" + target.name + ") Primary key only supports String or Number");
        }
    }
    if (schema.index) {
        if (schema.type !== Number && schema.type !== Boolean && schema.type !== Date) {
            throw new __1.RedisOrmDecoratorError("(" + target.name + ") Index only supports Number, Boolean or Date");
        }
    }
    if (schema.unique) {
        if (schema.type !== String && schema.type !== Number) {
            throw new __1.RedisOrmDecoratorError("(" + target.name + ") Unique only supports String or Number");
        }
    }
}
function Column(schema) {
    if (schema === void 0) { schema = {}; }
    return function (target, propertyKey) {
        var propertyType = Reflect.getMetadata("design:type", target, propertyKey);
        var propertyType1 = Reflect.getMetadataKeys(target, propertyKey);
        var newSchema = {
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
        serviceInstance_1.serviceInstance.addColumn(target.constructor, propertyKey, newSchema);
        // define getter / setter
        if (!Object.getOwnPropertyDescriptor(target.constructor.prototype, propertyKey)) {
            Object.defineProperty(target.constructor.prototype, propertyKey, {
                get: function () {
                    return this._get(propertyKey);
                },
                set: function (value) {
                    return this._set(propertyKey, value);
                },
            });
        }
    };
}
exports.Column = Column;
