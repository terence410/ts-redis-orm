import {RedisOrmError} from "./RedisOrmError";

export class RedisOrmSchemaError extends RedisOrmError {
    constructor(message: string, public readonly errors: string []) {
        super(message);
        Object.setPrototypeOf(this, RedisOrmSchemaError.prototype);
    }
}
