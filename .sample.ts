import {
    BaseEntity,
    Column,
    Entity,
    redisOrm,
    RedisOrmDecoratorError,
    RedisOrmOperationError,
    RedisOrmQueryError,
    RedisOrmSchemaError,
} from "./src/"; // from "ts-redis-orm"

@Entity({connection: "default", table: "Entity", tablePrefix: "Prefix"})
class MyEntity extends BaseEntity {
    @Column({autoIncrement: true})
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
