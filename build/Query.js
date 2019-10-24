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
var RedisOrmQueryError_1 = require("./errors/RedisOrmQueryError");
var parser_1 = require("./parser");
var serviceInstance_1 = require("./serviceInstance");
var Query = /** @class */ (function () {
    function Query(_entityType) {
        this._entityType = _entityType;
        this._onlyDeleted = false;
        this._offset = 0;
        this._limit = -1;
        this._whereSearches = {};
        this._whereIndexes = {};
        this._sortBy = null;
        this._groupByColumn = null;
        this._groupByDateFormat = ""; // this is experimental feature
    }
    // region find
    Query.prototype.find = function (idObject) {
        return __awaiter(this, void 0, void 0, function () {
            var entityId, primaryKeys, entityStorageKey, redis, storageStrings_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        entityId = serviceInstance_1.serviceInstance.convertAsEntityId(this._entityType, idObject);
                        primaryKeys = serviceInstance_1.serviceInstance.getPrimaryKeys(this._entityType);
                        if (!entityId) return [3 /*break*/, 3];
                        entityStorageKey = serviceInstance_1.serviceInstance.getEntityStorageKey(this._entityType, entityId);
                        if (!entityStorageKey) {
                            throw new RedisOrmQueryError_1.RedisOrmQueryError("(" + this._entityType.name + ") Invalid id " + JSON.stringify(idObject));
                        }
                        return [4 /*yield*/, this._getRedis()];
                    case 1:
                        redis = _a.sent();
                        return [4 /*yield*/, redis.hgetall(entityStorageKey)];
                    case 2:
                        storageStrings_1 = _a.sent();
                        if (primaryKeys.every(function (primaryKey) { return primaryKey in storageStrings_1; })) {
                            if ((storageStrings_1.deletedAt !== "NaN") === this._onlyDeleted) {
                                return [2 /*return*/, this._entityType.newFromStorageStrings(storageStrings_1)];
                            }
                        }
                        _a.label = 3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    Query.prototype.findMany = function (idObjects) {
        return __awaiter(this, void 0, void 0, function () {
            var promises, _i, idObjects_1, idObject, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        promises = [];
                        for (_i = 0, idObjects_1 = idObjects; _i < idObjects_1.length; _i++) {
                            idObject = idObjects_1[_i];
                            promises.push(this.find(idObject));
                        }
                        return [4 /*yield*/, Promise.all(promises)];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.filter(function (x) { return x; })];
                }
            });
        });
    };
    Query.prototype.findUnique = function (column, value) {
        return __awaiter(this, void 0, void 0, function () {
            var redis, id;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!serviceInstance_1.serviceInstance.isUniqueKey(this._entityType, column)) {
                            throw new RedisOrmQueryError_1.RedisOrmQueryError("(" + this._entityType.name + ") Invalid unique column: " + column);
                        }
                        return [4 /*yield*/, this._getRedis()];
                    case 1:
                        redis = _a.sent();
                        return [4 /*yield*/, redis.hget(serviceInstance_1.serviceInstance.getUniqueStorageKey(this._entityType, column), value.toString())];
                    case 2:
                        id = _a.sent();
                        if (!id) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.find(id)];
                    case 3: return [2 /*return*/, _a.sent()];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    Query.prototype.findUniqueMany = function (column, values) {
        return __awaiter(this, void 0, void 0, function () {
            var promises, _i, values_1, value, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        promises = [];
                        for (_i = 0, values_1 = values; _i < values_1.length; _i++) {
                            value = values_1[_i];
                            promises.push(this.findUnique(column, value));
                        }
                        return [4 /*yield*/, Promise.all(promises)];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.filter(function (x) { return x; })];
                }
            });
        });
    };
    // endregion
    // region take
    Query.prototype.first = function () {
        return __awaiter(this, void 0, void 0, function () {
            var entities;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.offset(0);
                        this.limit(1);
                        return [4 /*yield*/, this.get()];
                    case 1:
                        entities = _a.sent();
                        return [2 /*return*/, entities.length ? entities[0] : undefined];
                }
            });
        });
    };
    Query.prototype.get = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this._get()];
            });
        });
    };
    Query.prototype.where = function (column, operator, value) {
        var columnString = column;
        if (serviceInstance_1.serviceInstance.isIndexKey(this._entityType, columnString)) {
            if (this._onlyDeleted) {
                throw new RedisOrmQueryError_1.RedisOrmQueryError("(" + this._entityType.name + ") You cannot apply extra where indexing clause for only deleted query");
            }
            if (!serviceInstance_1.serviceInstance.isIndexKey(this._entityType, columnString)) {
                throw new RedisOrmQueryError_1.RedisOrmQueryError("(" + this._entityType.name + ") Invalid index column: " + column);
            }
            // convert value into string value
            if (value !== "-inf" && value !== "+inf") {
                var schema = serviceInstance_1.serviceInstance.getSchema(this._entityType, columnString);
                value = parser_1.parser.parseValueToStorageString(schema.type, value);
            }
            var whereIndexType = { min: "-inf", max: "+inf" };
            if (columnString in this._whereIndexes) {
                whereIndexType = this._whereIndexes[columnString];
            }
            switch (operator) {
                case "=":
                    whereIndexType.min = value;
                    whereIndexType.max = value;
                    break;
                case ">=":
                    whereIndexType.min = value;
                    break;
                case "<=":
                    whereIndexType.max = value;
                    break;
                case ">":
                    whereIndexType.min = "(" + value;
                    break;
                case "<":
                    whereIndexType.max = "(" + value;
                    break;
                default:
                    throw new RedisOrmQueryError_1.RedisOrmQueryError("(" + this._entityType.name + ") Invalid operator (" + operator + ") for index column: " + column);
            }
            this._whereIndexes[columnString] = whereIndexType;
        }
        else if (serviceInstance_1.serviceInstance.isSearchableColumn(this._entityType, columnString)) {
            if (!["=", "!=", "like"].includes(operator)) {
                throw new RedisOrmQueryError_1.RedisOrmQueryError("(" + this._entityType.name + ") Invalid operator (" + operator + ") for non index column: " + column);
            }
            // convert value into string value
            var schema = serviceInstance_1.serviceInstance.getSchema(this._entityType, columnString);
            value = parser_1.parser.parseValueToStorageString(schema.type, value);
            this._whereSearches[columnString] = { operator: operator, value: value };
        }
        else {
            throw new RedisOrmQueryError_1.RedisOrmQueryError("(" + this._entityType.name + ") Invalid search column: " + column);
        }
        return this;
    };
    Query.prototype.onlyDeleted = function () {
        if (Object.keys(this._whereIndexes).length > 0) {
            throw new RedisOrmQueryError_1.RedisOrmQueryError("(" + this._entityType.name + ") You cannot apply extra where indexing clause for only deleted query");
        }
        this.where("deletedAt", "<=", "+inf");
        this.where("deletedAt", ">=", "-inf");
        this._onlyDeleted = true;
        return this;
    };
    Query.prototype.sortBy = function (column, order) {
        if (this._sortBy !== null) {
            throw new RedisOrmQueryError_1.RedisOrmQueryError("(" + this._entityType.name + ") You can only order by 1 column");
        }
        if (!serviceInstance_1.serviceInstance.isSortableColumn(this._entityType, column)) {
            throw new RedisOrmQueryError_1.RedisOrmQueryError("(" + this._entityType.name + ") Not sortable Column: " + column + ". You can only sort column type of Number, Boolean or Date");
        }
        this._sortBy = { column: column, order: order };
        return this;
    };
    Query.prototype.offset = function (value) {
        this._offset = value;
        return this;
    };
    Query.prototype.limit = function (value) {
        this._limit = value;
        return this;
    };
    Query.prototype.take = function (value) {
        this._limit = value;
        this._offset = 0;
        return this;
    };
    Query.prototype.groupBy = function (column) {
        if (this._groupByColumn !== null) {
            throw new RedisOrmQueryError_1.RedisOrmQueryError("(" + this._entityType.name + ") You can only group by 1 column");
        }
        if (!serviceInstance_1.serviceInstance.isValidColumn(this._entityType, column)) {
            throw new RedisOrmQueryError_1.RedisOrmQueryError("(" + this._entityType.name + ") Invalid column: " + column);
        }
        this._groupByColumn = column;
        return this;
    };
    // endregion
    // region aggregate
    Query.prototype.count = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this._aggregate("count", "")];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    Query.prototype.min = function (column) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this._aggregate("min", column)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    Query.prototype.max = function (column) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this._aggregate("max", column)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    Query.prototype.sum = function (column) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this._aggregate("sum", column)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    Query.prototype.avg = function (column) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this._aggregate("avg", column)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    // endregion
    // region: rank
    Query.prototype.rank = function (column, idObject, isReverse) {
        if (isReverse === void 0) { isReverse = false; }
        return __awaiter(this, void 0, void 0, function () {
            var indexStorageKey, entityId, redis, offset;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!serviceInstance_1.serviceInstance.isIndexKey(this._entityType, column)) {
                            throw new RedisOrmQueryError_1.RedisOrmQueryError("(" + this._entityType.name + ") Invalid index column: " + column);
                        }
                        indexStorageKey = serviceInstance_1.serviceInstance.getIndexStorageKey(this._entityType, column);
                        entityId = serviceInstance_1.serviceInstance.convertAsEntityId(this._entityType, idObject);
                        if (!entityId) return [3 /*break*/, 6];
                        return [4 /*yield*/, this._getRedis()];
                    case 1:
                        redis = _a.sent();
                        offset = null;
                        if (!isReverse) return [3 /*break*/, 3];
                        return [4 /*yield*/, redis.zrevrank(indexStorageKey, entityId)];
                    case 2:
                        offset = _a.sent();
                        return [3 /*break*/, 5];
                    case 3: return [4 /*yield*/, redis.zrank(indexStorageKey, entityId)];
                    case 4:
                        offset = _a.sent();
                        _a.label = 5;
                    case 5:
                        if (offset !== null) {
                            return [2 /*return*/, offset];
                        }
                        _a.label = 6;
                    case 6: return [2 /*return*/, -1];
                }
            });
        });
    };
    // endregion
    // region private methods
    Query.prototype._get = function () {
        return __awaiter(this, void 0, void 0, function () {
            var whereIndexKeys, whereSearchKeys, params, _i, _a, _b, column, _c, min, max, _d, _e, _f, column, _g, operator, value, redis, ids;
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0:
                        whereIndexKeys = Object.keys(this._whereIndexes);
                        whereSearchKeys = Object.keys(this._whereSearches);
                        // we add a default index
                        if (whereIndexKeys.length === 0) {
                            this.where("createdAt", "<=", "+inf");
                            whereIndexKeys = Object.keys(this._whereIndexes);
                        }
                        // if we only search with only one index and ordering is same as the index
                        if (whereIndexKeys.length === 1 && whereSearchKeys.length === 0 &&
                            (!this._sortBy || this._sortBy.column === whereIndexKeys[0])) {
                            return [2 /*return*/, this._getSimple()];
                        }
                        params = [
                            whereIndexKeys.length,
                            whereSearchKeys.length,
                            this._offset,
                            this._limit,
                            serviceInstance_1.serviceInstance.getTable(this._entityType),
                            "",
                            "",
                            "",
                            "",
                            this._sortBy ? this._sortBy.column : "",
                            this._sortBy ? this._sortBy.order : "",
                        ];
                        // whereIndexes
                        for (_i = 0, _a = Object.entries(this._whereIndexes); _i < _a.length; _i++) {
                            _b = _a[_i], column = _b[0], _c = _b[1], min = _c.min, max = _c.max;
                            params.push(column);
                            params.push(min);
                            params.push(max);
                        }
                        // whereSearches
                        for (_d = 0, _e = Object.entries(this._whereSearches); _d < _e.length; _d++) {
                            _f = _e[_d], column = _f[0], _g = _f[1], operator = _g.operator, value = _g.value;
                            params.push(column);
                            params.push(operator);
                            params.push(value);
                        }
                        return [4 /*yield*/, this._getRedis()];
                    case 1:
                        redis = _h.sent();
                        return [4 /*yield*/, redis.commandAtomicMixedQuery([], params)];
                    case 2:
                        ids = _h.sent();
                        return [4 /*yield*/, this.findMany(ids)];
                    case 3: return [2 /*return*/, _h.sent()];
                }
            });
        });
    };
    // only work for query with index and same ordering
    Query.prototype._getSimple = function () {
        return __awaiter(this, void 0, void 0, function () {
            var whereIndexKeys, column, min, max, order, indexStorageKey, extraParams, redis, ids;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        whereIndexKeys = Object.keys(this._whereIndexes);
                        column = whereIndexKeys[0];
                        min = this._whereIndexes[column].min;
                        max = this._whereIndexes[column].max;
                        order = this._sortBy ? this._sortBy.order : "asc";
                        indexStorageKey = serviceInstance_1.serviceInstance.getIndexStorageKey(this._entityType, column);
                        extraParams = ["LIMIT", this._offset.toString(), this._limit.toString()];
                        return [4 /*yield*/, this._getRedis()];
                    case 1:
                        redis = _a.sent();
                        ids = [];
                        if (!(order === "asc")) return [3 /*break*/, 3];
                        return [4 /*yield*/, redis.zrangebyscore.apply(redis, __spreadArrays([indexStorageKey, min, max], extraParams))];
                    case 2:
                        ids = _a.sent();
                        return [3 /*break*/, 5];
                    case 3:
                        if (!(order === "desc")) return [3 /*break*/, 5];
                        return [4 /*yield*/, redis.zrevrangebyscore.apply(redis, __spreadArrays([indexStorageKey, max, min], extraParams))];
                    case 4:
                        ids = _a.sent();
                        _a.label = 5;
                    case 5: return [4 /*yield*/, this.findMany(ids)];
                    case 6: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    Query.prototype._aggregate = function (aggregate, aggregateColumn) {
        return __awaiter(this, void 0, void 0, function () {
            var whereIndexKeys, whereSearchKeys, params, _i, _a, _b, column, _c, min, max, _d, _e, _f, column, _g, operator, value, redis, commandResult, result;
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0:
                        if (aggregate !== "count") {
                            if (!serviceInstance_1.serviceInstance.isNumberColumn(this._entityType, aggregateColumn)) {
                                throw new RedisOrmQueryError_1.RedisOrmQueryError("(" + this._entityType.name + ") Column: " + aggregateColumn + " is not in the type of number");
                            }
                        }
                        whereIndexKeys = Object.keys(this._whereIndexes);
                        whereSearchKeys = Object.keys(this._whereSearches);
                        // we add a default index
                        if (whereIndexKeys.length === 0) {
                            this.where("createdAt", "<=", "+inf");
                            whereIndexKeys = Object.keys(this._whereIndexes);
                        }
                        if (!(aggregate === "count" && !this._groupByColumn &&
                            whereIndexKeys.length === 1 && whereSearchKeys.length === 0)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this._aggregateSimple()];
                    case 1: return [2 /*return*/, _h.sent()];
                    case 2:
                        params = [
                            whereIndexKeys.length,
                            whereSearchKeys.length,
                            this._limit,
                            this._offset,
                            serviceInstance_1.serviceInstance.getTable(this._entityType),
                            aggregate,
                            aggregateColumn,
                            this._groupByColumn,
                            this._groupByDateFormat,
                            "",
                            "",
                        ];
                        // whereIndexes
                        for (_i = 0, _a = Object.entries(this._whereIndexes); _i < _a.length; _i++) {
                            _b = _a[_i], column = _b[0], _c = _b[1], min = _c.min, max = _c.max;
                            params.push(column);
                            params.push(min);
                            params.push(max);
                        }
                        // whereSearches
                        for (_d = 0, _e = Object.entries(this._whereSearches); _d < _e.length; _d++) {
                            _f = _e[_d], column = _f[0], _g = _f[1], operator = _g.operator, value = _g.value;
                            params.push(column);
                            params.push(operator);
                            params.push(value);
                        }
                        return [4 /*yield*/, this._getRedis()];
                    case 3:
                        redis = _h.sent();
                        return [4 /*yield*/, redis.commandAtomicMixedQuery([], params)];
                    case 4:
                        commandResult = _h.sent();
                        result = JSON.parse(commandResult);
                        if (!this._groupByColumn) {
                            return [2 /*return*/, result["*"] || 0];
                        }
                        return [2 /*return*/, result];
                }
            });
        });
    };
    Query.prototype._aggregateSimple = function () {
        return __awaiter(this, void 0, void 0, function () {
            var count, whereIndexKeys, column, min, max, redis;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        count = 0;
                        whereIndexKeys = Object.keys(this._whereIndexes);
                        column = whereIndexKeys[0];
                        min = this._whereIndexes[column].min;
                        max = this._whereIndexes[column].max;
                        return [4 /*yield*/, this._getRedis()];
                    case 1:
                        redis = _a.sent();
                        if (!(max === "+inf" && min === "-inf")) return [3 /*break*/, 3];
                        return [4 /*yield*/, redis.zcard(serviceInstance_1.serviceInstance.getIndexStorageKey(this._entityType, column))];
                    case 2:
                        count = _a.sent();
                        return [3 /*break*/, 5];
                    case 3: return [4 /*yield*/, redis.zcount(serviceInstance_1.serviceInstance.getIndexStorageKey(this._entityType, column), min, max)];
                    case 4:
                        count = _a.sent();
                        _a.label = 5;
                    case 5: return [2 /*return*/, count];
                }
            });
        });
    };
    Query.prototype._getRedis = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, serviceInstance_1.serviceInstance.getRedis(this._entityType)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    return Query;
}());
exports.Query = Query;
