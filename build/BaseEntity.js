"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var entityExporter_1 = require("./entityExporter");
var RedisOrmEntityError_1 = require("./errors/RedisOrmEntityError");
var RedisOrmSchemaError_1 = require("./errors/RedisOrmSchemaError");
var eventEmitters_1 = require("./eventEmitters");
var parser_1 = require("./parser");
var Query_1 = require("./Query");
var serviceInstance_1 = require("./serviceInstance");
var BaseEntity = /** @class */ (function () {
    function BaseEntity() {
        // endregion
        // region constructor / variables
        // flags
        this._isNew = true;
        // cache the column values
        this._values = {};
        // the actual storage value in redis
        this._storageStrings = {};
        // store the increment commands
        this._increments = {};
        var now = new Date();
        this.createdAt = now;
        this.updatedAt = now;
    }
    // region static methods
    BaseEntity.connect = function () {
        return __awaiter(this, void 0, void 0, function () {
            var redis, schemaErrors;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, serviceInstance_1.serviceInstance.getRedis(this)];
                    case 1:
                        redis = _a.sent();
                        return [4 /*yield*/, serviceInstance_1.serviceInstance.compareSchemas(this)];
                    case 2:
                        schemaErrors = _a.sent();
                        if (schemaErrors.length) {
                            throw new RedisOrmSchemaError_1.RedisOrmSchemaError("(" + this.name + ") Invalid Schemas", schemaErrors);
                        }
                        return [2 /*return*/, redis];
                }
            });
        });
    };
    BaseEntity.newFromStorageStrings = function (storageStrings) {
        var entity = this.create({});
        entity.assignStorageStrings(storageStrings);
        return entity;
    };
    BaseEntity.query = function () {
        return new Query_1.Query(this);
    };
    BaseEntity.find = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.query().find(id)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    BaseEntity.findMany = function (idObjects) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.query().findMany(idObjects)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    BaseEntity.create = function (values) {
        return new this().set(values);
    };
    BaseEntity.all = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.query().get()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    BaseEntity.count = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.query().count()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    // get the current redis instance, do not use internally
    BaseEntity.getRedis = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, serviceInstance_1.serviceInstance.getRedis(this, false)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    BaseEntity.resyncDb = function () {
        return __awaiter(this, void 0, void 0, function () {
            var redis, remoteSchemas, tableName, keys, params, commandResult, saveResult;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, serviceInstance_1.serviceInstance.getRedis(this)];
                    case 1:
                        redis = _a.sent();
                        return [4 /*yield*/, serviceInstance_1.serviceInstance.getRemoteSchemas(this, redis)];
                    case 2:
                        remoteSchemas = _a.sent();
                        if (!remoteSchemas) return [3 /*break*/, 4];
                        tableName = serviceInstance_1.serviceInstance.getTable(this);
                        keys = [];
                        params = [
                            serviceInstance_1.serviceInstance.getSchemasJson(this),
                            tableName,
                        ];
                        return [4 /*yield*/, redis.commandAtomicResyncDb(keys, params)];
                    case 3:
                        commandResult = _a.sent();
                        saveResult = JSON.parse(commandResult);
                        if (saveResult.error) {
                            throw new RedisOrmEntityError_1.RedisOrmEntityError("(" + this.name + ") " + saveResult.error);
                        }
                        _a.label = 4;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    BaseEntity.truncate = function (className) {
        return __awaiter(this, void 0, void 0, function () {
            var redis, remoteSchemas, tableName, keys, params;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (className !== this.name) {
                            throw new RedisOrmEntityError_1.RedisOrmEntityError("(" + this.name + ") You need to provide the class name for truncate");
                        }
                        return [4 /*yield*/, serviceInstance_1.serviceInstance.getRedis(this)];
                    case 1:
                        redis = _a.sent();
                        return [4 /*yield*/, serviceInstance_1.serviceInstance.getRemoteSchemas(this, redis)];
                    case 2:
                        remoteSchemas = _a.sent();
                        if (!remoteSchemas) return [3 /*break*/, 4];
                        tableName = serviceInstance_1.serviceInstance.getTable(this);
                        keys = [];
                        params = [
                            tableName,
                        ];
                        // remove everything
                        return [4 /*yield*/, redis.commandAtomicTruncate(keys, params)];
                    case 3:
                        // remove everything
                        _a.sent();
                        _a.label = 4;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    BaseEntity.getEventEmitter = function () {
        return eventEmitters_1.eventEmitters.getEventEmitter(this);
    };
    // endregion
    // region static method: import/export
    BaseEntity.export = function (file) {
        return __awaiter(this, void 0, void 0, function () {
            var all, allDeleted;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.all()];
                    case 1:
                        all = _a.sent();
                        return [4 /*yield*/, this.query().onlyDeleted().get()];
                    case 2:
                        allDeleted = _a.sent();
                        return [4 /*yield*/, this.exportEntities(__spreadArrays(all, allDeleted), file)];
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    BaseEntity.exportEntities = function (entities, file) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, entityExporter_1.entityExporter.exportEntities(this, entities, file)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    BaseEntity.getImportFileMeta = function () {
        //
    };
    BaseEntity.import = function (file, skipSchemasCheck) {
        if (skipSchemasCheck === void 0) { skipSchemasCheck = false; }
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, entityExporter_1.entityExporter.import(this, file, skipSchemasCheck)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    Object.defineProperty(BaseEntity.prototype, "isDeleted", {
        // endregion
        // region public get properties: conditions
        get: function () {
            return !isNaN(Number(this._storageStrings.deletedAt));
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(BaseEntity.prototype, "isNew", {
        get: function () {
            return this._isNew;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(BaseEntity.prototype, "createdAt", {
        // endregion
        // region public properties: createdAt, updatedAt, deletedAt
        get: function () {
            return this._get("createdAt");
        },
        set: function (value) {
            this._set("createdAt", value);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(BaseEntity.prototype, "updatedAt", {
        get: function () {
            return this._get("updatedAt");
        },
        set: function (value) {
            this._set("updatedAt", value);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(BaseEntity.prototype, "deletedAt", {
        get: function () {
            return this._get("deletedAt");
        },
        set: function (value) {
            this._set("deletedAt", value);
        },
        enumerable: true,
        configurable: true
    });
    // endregion
    // region public methods
    BaseEntity.prototype.getEntityId = function () {
        var primaryKeys = serviceInstance_1.serviceInstance.getPrimaryKeys(this.constructor).sort();
        var values = [];
        for (var _i = 0, primaryKeys_1 = primaryKeys; _i < primaryKeys_1.length; _i++) {
            var column = primaryKeys_1[_i];
            var value = this._get(column);
            if (typeof value === "number") {
                if (value && Number.isInteger(value)) {
                    values.push(value.toString().replace(/:/g, ""));
                }
                else {
                    throw new RedisOrmEntityError_1.RedisOrmEntityError("(" + this.constructor.name + ") Invalid number value: " + value + " for primary key: " + column);
                }
            }
            else if (typeof value === "string") {
                if (value) {
                    values.push(value.replace(/:/g, ""));
                }
                else {
                    throw new RedisOrmEntityError_1.RedisOrmEntityError("(" + this.constructor.name + ") Invalid string value: '" + value + "' for primary key: " + column);
                }
            }
            else {
                throw new RedisOrmEntityError_1.RedisOrmEntityError("(" + this.constructor.name + ") Invalid value: " + value + " for primary key: " + column);
            }
        }
        return values.join(":");
    };
    BaseEntity.prototype.getValues = function () {
        var values = {};
        var columns = serviceInstance_1.serviceInstance.getColumns(this.constructor);
        for (var _i = 0, columns_1 = columns; _i < columns_1.length; _i++) {
            var column = columns_1[_i];
            values[column] = this._get(column);
        }
        return values;
    };
    BaseEntity.prototype.increment = function (column, value) {
        if (value === void 0) { value = 1; }
        if (this.isNew) {
            throw new RedisOrmEntityError_1.RedisOrmEntityError("(" + this.constructor.name + ") You cannot increment a new entity");
        }
        if (serviceInstance_1.serviceInstance.isPrimaryKey(this.constructor, column)) {
            throw new RedisOrmEntityError_1.RedisOrmEntityError("(" + this.constructor.name + ") You cannot increment primary key");
        }
        if (serviceInstance_1.serviceInstance.isUniqueKey(this.constructor, column)) {
            throw new RedisOrmEntityError_1.RedisOrmEntityError("(" + this.constructor.name + ") You cannot increment unique key");
        }
        if (!serviceInstance_1.serviceInstance.isNumberColumn(this.constructor, column)) {
            throw new RedisOrmEntityError_1.RedisOrmEntityError("(" + this.constructor.name + ") Column need to be in the type of Number");
        }
        if (!Number.isInteger(value)) {
            throw new RedisOrmEntityError_1.RedisOrmEntityError("(" + this.constructor.name + ") Increment value need to be an integer");
        }
        this._increments[column] = value;
        return this;
    };
    BaseEntity.prototype.set = function (values) {
        Object.assign(this, values);
        return this;
    };
    BaseEntity.prototype.save = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this._saveInternal()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    BaseEntity.prototype.delete = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this._deleteInternal({ forceDelete: false })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    BaseEntity.prototype.forceDelete = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this._deleteInternal({ forceDelete: true })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    BaseEntity.prototype.restore = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this._saveInternal({ isRestore: true })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    BaseEntity.prototype.clone = function () {
        var entity = new this.constructor();
        entity.set(this.getValues());
        return entity;
    };
    BaseEntity.prototype.toJSON = function () {
        return this.getValues();
    };
    // endregion
    // region protected methods
    BaseEntity.prototype.assignStorageStrings = function (storageStrings) {
        this._isNew = false;
        this._storageStrings = storageStrings;
        // we preserve default values by removing existing _values only
        for (var _i = 0, _a = Object.keys(storageStrings); _i < _a.length; _i++) {
            var column = _a[_i];
            delete this._values[column];
        }
    };
    // endregion
    // region private methods: value get / set
    BaseEntity.prototype._get = function (column) {
        if (!(column in this._values)) {
            var schema = serviceInstance_1.serviceInstance.getSchema(this.constructor, column);
            this._values[column] = parser_1.parser.parseStorageStringToValue(schema.type, this._storageStrings[column]);
        }
        return this._values[column];
    };
    BaseEntity.prototype._set = function (column, value, updateStorageString) {
        if (updateStorageString === void 0) { updateStorageString = false; }
        var schema = serviceInstance_1.serviceInstance.getSchema(this.constructor, column);
        var storageString = parser_1.parser.parseValueToStorageString(schema.type, value);
        this._values[column] = parser_1.parser.parseStorageStringToValue(schema.type, storageString);
        if (updateStorageString) {
            this._storageStrings[column] = storageString;
        }
    };
    // endregion
    // region private methods: common
    BaseEntity.prototype._saveInternal = function (_a) {
        var _b = (_a === void 0 ? {} : _a).isRestore, isRestore = _b === void 0 ? false : _b;
        return __awaiter(this, void 0, void 0, function () {
            var changes, tableName, indexKeys, uniqueKeys, autoIncrementKey, entityId, params, redis, commandResult, saveResult, schemaErrors, _i, _c, _d, column, value, isNew;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        if (this.isDeleted && !isRestore) {
                            throw new RedisOrmEntityError_1.RedisOrmEntityError("(" + this.constructor.name + ") You cannot update a deleted entity");
                        }
                        changes = this._getChanges();
                        if (Object.keys(changes).length === 0) {
                            // no changes and no increments, no need to save
                            if (!isRestore && Object.keys(this._increments).length === 0) {
                                return [2 /*return*/, this];
                            }
                        }
                        // update updatedAt if user didn't update it explicitly
                        if (!changes.updatedAt) {
                            changes.updatedAt = parser_1.parser.parseValueToStorageString(Date, new Date());
                        }
                        // remove deletedAt for all situation
                        changes.deletedAt = parser_1.parser.parseValueToStorageString(Date, new Date(Number.NaN));
                        tableName = serviceInstance_1.serviceInstance.getTable(this.constructor);
                        indexKeys = serviceInstance_1.serviceInstance.getIndexKeys(this.constructor);
                        uniqueKeys = serviceInstance_1.serviceInstance.getUniqueKeys(this.constructor);
                        autoIncrementKey = serviceInstance_1.serviceInstance.getAutoIncrementKey(this.constructor);
                        entityId = "";
                        // we must assign an entity id for the following case
                        // - if it's not new
                        // - if it's not auto increment
                        // - if the auto increment key is not 0
                        if (!this.isNew || !autoIncrementKey || changes[autoIncrementKey] !== "0") {
                            entityId = this.getEntityId();
                        }
                        params = [
                            serviceInstance_1.serviceInstance.getSchemasJson(this.constructor),
                            entityId,
                            this.isNew,
                            tableName,
                            autoIncrementKey,
                            JSON.stringify(indexKeys),
                            JSON.stringify(uniqueKeys),
                            JSON.stringify(changes),
                            JSON.stringify(this._increments),
                            isRestore,
                        ];
                        return [4 /*yield*/, serviceInstance_1.serviceInstance.getRedis(this.constructor)];
                    case 1:
                        redis = _e.sent();
                        return [4 /*yield*/, redis.commandAtomicSave([], params)];
                    case 2:
                        commandResult = _e.sent();
                        saveResult = JSON.parse(commandResult);
                        if (!saveResult.error) return [3 /*break*/, 5];
                        if (!(saveResult.error === "Invalid Schemas")) return [3 /*break*/, 4];
                        return [4 /*yield*/, serviceInstance_1.serviceInstance.compareSchemas(this.constructor)];
                    case 3:
                        schemaErrors = _e.sent();
                        throw new RedisOrmSchemaError_1.RedisOrmSchemaError("(" + this.constructor.name + ") " + saveResult.error, schemaErrors);
                    case 4: throw new RedisOrmEntityError_1.RedisOrmEntityError("(" + this.constructor.name + ") " + saveResult.error);
                    case 5:
                        // update storage strings
                        Object.assign(this._storageStrings, changes);
                        // if we do not have id and it's auto increment
                        if (this.isNew && autoIncrementKey && saveResult.autoIncrementKeyValue) {
                            this._set(autoIncrementKey, saveResult.autoIncrementKeyValue, true);
                        }
                        // if we have increment result
                        if (saveResult.increments) {
                            for (_i = 0, _c = Object.entries(saveResult.increments); _i < _c.length; _i++) {
                                _d = _c[_i], column = _d[0], value = _d[1];
                                this._set(column, value, true);
                            }
                        }
                        // clean up
                        this._increments = {};
                        this._values = {};
                        isNew = this._isNew;
                        this._isNew = false;
                        // fire event
                        if (isRestore) {
                            eventEmitters_1.eventEmitters.getEventEmitter(this.constructor).emit("restore", this);
                        }
                        else {
                            if (isNew) {
                                eventEmitters_1.eventEmitters.getEventEmitter(this.constructor).emit("create", this);
                            }
                            else {
                                eventEmitters_1.eventEmitters.getEventEmitter(this.constructor).emit("update", this);
                            }
                        }
                        return [2 /*return*/, this];
                }
            });
        });
    };
    BaseEntity.prototype._deleteInternal = function (_a) {
        var _b = (_a === void 0 ? {} : _a).forceDelete, forceDelete = _b === void 0 ? false : _b;
        return __awaiter(this, void 0, void 0, function () {
            var entityMeta, deletedAt, entityId, tableName, indexKeys, uniqueKeys, keys, params, redis, commandResult, saveResult;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        // checking
                        if (this.isNew) {
                            throw new RedisOrmEntityError_1.RedisOrmEntityError("(" + this.constructor.name + ") You cannot delete a new entity");
                        }
                        entityMeta = serviceInstance_1.serviceInstance.getEntityMeta(this.constructor);
                        if (!forceDelete && this.isDeleted) {
                            throw new RedisOrmEntityError_1.RedisOrmEntityError("(" + this.constructor.name + ") You cannot delete a deleted entity");
                        }
                        deletedAt = this.deletedAt;
                        if (isNaN(deletedAt.getTime())) {
                            deletedAt = new Date();
                        }
                        entityId = this.getEntityId();
                        tableName = serviceInstance_1.serviceInstance.getTable(this.constructor);
                        indexKeys = serviceInstance_1.serviceInstance.getIndexKeys(this.constructor);
                        uniqueKeys = serviceInstance_1.serviceInstance.getUniqueKeys(this.constructor);
                        keys = [];
                        params = [
                            serviceInstance_1.serviceInstance.getSchemasJson(this.constructor),
                            entityId,
                            !forceDelete,
                            tableName,
                            deletedAt.getTime(),
                            JSON.stringify(indexKeys),
                            JSON.stringify(uniqueKeys),
                        ];
                        return [4 /*yield*/, serviceInstance_1.serviceInstance.getRedis(this.constructor)];
                    case 1:
                        redis = _c.sent();
                        return [4 /*yield*/, redis.commandAtomicDelete(keys, params)];
                    case 2:
                        commandResult = _c.sent();
                        saveResult = JSON.parse(commandResult);
                        // throw error if there is any
                        if (saveResult.error) {
                            throw new RedisOrmEntityError_1.RedisOrmEntityError("(" + this.constructor.name + ") " + saveResult.error);
                        }
                        // update deleted At
                        this._set("deletedAt", deletedAt, true);
                        // fire event
                        if (forceDelete) {
                            eventEmitters_1.eventEmitters.getEventEmitter(this.constructor).emit("forceDelete", this);
                        }
                        else {
                            eventEmitters_1.eventEmitters.getEventEmitter(this.constructor).emit("delete", this);
                        }
                        return [2 /*return*/, this];
                }
            });
        });
    };
    BaseEntity.prototype._getChanges = function () {
        var hasChanges = false;
        var changes = {};
        var schemas = serviceInstance_1.serviceInstance.getSchemas(this.constructor);
        for (var _i = 0, _a = Object.entries(schemas); _i < _a.length; _i++) {
            var _b = _a[_i], column = _b[0], schema = _b[1];
            // if no such value before, it must be a changes
            var currentValue = this._get(column);
            var storageString = parser_1.parser.parseValueToStorageString(schema.type, currentValue);
            if (!(column in this._storageStrings) || storageString !== this._storageStrings[column]) {
                changes[column] = storageString;
                hasChanges = true;
            }
        }
        return changes;
    };
    return BaseEntity;
}());
exports.BaseEntity = BaseEntity;
