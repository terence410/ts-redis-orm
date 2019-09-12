export declare class RedisOrmSchemaError extends Error {
    readonly errors: string[];
    constructor(message: string, errors: string[]);
}
