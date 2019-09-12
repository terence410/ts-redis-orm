export class RedisOrmDecoratorError extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, RedisOrmDecoratorError.prototype);
    }
}
