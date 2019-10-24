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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs_1 = __importDefault(require("fs"));
var readline = __importStar(require("readline"));
var serviceInstance_1 = require("./serviceInstance");
var EntityExporter = /** @class */ (function () {
    function EntityExporter() {
    }
    EntityExporter.prototype.exportEntities = function (entityType, entities, file) {
        return new Promise(function (resolve, reject) {
            var writeStream = fs_1.default.createWriteStream(file, { encoding: "utf-8" });
            // write the meta
            var meta = {
                createdAt: new Date(),
                class: entityType.name,
                table: serviceInstance_1.serviceInstance.getTable(entityType),
                schemas: serviceInstance_1.serviceInstance.getSchemasJson(entityType),
                total: entities.length,
            };
            writeStream.write(JSON.stringify(meta, serviceInstance_1.schemaJsonReplacer) + "\r\n");
            // write all the models
            for (var _i = 0, entities_1 = entities; _i < entities_1.length; _i++) {
                var entity = entities_1[_i];
                writeStream.write(JSON.stringify(entity.getValues()) + "\r\n");
            }
            writeStream.on("error", function (err) {
                reject(err);
            });
            writeStream.on("finish", function () {
                resolve();
            });
            writeStream.end();
        });
    };
    EntityExporter.prototype.import = function (entityType, file, skipSchemasCheck) {
        if (skipSchemasCheck === void 0) { skipSchemasCheck = false; }
        return __awaiter(this, void 0, void 0, function () {
            var readStream, r1;
            return __generator(this, function (_a) {
                readStream = fs_1.default.createReadStream(file, { encoding: "utf8" });
                r1 = readline.createInterface({ input: readStream });
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        var valuesList = [];
                        var meta = null;
                        var closed = false;
                        var saveModelPromise = null;
                        var promiseRunning = false;
                        var currentError = null;
                        function checkComplete() {
                            if (closed) {
                                r1.removeAllListeners();
                                r1.close();
                                readStream.close();
                                if (!promiseRunning) {
                                    resolve(true);
                                }
                            }
                        }
                        function checkError() {
                            if (currentError) {
                                r1.removeAllListeners();
                                r1.close();
                                readStream.close();
                                if (!promiseRunning) {
                                    reject(currentError);
                                }
                            }
                        }
                        function saveEntity() {
                            if (!promiseRunning) {
                                promiseRunning = true;
                                asyncSaveModel().then(function () {
                                    promiseRunning = false;
                                    checkError();
                                    checkComplete();
                                    r1.resume();
                                }).catch(function (err) {
                                    promiseRunning = false;
                                    currentError = err;
                                    checkError();
                                });
                            }
                        }
                        function asyncSaveModel() {
                            return __awaiter(this, void 0, void 0, function () {
                                var values, entity, deletedAt, err_1;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            if (!(valuesList.length > 0)) return [3 /*break*/, 7];
                                            values = valuesList.shift();
                                            _a.label = 1;
                                        case 1:
                                            _a.trys.push([1, 5, , 6]);
                                            entity = new entityType();
                                            entity.set(values);
                                            return [4 /*yield*/, entity.save()];
                                        case 2:
                                            _a.sent();
                                            if (!values.deletedAt) return [3 /*break*/, 4];
                                            deletedAt = new Date(values.deletedAt);
                                            if (!!isNaN(Number(deletedAt))) return [3 /*break*/, 4];
                                            entity.deletedAt = deletedAt;
                                            return [4 /*yield*/, entity.delete()];
                                        case 3:
                                            _a.sent();
                                            _a.label = 4;
                                        case 4: return [3 /*break*/, 6];
                                        case 5:
                                            err_1 = _a.sent();
                                            err_1.message = "data: " + JSON.stringify(values) + "\r\n" + err_1.message;
                                            throw err_1;
                                        case 6: return [3 /*break*/, 0];
                                        case 7: return [2 /*return*/];
                                    }
                                });
                            });
                        }
                        r1.on("line", function (data) {
                            r1.pause();
                            // the first line will be meta
                            if (!meta) {
                                try {
                                    meta = JSON.parse(data);
                                    r1.resume();
                                }
                                catch (err) {
                                    err.message = "data: " + data + "\r\n" + err.message;
                                    currentError = err;
                                    checkError();
                                }
                                if (!skipSchemasCheck) {
                                    var className = entityType.name;
                                    var clientSchemas = serviceInstance_1.serviceInstance.getSchemasJson(entityType);
                                    if (meta.class !== className) {
                                        var err = new Error();
                                        err.message = "Class name: " + className + " does not match with the import file: " + meta.class;
                                        currentError = err;
                                        checkError();
                                    }
                                    else if (meta.schemas !== clientSchemas) {
                                        var err = new Error();
                                        err.message = "Current Schemas: " + clientSchemas + " does not match with the import file: " + meta.schemas;
                                        currentError = err;
                                        checkError();
                                    }
                                }
                            }
                            else {
                                try {
                                    var values = JSON.parse(data);
                                    valuesList.push(values);
                                    saveEntity();
                                }
                                catch (err) {
                                    err.message = "data: " + data + "\r\n" + err.message;
                                    currentError = err;
                                    checkError();
                                }
                            }
                        });
                        r1.on("error", function (err) {
                            currentError = err;
                            checkError();
                        });
                        r1.on("close", function () {
                            closed = true;
                            checkComplete();
                        });
                    })];
            });
        });
    };
    return EntityExporter;
}());
exports.entityExporter = new EntityExporter();
