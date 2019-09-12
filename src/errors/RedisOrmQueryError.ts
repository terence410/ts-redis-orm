export class RedisOrmQueryError extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, RedisOrmQueryError.prototype);
    }
}
