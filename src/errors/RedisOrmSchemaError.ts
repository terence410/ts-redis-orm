export class RedisOrmSchemaError extends Error {
    constructor(message: string, public readonly errors: string []) {
        super(message);
        Object.setPrototypeOf(this, RedisOrmSchemaError.prototype);
    }
}
