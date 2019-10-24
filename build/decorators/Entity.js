"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var __1 = require("..");
var serviceInstance_1 = require("../serviceInstance");
function Entity(entityMeta) {
    if (entityMeta === void 0) { entityMeta = {}; }
    return function (target) {
        // add entity meta
        var newEntityMeta = {
            table: "",
            connection: "default",
            indexUpdatedAt: true,
            redisMaster: null,
        };
        newEntityMeta = Object.assign(newEntityMeta, entityMeta);
        serviceInstance_1.serviceInstance.addEntity(target, newEntityMeta);
        // add createdAt, updatedAt and deletedAt
        var schema = {
            type: Date,
            primary: false,
            autoIncrement: false,
            index: true,
            unique: false,
        };
        serviceInstance_1.serviceInstance.addColumn(target, "createdAt", schema);
        serviceInstance_1.serviceInstance.addColumn(target, "updatedAt", __assign(__assign({}, schema), { index: newEntityMeta.indexUpdatedAt }));
        serviceInstance_1.serviceInstance.addColumn(target, "deletedAt", schema);
        // validate from entity
        var primaryKeys = serviceInstance_1.serviceInstance.getPrimaryKeys(target);
        if (primaryKeys.length === 0) {
            throw new __1.RedisOrmDecoratorError("(" + target.name + ") No primary keys exist for this entity");
        }
    };
}
exports.Entity = Entity;
