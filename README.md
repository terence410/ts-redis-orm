# Redis ORM (Typescript)

[![NPM version](https://badge.fury.io/js/ts-redis-orm.png)](https://www.npmjs.com/package/ts-redis-orm)

[ts-redis-orm](https://www.npmjs.com/package/ts-redis-orm) targets to provide relational DB features to Redis Lover. 

It is designed to preserve the performance of Redis, but extending all of the useful features that you found useful in relational DB such as 
(multiple index, primary keys, unique keys, auto increment, aggregate, soft delete, etc..)

Due to design limitation, the package doesn't work with Redis Cluster. 

This package is mainly built on top of [ioredis](https://github.com/luin/ioredis) and tested with Redis 3, 4 and 5.

# Features
- Simple class structure using typescript decorator. (Very similar to [type-orm](https://www.npmjs.com/package/typeorm))
- Using native JS value types (Number, String, Boolean, Date, Array, Object).
- Atomic. All redis logics are written in Lua to protect data integrity. 
- Schema validation and database reSync.
- Support multiple index keys and unique keys.
- Built-in entity timestamps (createdAt, updatedAt, deletedAt) .
- Soft delete.
- Aggregate functions (count, sum, min, max, average).
- You do not need to initialize a connection before using the entity. It's all done internally. 
- Import / Export DB into file.
- Good Performance. You can create around 10, 000 entities in 1 second for 1 CPU process. Query is also extremely effective with proper indexing settings.

# Example
```typescript

import {
    BaseEntity, 
    Column, 
    Entity, 
    RedisOrmDecoratorError, 
    RedisOrmEntityError, 
    RedisOrmQueryError, 
    RedisOrmSchemaError,
    serviceInstance,
} from "ts-redis-orm";

@Entity({connection: "default", table: "my_table", tablePrefix: "prefix_", indexUpdatedAt: true})
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
    // if we encounter a schema error, you can try to call resyncDb it once
    try {
        await MyEntity.create({}).save();
    } catch (err) {
        if (err instanceof RedisOrmSchemaError) {
            await MyEntity.resyncDb();
        }
    }

    // truncate the DB, need to provide class name for protection
    await MyEntity.truncate("MyEntity");

    // create entity
    const entity1 = new MyEntity();
    const entity2 = entity1.clone();
    const entity3 = MyEntity.create({id: 1});
    const createdAt = entity1.createdAt; // create time of entity (the moment u create the object, not the time u save it to Redis).
    const updatedAt = entity1.updatedAt; // last update time of entity.
    const deletedAt = entity1.deletedAt; // only exist when entity is deleted, it will return Invalid Date for most cases.

    // set values
    entity1.id = 1;
    entity1.set({id: 1});
    entity1.increment("number", 10);
    entity1.createdAt = new Date(); // auto added into entity
    entity1.updatedAt = new Date(); // auto added into entity

    // get values
    const id1 = entity1.id;
    const values1 = entity1.getValues();
    const entityId = entity1.getEntityId(); // internal identifier for the entity

    // save
    await entity1.save();
    entity1.deletedAt = new Date(); // you can override the deletedAt
    await entity1.delete(); // soft delete
    await entity1.forceDelete();
    await entity1.restore();

    // simple query
    const total = await MyEntity.count();
    const all = await MyEntity.all();
    const entity4 = MyEntity.find(1);
    const entity5 = MyEntity.find({id: 1, string: "name"});
    const entity6 = MyEntity.findMany([1, 2, 3, {id: 1, string: "name"}]);

    // complex query
    const entity7 = await MyEntity.query().findUnique("string", "string");
    const entities8 = await MyEntity.query().findUniqueMany("string", ["string1", "string2"]);
    const entities9 = await MyEntity.query().where("number", "=", 5).first();
    const entities10 = await MyEntity
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
        .get();

    // query deleted (you can only query exist or deleted records, but not both)
    const entities11 = MyEntity
        .query()
        .onlyDeleted()
        .get();

    // aggregate query
    const count = await MyEntity.query().count();
    const sum = await MyEntity.query().sum("number");
    const min = await MyEntity.query().min("number");
    const max = await MyEntity.query().max("number");
    const avg = await MyEntity.query().avg("number");
    const countGroup = await MyEntity.query().groupBy("string").count();
    
    // rank (get the ordering of an entity from index, useful for doing ranking)
    const id = 1;
    const rank = await MyEntity.query().rank("number", id);
    const reversedRank = await MyEntity.query().rank("number", id, true);
    
    // export / import
    await MyEntity.export("path");
    await MyEntity.import("path");
    await MyEntity.import("path", true); // skip schemas check 
    
    // events
    const events = MyEntity.getEventEmitter();
    events.on("create", (entity) => { /* */ });
    events.on("update", (entity) => { /* */ });
    events.on("delete", (entity) => { /* */ });
    events.on("forceDelete", (entity) => { /* */ });
    events.on("restore", (entity) => { /* */ });
    
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
    const entity10a = await MyEntity.query().setTable(table).find(10);
    
    // others
    const removeSchemasList = serviceInstance.getRemoveSchemasList("connectionKey");
    const allEntityTypes = serviceInstance.getEntityTypes();
    
    // errors
    try {
        await MyEntity.create({}).save();
    } catch (err) {
        if (err instanceof RedisOrmSchemaError) {
            // error related to entity schema, throw at first connection to Redis

        } else if (err instanceof RedisOrmDecoratorError) {
            // error related to decorator, only throw at compile time

        } else if (err instanceof RedisOrmEntityError) {
            // error related to entity operation

        } else if (err instanceof RedisOrmQueryError) {
            // error related to entity query
        } else {
            // ioredis error or other unkonw errors
        }
    }
};

```

# Project Setup
- npm install ts-redis-orm
- In tsconfig.json, set "experimentalDecorators" to true. 
- In tsconfig.json, set "emitDecoratorMetadata" to true. 
- In tsconfig.json, set "strictNullChecks" to true. (To avoid type confusion in entity)
- Create redisorm.default.json in the project root folder.
  - If you wanted to manage multiple environment, you can create redisorm.${NODE_ENV}.json, where ${NODE_ENV} eqauls to the process.env.NODE_ENV environment variable.
  - The library will search for the environment specific json file first. If it does not exist, it will try to load the redisorm.default.json.
- Export env variable REDIS_ORM_CONFIG=custom.json for your own config file path
- For debug, export debug=tsredisorm* 

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
    // this is an extra feature supported by ts-redis-orm, if redis suddenly go offline, the entity can prompt for an connection error.
    "maxConnectRetry": 5
  }
}
```
- Create MyEntity.ts
```typescript
import {BaseEntity, Column, Entity} from "ts-redis-orm";

@Entity({connection: "default", table: "entity", indexUpdatedAt: true})
class MyEntity extends BaseEntity {
    @Column({primary: true, autoIncrement: true})
    public id: number = 0;
}

// usage 
const entity = new MyEntity();
await entity.save();
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
  

