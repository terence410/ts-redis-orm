export class RedisOrmError extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, RedisOrmError.prototype);
    }
}
