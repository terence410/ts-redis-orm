"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var events_1 = require("events");
var EventEmitters = /** @class */ (function () {
    function EventEmitters() {
        this._eventEmitters = new Map();
    }
    EventEmitters.prototype.getEventEmitter = function (target) {
        if (!this._eventEmitters.has(target)) {
            this._eventEmitters.set(target, new events_1.EventEmitter());
        }
        return this._eventEmitters.get(target);
    };
    return EventEmitters;
}());
exports.eventEmitters = new EventEmitters();
