import {RedisOrmError} from "./RedisOrmError";

export class RedisOrmDecoratorError extends RedisOrmError {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, RedisOrmDecoratorError.prototype);
    }
}
