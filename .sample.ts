import {
    BaseEntity,
    Column,
    Entity,
    RedisOrmDecoratorError,
    RedisOrmOperationError,
    RedisOrmQueryError,
    RedisOrmSchemaError,
    redisOrm,
} from "./src/"; // from "ts-redis-orm"

@Entity({connection: "default", table: "entity", indexUpdatedAt: true})
class MyEntity extends BaseEntity {
    @Column({primary: true, autoIncrement: true})
    public id: number = 0;

    @Column({unique: true})
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
    entity1.setValues({id: 1});
    entity1.increment("number", 10);
    entity1.createdAt = new Date(); // auto added into entity
    entity1.updatedAt = new Date(); // auto added into entity
    entity1.deletedAt = new Date(); // auto added into entity

    // get values
    const id1 = entity1.id;
    const values1 = entity1.getValues();
    const entityId = entity1.getEntityId(); // internal identifier for the entity

    // save
    await entity1.save();
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

    // query deleted (you can only query exist or delete records, but not both)
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
    const events = MyEntity.getEvents();
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
};
