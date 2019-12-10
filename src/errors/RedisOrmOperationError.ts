import {RedisOrmError} from "./RedisOrmError";

export class RedisOrmOperationError extends RedisOrmError {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, RedisOrmOperationError.prototype);
    }
}
