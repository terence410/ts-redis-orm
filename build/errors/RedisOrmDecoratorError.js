"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var RedisOrmDecoratorError = /** @class */ (function (_super) {
    __extends(RedisOrmDecoratorError, _super);
    function RedisOrmDecoratorError(message) {
        var _this = _super.call(this, message) || this;
        Object.setPrototypeOf(_this, RedisOrmDecoratorError.prototype);
        return _this;
    }
    return RedisOrmDecoratorError;
}(Error));
exports.RedisOrmDecoratorError = RedisOrmDecoratorError;
