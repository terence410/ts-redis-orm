"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var __1 = require("..");
var metaInstance_1 = require("../metaInstance");
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
        metaInstance_1.metaInstance.addEntity(target, newEntityMeta);
        // add createdAt, updatedAt and deletedAt
        var schema = {
            type: Date,
            primary: false,
            autoIncrement: false,
            index: true,
            unique: false,
        };
        metaInstance_1.metaInstance.addColumn(target, "createdAt", schema);
        metaInstance_1.metaInstance.addColumn(target, "updatedAt", Object.assign(schema, { index: newEntityMeta.indexUpdatedAt }));
        metaInstance_1.metaInstance.addColumn(target, "deletedAt", schema);
        // validate from entity
        var primaryKeys = metaInstance_1.metaInstance.getPrimaryKeys(target);
        if (primaryKeys.length === 0) {
            throw new __1.RedisOrmDecoratorError("No primary keys exist for this entity");
        }
    };
}
exports.Entity = Entity;
