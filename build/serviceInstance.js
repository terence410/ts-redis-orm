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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs = __importStar(require("fs"));
var ioredis_1 = __importDefault(require("ioredis"));
var path = __importStar(require("path"));
var configLoader_1 = require("./configLoader");
var RedisOrmDecoratorError_1 = require("./errors/RedisOrmDecoratorError");
var RedisOrmQueryError_1 = require("./errors/RedisOrmQueryError");
var IOREDIS_ERROR_RETRY_DELAY = 1000;
var IOREDIS_CONNECT_TIMEOUT = 10000;
var IOREDIS_REIGSTER_LUA_DELAY = 100;
var ServiceInstance = /** @class */ (function () {
    function ServiceInstance() {
        this._entityMetas = new Map();
        this._entitySchemas = new Map();
        this._entitySchemasJsons = new Map(); // cache for faster JSON.stringify
        // endregion
    }
    // region public methods: set
    ServiceInstance.prototype.addEntity = function (target, entityMeta) {
        if (!this._entityMetas.has(target)) {
            this._entityMetas.set(target, entityMeta);
        }
    };
    ServiceInstance.prototype.addColumn = function (target, column, schema) {
        var schemas = this._entitySchemas.get(target);
        if (!schemas) {
            schemas = {};
            this._entitySchemas.set(target, schemas);
        }
        schemas[column] = schema;
    };
    // endregion
    // region public methods: get
    ServiceInstance.prototype.getConnectionConfig = function (target) {
        var connection = this.getConnection(target);
        var configFile = configLoader_1.configLoader.getConfigFile();
        if (!configFile) {
            throw new RedisOrmDecoratorError_1.RedisOrmDecoratorError("Config file not found. Please create redisorm.default.json in the project root folder.");
        }
        var rawData = fs.readFileSync(configFile);
        var connectionConfigs = JSON.parse(rawData.toString());
        if (!(connection in connectionConfigs)) {
            throw new RedisOrmDecoratorError_1.RedisOrmDecoratorError("Invalid connection: " + connection + ". Please check " + configFile);
        }
        // add retry add retry strategy if needed to trigger connect error
        var connectionConfig = connectionConfigs[connection];
        var maxConnectRetry = connectionConfig.maxConnectRetry;
        if (maxConnectRetry) {
            var connectTimeout = connectionConfig.connectTimeout || IOREDIS_CONNECT_TIMEOUT;
            connectionConfig.retryStrategy = function (times) {
                return times > maxConnectRetry ? null : IOREDIS_ERROR_RETRY_DELAY;
            };
        }
        return connectionConfig;
    };
    ServiceInstance.prototype.getEntityMeta = function (target) {
        return this._entityMetas.get(target);
    };
    ServiceInstance.prototype.getTable = function (target) {
        return this.getEntityMeta(target).table;
    };
    ServiceInstance.prototype.getConnection = function (target) {
        return this.getEntityMeta(target).connection;
    };
    ServiceInstance.prototype.getPrimaryKeys = function (target) {
        var schemas = this.getSchemas(target);
        return Object.entries(schemas).filter(function (x) { return x[1].primary; }).map(function (x) { return x[0]; });
    };
    ServiceInstance.prototype.getAutoIncrementKey = function (target) {
        var schemas = this.getSchemas(target);
        var filteredSchemas = Object.entries(schemas).find(function (x) { return x[1].autoIncrement; });
        return filteredSchemas ? filteredSchemas[0] : "";
    };
    ServiceInstance.prototype.getIndexKeys = function (target) {
        var schemas = this.getSchemas(target);
        return Object.entries(schemas).filter(function (x) { return x[1].index; }).map(function (x) { return x[0]; });
    };
    ServiceInstance.prototype.getUniqueKeys = function (target) {
        var schemas = this.getSchemas(target);
        return Object.entries(schemas).filter(function (x) { return x[1].unique; }).map(function (x) { return x[0]; });
    };
    ServiceInstance.prototype.getSchemas = function (target) {
        return this._entitySchemas.get(target) || {};
    };
    ServiceInstance.prototype.getSchemasJson = function (target) {
        if (!this._entitySchemasJsons.has(target)) {
            var schemas_1 = this.getSchemas(target);
            var keys = Object.keys(schemas_1).sort();
            var sortedSchemas = keys.reduce(function (a, b) {
                var _a;
                return Object.assign(a, (_a = {}, _a[b] = schemas_1[b], _a));
            }, {});
            this._entitySchemasJsons.set(target, JSON.stringify(sortedSchemas, schemaJsonReplacer));
        }
        return this._entitySchemasJsons.get(target);
    };
    ServiceInstance.prototype.getSchema = function (target, column) {
        var schemas = this.getSchemas(target);
        return schemas[column];
    };
    ServiceInstance.prototype.getColumns = function (target) {
        var schemas = this._entitySchemas.get(target) || {};
        return Object.keys(schemas);
    };
    ServiceInstance.prototype.convertAsEntityId = function (target, idObject) {
        var primaryKeys = this.getPrimaryKeys(target).sort();
        if (idObject === null || idObject === undefined) {
            throw new RedisOrmQueryError_1.RedisOrmQueryError("(" + target.name + ") Invalid id: " + idObject);
        }
        else if (typeof idObject === "string") {
            return idObject;
        }
        else if (typeof idObject === "number") {
            return idObject.toString();
        }
        else if (typeof idObject === "object") {
            if (!primaryKeys.every(function (column) { return column in idObject; })) {
                throw new RedisOrmQueryError_1.RedisOrmQueryError("(" + target.name + ") Invalid id " + JSON.stringify(idObject));
            }
            return primaryKeys
                .map(function (column) { return idObject[column].toString().replace(/:/g, ""); })
                .join(":");
        }
    };
    // endregion
    // region public methods: conditions
    ServiceInstance.prototype.isIndexKey = function (target, column) {
        var keys = this.getIndexKeys(target);
        return keys.includes(column);
    };
    ServiceInstance.prototype.isValidColumn = function (target, column) {
        var keys = exports.serviceInstance.getColumns(target);
        return keys.includes(column);
    };
    ServiceInstance.prototype.isSearchableColumn = function (target, column) {
        var schemas = exports.serviceInstance.getSchemas(target);
        return (column in schemas && [String, Number, Date, Boolean].includes(schemas[column].type));
    };
    ServiceInstance.prototype.isUniqueKey = function (target, column) {
        var keys = exports.serviceInstance.getUniqueKeys(target);
        return keys.includes(column);
    };
    ServiceInstance.prototype.isPrimaryKey = function (target, column) {
        var keys = exports.serviceInstance.getPrimaryKeys(target);
        return keys.includes(column);
    };
    ServiceInstance.prototype.isSortableColumn = function (target, column) {
        var schema = exports.serviceInstance.getSchema(target, column);
        return schema.type === Number || schema.type === Boolean || schema.type === Date;
    };
    ServiceInstance.prototype.isNumberColumn = function (target, column) {
        var schema = exports.serviceInstance.getSchema(target, column);
        return schema.type === Number;
    };
    ServiceInstance.prototype.isDateColumn = function (target, column) {
        var schema = exports.serviceInstance.getSchema(target, column);
        return schema.type === Date;
    };
    // endregion
    // region redis
    ServiceInstance.prototype.getRedis = function (target, registerRedis) {
        if (registerRedis === void 0) { registerRedis = true; }
        return __awaiter(this, void 0, void 0, function () {
            var entityMeta, redisContainer, connectionConfig;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        entityMeta = this.getEntityMeta(target);
                        redisContainer = entityMeta.redisMaster;
                        if (!redisContainer) {
                            connectionConfig = this.getConnectionConfig(target);
                            redisContainer = {
                                redis: new ioredis_1.default(connectionConfig),
                                connecting: false,
                                ready: false,
                                schemaErrors: [],
                                error: null,
                            };
                            entityMeta.redisMaster = redisContainer;
                        }
                        if (!registerRedis) return [3 /*break*/, 2];
                        return [4 /*yield*/, this._registerRedis(target, redisContainer)];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2: return [2 /*return*/, redisContainer.redis];
                }
            });
        });
    };
    ServiceInstance.prototype.compareSchemas = function (target) {
        return __awaiter(this, void 0, void 0, function () {
            var redis, errors, remoteSchemas, clientSchemasJson, clientSchemas, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, exports.serviceInstance.getRedis(target)];
                    case 1:
                        redis = _a.sent();
                        errors = [];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, this.getRemoteSchemas(target, redis)];
                    case 3:
                        remoteSchemas = _a.sent();
                        if (remoteSchemas) {
                            clientSchemasJson = this.getSchemasJson(target);
                            clientSchemas = JSON.parse(clientSchemasJson);
                            errors = this._validateSchemas(clientSchemas, remoteSchemas);
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        err_1 = _a.sent();
                        // just throw directly
                        throw err_1;
                    case 5: return [2 /*return*/, errors];
                }
            });
        });
    };
    ServiceInstance.prototype.getRemoteSchemas = function (target, redis) {
        return __awaiter(this, void 0, void 0, function () {
            var metaStorageKey, hashKey, remoteSchemasString;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        metaStorageKey = this.getMetaStorageKey(target);
                        hashKey = "schemas";
                        return [4 /*yield*/, redis.hget(metaStorageKey, hashKey)];
                    case 1:
                        remoteSchemasString = _a.sent();
                        if (remoteSchemasString) {
                            return [2 /*return*/, JSON.parse(remoteSchemasString)];
                        }
                        return [2 /*return*/, null];
                }
            });
        });
    };
    ServiceInstance.prototype.resyncDb = function (target) {
        return __awaiter(this, void 0, void 0, function () {
            var clientSchemasJson, metaStorageKey, hashKey, redis;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        clientSchemasJson = this.getSchemasJson(target);
                        metaStorageKey = this.getMetaStorageKey(target);
                        hashKey = "schemas";
                        return [4 /*yield*/, this.getRedis(target, false)];
                    case 1:
                        redis = _a.sent();
                        return [4 /*yield*/, redis.hset(metaStorageKey, hashKey, clientSchemasJson)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    // endregion
    // region public methods: storage key
    ServiceInstance.prototype.getEntityStorageKey = function (target, entityId) {
        return "entity:" + this.getTable(target) + ":" + entityId;
    };
    ServiceInstance.prototype.getIndexStorageKey = function (target, column) {
        return "index:" + this.getTable(target) + ":" + column;
    };
    ServiceInstance.prototype.getUniqueStorageKey = function (target, column) {
        return "unique:" + this.getTable(target) + ":" + column;
    };
    ServiceInstance.prototype.getMetaStorageKey = function (target) {
        return "meta:" + this.getTable(target);
    };
    // endregion
    // region private methods
    ServiceInstance.prototype._registerRedis = function (target, redisContainer) {
        return __awaiter(this, void 0, void 0, function () {
            var err_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!redisContainer.connecting) return [3 /*break*/, 2];
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, IOREDIS_REIGSTER_LUA_DELAY); })];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 0];
                    case 2:
                        if (!!redisContainer.ready) return [3 /*break*/, 7];
                        redisContainer.connecting = true;
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, this._registerLau(target, redisContainer)];
                    case 4:
                        _a.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        err_2 = _a.sent();
                        redisContainer.error = err_2;
                        return [3 /*break*/, 6];
                    case 6:
                        redisContainer.ready = true;
                        redisContainer.connecting = false;
                        _a.label = 7;
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    ServiceInstance.prototype._registerLau = function (target, redisContainer) {
        return __awaiter(this, void 0, void 0, function () {
            var luaShared, lua1, lua2, lua3, lua4, lua5, err_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 6, , 7]);
                        luaShared = fs.readFileSync(path.join(__dirname, "../lua/shared.lua"), { encoding: "utf8" });
                        lua1 = fs.readFileSync(path.join(__dirname, "../lua/atomicResyncDb.lua"), { encoding: "utf8" });
                        return [4 /*yield*/, redisContainer.redis.defineCommand("commandAtomicResyncDb", { numberOfKeys: 0, lua: luaShared + lua1 })];
                    case 1:
                        _a.sent();
                        lua2 = fs.readFileSync(path.join(__dirname, "../lua/atomicMixedQuery.lua"), { encoding: "utf8" });
                        return [4 /*yield*/, redisContainer.redis.defineCommand("commandAtomicMixedQuery", { numberOfKeys: 0, lua: luaShared + lua2 })];
                    case 2:
                        _a.sent();
                        lua3 = fs.readFileSync(path.join(__dirname, "../lua/atomicSave.lua"), { encoding: "utf8" });
                        return [4 /*yield*/, redisContainer.redis.defineCommand("commandAtomicSave", { numberOfKeys: 0, lua: luaShared + lua3 })];
                    case 3:
                        _a.sent();
                        lua4 = fs.readFileSync(path.join(__dirname, "../lua/atomicDelete.lua"), { encoding: "utf8" });
                        return [4 /*yield*/, redisContainer.redis.defineCommand("commandAtomicDelete", { numberOfKeys: 0, lua: luaShared + lua4 })];
                    case 4:
                        _a.sent();
                        lua5 = fs.readFileSync(path.join(__dirname, "../lua/atomicTruncate.lua"), { encoding: "utf8" });
                        return [4 /*yield*/, redisContainer.redis.defineCommand("commandAtomicTruncate", { numberOfKeys: 0, lua: luaShared + lua5 })];
                    case 5:
                        _a.sent();
                        return [3 /*break*/, 7];
                    case 6:
                        err_3 = _a.sent();
                        // just throw directly
                        throw err_3;
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    ServiceInstance.prototype._validateSchemas = function (clientSchemas, remoteSchemas) {
        var errors = [];
        // check remote schemas has all keys in client schemas
        for (var _i = 0, _a = Object.keys(clientSchemas); _i < _a.length; _i++) {
            var column = _a[_i];
            if (!(column in remoteSchemas)) {
                errors.push("Column: " + column + " does not exist in remote schemas");
                continue;
            }
            var clientSchema = clientSchemas[column];
            var remoteSchema = remoteSchemas[column];
            if (clientSchema.type !== remoteSchema.type) {
                errors.push("Incompatible type on column: " + column + ", current value: " + clientSchema.type + ", remove value: " + remoteSchema.type);
            }
            if (clientSchema.index !== remoteSchema.index) {
                errors.push("Incompatible index on column: " + column + ", current value: " + clientSchema.index + ", remove value: " + remoteSchema.index);
            }
            if (clientSchema.unique !== remoteSchema.unique) {
                errors.push("Incompatible unique on column: " + column + ", current value: " + clientSchema.unique + ", remove value: " + remoteSchema.unique);
            }
            if (clientSchema.autoIncrement !== remoteSchema.autoIncrement) {
                errors.push("Incompatible autoIncrement on column: " + column + ", current value: " + clientSchema.autoIncrement + ", remove value: " + remoteSchema.autoIncrement);
            }
            if (clientSchema.primary !== remoteSchema.primary) {
                errors.push("Incompatible primary on column: " + column + ", current value: " + clientSchema.primary + ", remove value: " + remoteSchema.primary);
            }
        }
        // check client schemas has all keys in remote schemas
        for (var _b = 0, _c = Object.keys(remoteSchemas); _b < _c.length; _b++) {
            var column = _c[_b];
            if (!(column in clientSchemas)) {
                errors.push("Column: " + column + " does not exist in current schemas");
            }
        }
        return errors;
    };
    ServiceInstance.prototype._openFile = function (file) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        fs.readFile(file, "utf8", function (err, text) {
                            if (err) {
                                return reject(err);
                            }
                            else {
                                resolve(text);
                            }
                        });
                    })];
            });
        });
    };
    return ServiceInstance;
}());
exports.serviceInstance = new ServiceInstance();
function schemaJsonReplacer(key, value) {
    if (key === "type" && [String, Number, Boolean, Date, Array, Object].includes(value)) {
        return value.name;
    }
    return value;
}
exports.schemaJsonReplacer = schemaJsonReplacer;
