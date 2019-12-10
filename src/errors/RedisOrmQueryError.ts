import {RedisOrmError} from "./RedisOrmError";

export class RedisOrmQueryError extends RedisOrmError {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, RedisOrmQueryError.prototype);
    }
}
