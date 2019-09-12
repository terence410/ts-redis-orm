export class RedisOrmEntityError extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, RedisOrmEntityError.prototype);
    }
}
