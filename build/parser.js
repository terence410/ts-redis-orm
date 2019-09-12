"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Parser = /** @class */ (function () {
    function Parser() {
    }
    Parser.prototype.parseStorageStringToValue = function (type, storageString) {
        var value;
        switch (type) {
            case String:
                value = storageString ? String(storageString) : "";
                break;
            case Number:
                value = storageString ? Number(storageString) : Number.NaN;
                break;
            case Boolean:
                value = storageString === "1";
                break;
            case Date:
                value = new Date(storageString ? Number(storageString) : Number.NaN);
                break;
            case Array:
                try {
                    var temp = JSON.parse(storageString);
                    if (Array.isArray(temp)) {
                        value = temp;
                    }
                    else {
                        value = undefined;
                    }
                }
                catch (err) {
                    value = undefined;
                }
                break;
            case Object:
                try {
                    value = JSON.parse(storageString);
                }
                catch (err) {
                    value = undefined;
                }
                break;
        }
        return value;
    };
    Parser.prototype.parseValueToStorageString = function (type, value) {
        var storageString = "";
        switch (type) {
            case String:
                storageString = value ? value.toString() : "";
                break;
            case Number:
                storageString = Number(value).toString();
                break;
            case Boolean:
                storageString = value ? "1" : "0";
                break;
            case Date:
                var temp1 = void 0;
                if (value === "now") {
                    temp1 = Number(new Date());
                }
                else if (value instanceof Date) {
                    temp1 = Number(value);
                }
                else {
                    temp1 = Number(new Date(value));
                }
                if (Number.isNaN(temp1)) {
                    storageString = "NaN";
                }
                else {
                    storageString = temp1.toString();
                }
                break;
            case Array:
                storageString = Array.isArray(value) ? JSON.stringify(value) : "";
                break;
            case Object:
                storageString = JSON.stringify(value);
                break;
        }
        return storageString;
    };
    return Parser;
}());
exports.parser = new Parser();
