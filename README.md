# Redis ORM (Typescript)

[![NPM version][npm-image]][npm-url]
[![Test][github-action-image]][github-action-url]
[![Test coverage][codecov-image]][codecov-url]
[![David deps][david-image]][david-url]

[npm-image]: https://img.shields.io/npm/v/ts-redis-orm.svg
[npm-url]: https://npmjs.org/package/ts-datastoreorm
[github-action-image]: https://github.com/terence410/ts-google-drive/workflows/Testing/badge.svg
[github-action-url]: https://github.com/terence410/ts-google-drive/actions
[codecov-image]: https://img.shields.io/codecov/c/github/terence410/ts-redis-orm.svg?style=flat-square
[codecov-url]: https://codecov.io/gh/terence410/ts-redis-orm
[david-image]: https://img.shields.io/david/terence410/ts-redis-orm.svg?style=flat-square
[david-url]: https://david-dm.org/terence410/ts-redis-orm

[ts-redis-orm](https://www.npmjs.com/package/ts-redis-orm) targets to provide relational DB features to Redis Lover. 

It is designed to preserve the performance of Redis, but extending all of the useful features that you found useful in relational DB such as 
(multiple index, primary keys, unique keys, auto increment, aggregate, etc..)

Due to design limitation, the package doesn't work with Redis Cluster. 

This package is mainly built on top of [ioredis](https://github.com/luin/ioredis) and tested with Redis 3, 4 and 5.

# Breaking changes for v1
- all operation will return performance result
```typescript
const [entity, performanceResult] = await Entity.create({}).save();)
console.log(performanceResult);

// This will print: 
{
    executionTime: number;
    commandStats: object;
    diffCommandStats: object;
    usedCpuSys: number;
    diffUsedCpuSys: number;
    usedCpuUser: number;
    diffUsedCpuUser: number;
    usedMemory: number;
    diffUsedMemory: number;
}
```
- removed updatedAt, deletedAt columns
- removed softDelete, restore operation

# Features
- Simple class structure using typescript decorator. (Very similar to [type-orm](https://www.npmjs.com/package/typeorm))
- Using native JS value types (Number, String, Boolean, Date, Array, Object).
- Atomic. All redis logics are written in Lua to protect data integrity. 
- Schema validation and database reSync.
- Support multiple index keys and unique keys.
- Aggregate functions (count, sum, min, max, average).
- You do not need to initialize a connection before using the entity. It's all done internally. 
- Import / Export DB into file.
- Good Performance. You can create around 10, 000 entities in 1 second for 1 CPU process. Query is also extremely effective with proper indexing settings.


# Quick Start
```typescript
import {BaseEntity, Column, Entity} from "ts-redis-orm";

@Entity({connection: "default", table: "Entity"})
class MyEntity extends BaseEntity {
    @Column({autoIncrement: true})
    public id: number = 0;
}

// usage 
const entity = new MyEntity();
await entity.save();
```

# Detail Example
```typescript

import {
    BaseEntity, 
    Column, 
    Entity, 
    RedisOrmDecoratorError, 
    RedisOrmOperationError, 
    RedisOrmQueryError, 
    RedisOrmSchemaError,
    serviceInstance,
} from "ts-redis-orm";

@Entity({connection: "default", table: "MyEntity", tablePrefix: "Prefix"})
class MyEntity extends BaseEntity {
    @Column({primary: true, autoIncrement: true})
    public id: number = 0;

    @Column({primary: true, unique: true})
    public string: string = "";

    @Column({unique: true, index: true})
    public number: number = 0;

    @Column({index: true})
    public date: Date = new Date();

    @Column({index: true})
    public boolean: boolean = false;

    @Column()
    public array: number[] = [];

    @Column()
    public object1: any;

    @Column()
    public object2: null | string = null;

    @Column()
    public object3: {name?: string, value?: number} = {};
}

const main = async () => {
    // init the connection to redis, you don't need to call this. it will be done internally
    // for some scenarios, you can put this at the bootstrap of your project ot make sure everything is all right
    await MyEntity.connect();

    // get the redis instance
    const redis = await MyEntity.getRedis();

    // we have an internal schema protection
    // if we encounter a schema error, you can try to resync it once
    try {
        const [entity, performanceResult1] = await MyEntity.create({}).save();
    } catch (err) {
        if (err instanceof RedisOrmSchemaError) {
            const [hasResync, performanceResult2] = await MyEntity.resyncDb();
        }
    }

    // truncate the DB, need to provide class name for protection
    const [totalDeleted, performanceResult3] = await MyEntity.truncate("MyEntity");

    // create entity
    const entity1 = new MyEntity();
    const entity2 = entity1.clone();
    const entity3 = MyEntity.create({id: 1});
    const createdAt = entity1.createdAt; // create time of entity (the moment u create the object, not the time u save it to Redis).

    // set values
    entity1.id = 1;
    entity1.setValues({id: 1});
    entity1.increment("number", 10);
    entity1.createdAt = new Date(); // auto added into entity

    // get values
    const id1 = entity1.id;
    const values1 = entity1.getValues();
    const entityId = entity1.getEntityId(); // internal identifier for the entity

    // save
    const [entity1a, performanceResult4] = await entity1.save();
    const [entity1b, performanceResult5] = await entity1.delete(); // soft delete

    // simple query
    const [total] = await MyEntity.count();
    const [all] = await MyEntity.all();
    const [entity4] = await MyEntity.find(1);
    const [entities5] = await MyEntity.findMany([1, 2, 3]);

    // complex query
    const [entity6] = await MyEntity.query().findUnique("string", "string");
    const [entities7] = await MyEntity.query().findUniqueMany("string", ["string1", "string2"]);
    const [entities8] = await MyEntity.query().where("number", "=", 5).runOnce();
    const [entities9] = await MyEntity
        .query()
        // if column is indexed
        .where("number", "=", 5)
        .where("number", ">", 5)
        .where("number", ">=", 5)
        .where("number", "<", 5)
        .where("number", "<=", 5)
        // if column is not indexed
        .where("string", "=", "value")
        .where("string", "!=", "value")
        .where("string", "like", "value")
        .sortBy("number", "desc")
        .offset(10)
        .limit(10)
        .run();

    // aggregate query
    const [count] = await MyEntity.query().count();
    const [sum] = await MyEntity.query().sum("number");
    const [min] = await MyEntity.query().min("number");
    const [max] = await MyEntity.query().max("number");
    const [avg] = await MyEntity.query().avg("number");
    const [countGroup] = await MyEntity.query().count("string");

    // rank (get the ordering of an entity from index, useful for doing ranking)
    const id = 1;
    const [rank] = await MyEntity.query().rank("number", id);
    const [reversedRank] = await MyEntity.query().rank("number", id, true);

    // export / import
    await MyEntity.export("path");
    await MyEntity.import("path");
    await MyEntity.import("path", true); // skip schemas check

    // events
    const events = MyEntity.getEvents();
    events.on("create", (entity) => { /* */ });
    events.on("update", (entity) => { /* */ });
    events.on("delete", (entity) => { /* */ });

    // dynamic tables
    const table = "another-table";
    await MyEntity.connect(table);
    await MyEntity.truncate("MyEntity", table);
    await MyEntity.export("./file.txt", table);
    await MyEntity.import("./file.txt", false, table);
    const entity10 = new MyEntity();
    entity10.setTable(table);
    const currentTable = entity10.getTable();
    entity10.id = 10;
    await entity10.save();
    const [entity10a] = await MyEntity.query().setTable(table).find(10);

    // others
    const removeSchemasList = redisOrm.getRemoteSchemasList("connectionKey");
    const allEntityTypes = redisOrm.getEntityTypes();

    // errors
    try {
        await MyEntity.create({}).save();
    } catch (err) {
        if (err instanceof RedisOrmSchemaError) {
            // error related to entity schema, throw at first connection to Redis

        } else if (err instanceof RedisOrmDecoratorError) {
            // error related to decorator, only throw at compile time

        } else if (err instanceof RedisOrmOperationError) {
            // error related to entity operation

        } else if (err instanceof RedisOrmQueryError) {
            // error related to entity query
        } else {
            // ioredis error or other unkonw errors
        }
    }
}
```

# Project Setup
- npm install ts-redis-orm
- In tsconfig.json
    - "experimentalDecorators": true
    - "emitDecoratorMetadata": true
    - "strictNullChecks": true. (To avoid type confusion in entity)
- Create redisorm.default.json in the project root folder.

# Environment Variable
- export NODE_ENV=production
  - it will try to load the config file "./redisorm.production.json"
- export REDISORM_CONFIG_PATH=./path/custom.json
  - it will try to load the config file "./path/custom.json"
  - this has a higher priority than NODE_ENV
  
# Config file format (./redisorm.default.json)

```json5
{
   // If you didn't set any connection in Entity, it will use the default connection.
   // The connection config are the same as in ioredis, pleases visit https://github.com/luin/ioredis/blob/master/API.md for more details.
  "default": {
    "host": "127.0.0.1",
    "port": 6379,
    "connectTimeout": 1000,
    "db": 0,
    "showFriendlyErrorStack": false,
    // report more detailed report on redis for every operations
    "trackRedisInfo": false,
    // this is an extra feature supported by ts-redis-orm, if redis suddenly go offline, the entity can prompt for an connection error.
    "maxConnectRetry": 5
  }
}
```

# Limitation and Usage Remarks
- Schema check is auto enabled when you do connect(), save(), delete(), restore(). 
- Schema check is disabled for query(), truncate() and resyncDb().
- Redis Cluster is not supported. While you can try to break down each Entity to use different Redis DB.
- High query performance can only be achieved with proper index on the column with single where clause. Multiple where clause is supported, but the performance is not guaranteed. 
- One redis connection is created for each Entity Type.
- Multiple index query is achieved by table intersection, which will be slow in some cases. Please try to limit the possible outcome of each where clause to achieve the best performance.
- If you disable strictNullChecks in typescript or if you didn't initialize any values for your entity, here is the default value of each type
  - string: ""
  - number: Number.NaN
  - date: new Date(Number.NaN) // Invalid Date
  - boolean: false
  - Array: undefined
  - Object: undefined

