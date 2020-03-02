import {assert, expect } from "chai";
import clone from "clone";
import {BaseEntity, Column, Entity, RedisOrmOperationError} from "../src/";
import {RedisOrmError} from "../src/errors/RedisOrmError";
import {redisOrm} from "../src/redisOrm";

type NullableString = string | null;
type IObject = undefined | {
    createdAt: Date;
    name: string;
};

@Entity({connection: "default", table: "TestingGeneral"})
class TestingGeneral extends BaseEntity {
    @Column({autoIncrement: true})
    public id: number = 0;

    @Column()
    public string1: string = "";

    @Column()
    public string2: string = "";

    @Column({unique: true, index: true})
    public uniqueNumber: number = 0;

    @Column({index: true})
    public number: number = 0;

    @Column({index: true})
    public date: Date = new Date();

    @Column({index: true})
    public boolean: boolean = false;

    @Column()
    public array: number[] = [];

    @Column()
    public object: IObject;

    @Column()
    public objectArray: any;
}

describe("General Test: Internal", () => {
    it("truncate", async () => {
        await TestingGeneral.truncate("TestingGeneral");
    });

    it("check count", async () => {
        const [total, perforamnceResult] = await TestingGeneral.count();
        assert.equal(total, 0);
    });

    it("meta", async () => {
        assert.equal(redisOrm.getDefaultTable(TestingGeneral), "TestingGeneral");
        assert.deepEqual(redisOrm.getPrimaryKey(TestingGeneral), "id");
        assert.equal(redisOrm.getAutoIncrementKey(TestingGeneral), "id");
        assert.includeMembers(redisOrm.getIndexKeys(TestingGeneral), ["uniqueNumber", "date", "boolean"]);
        assert.deepEqual(redisOrm.getUniqueKeys(TestingGeneral), ["uniqueNumber"]);
    });
});

describe("General Test: Create Entity", () => {
    it("clone entity", async () => {
        const entity = new TestingGeneral();
        const newEntity = clone(entity);
    });

    it("new entity", async () => {
        const entity = new TestingGeneral();
        assert.isTrue(entity.isNew);
        assert.isFalse(isNaN(entity.createdAt.getTime()));
    });

    it("check default value", async () => {
        const entity = new TestingGeneral();
        (entity as any)._storageStrings = {};
        (entity as any)._values = {};

        assert.equal(entity.string1, "");
        assert.isTrue(isNaN(entity.id));
        assert.isTrue(isNaN(entity.number));
        assert.isTrue(isNaN(entity.uniqueNumber));
        assert.isTrue(isNaN(entity.date.getTime()));
        assert.equal(entity.boolean, false);
        assert.equal(entity.array, undefined);
        assert.equal(entity.object, undefined);
    });

    it("create entity: find", async () => {
        const id = 1;
        const entity = new TestingGeneral();
        entity.id = id;
        entity.uniqueNumber = id;
        entity.number = 0;
        entity.object = {createdAt: new Date(), name: "Michael Jackson"};
        entity.objectArray = [{createdAt: new Date(), name: "Michael Jackson"}];
        entity.array.push(1);
        entity.getValues().array.push(2);
        
        await entity.save();
        assert.isFalse(entity.isNew);
        assert.equal(entity.getEntityId(), id.toString());

        const [newEntity] = await TestingGeneral.find(id);
        assert.isDefined(newEntity);
        if (newEntity) {
            assert.deepEqual(entity.getValues(), newEntity.getValues());

            if (newEntity.object) {
                assert.isTrue(newEntity.object.createdAt instanceof Date);
                assert.equal(entity.object.createdAt.getTime(), newEntity.object.createdAt.getTime());
            }
        }
    });

    it("create entity: findUnique", async () => {
        const id = 2;
        const entity = TestingGeneral.create({id, uniqueNumber: id});
        await entity.save();

        const [newEntity] = await TestingGeneral.query().findUnique("uniqueNumber", id);
        assert.isDefined(newEntity);
        if (newEntity) {
            assert.deepEqual(entity.getValues(), newEntity.getValues());
        }
    });

    it("create entity: clone", async () => {
        const id = 4;
        const newId = 5;
        const entity = TestingGeneral.create({id, uniqueNumber: id});
        await entity.save();

        const newEntity = entity.clone();
        assert.isTrue(newEntity.isNew);
        assert.deepEqual(entity.getValues(), newEntity.getValues());

        // we cannot save
        try {
            await newEntity.save();
            assert.isTrue(false);
        } catch (err) {
            if (!(err instanceof RedisOrmOperationError)) {
                assert.isTrue(false);
            }

            if (!(err instanceof RedisOrmError)) {
                assert.isTrue(false);
            }
        }

        // assign id = 0 and unique number
        newEntity.id = 0;
        newEntity.uniqueNumber = newId;
        await newEntity.save();
        assert.isFalse(newEntity.isNew);
        assert.equal(newEntity.id, newId);
    });

    it("create entity: custom createdAt", async () => {
        const id = 6;
        const createdAt = new Date(0);
        const entity = TestingGeneral.create({id, uniqueNumber: id});
        entity.setValues({createdAt});
        await entity.save();

        assert.equal(entity.createdAt.getTime(), createdAt.getTime());

        const [newEntity] = await TestingGeneral.find(id);
        assert.isDefined(newEntity);
        if (newEntity) {
            assert.equal(entity.createdAt.getTime(), newEntity.createdAt.getTime());
        }
    });

    it("create entity: non index search", async () => {
        const id = 8;
        const string1 = "abcdefg";
        const string2 = "tuvwxyz";
        const entity = TestingGeneral.create({id, uniqueNumber: id, string1, string2});
        await entity.save();

        // found the entity with "="
        let [newEntity] = await TestingGeneral.query()
            .where("string1", "=", string1)
            .where("string2", "=", string2)
            .runOnce();
        assert.isDefined(newEntity);
        if (newEntity) {
            assert.equal(entity.id, newEntity.id);
        }
        // found the entity with "=", but not matching all condition
        [newEntity] = await TestingGeneral.query()
            .where("string1", "=", string1)
            .where("string2", "!=", string2)
            .runOnce();
        assert.isUndefined(newEntity);

        // found the entity with "like
        [newEntity] = await TestingGeneral.query()
            .where("string1", "like", string1.substr(0, 3))
            .where("string2", "like", string2.substr(0, 3))
            .runOnce();
        assert.isDefined(newEntity);
        if (newEntity) {
            assert.equal(entity.id, newEntity.id);
        }
    });

    it("create entity: mixed query", async () => {
        const ids = [11, 12, 13, 14, 15];
        for (const id of ids) {
            const entity = TestingGeneral.create({id, uniqueNumber: id, number: id});
            await entity.save();
        }

        let [entities] = await TestingGeneral.query()
            .findMany([...ids, ids[ids.length - 1] + 1]);
        assert.deepEqual(entities.map(x => x.id), ids);

        [entities] = await TestingGeneral.query()
            .findUniqueMany("uniqueNumber", [...ids, ids[ids.length - 1] + 1]);
        assert.deepEqual(entities.map(x => x.id), ids);

        [entities] = await TestingGeneral
            .query()
            .where("number", ">=", ids[0])
            .where("number", "<=", ids[ids.length - 1])
            .run();
        assert.deepEqual(entities.map(x => x.id), ids);

        // sort
        [entities] = await TestingGeneral
            .query()
            .where("number", ">=", ids[0])
            .sortBy("number", "asc")
            .offset(1)
            .limit(2)
            .run();
        assert.deepEqual(entities.map(x => x.id), ids.slice(1, 3));

        // sort with last one
        [entities] = await TestingGeneral
            .query()
            .where("number", ">=", ids[0])
            .sortBy("number", "desc")
            .offset(1)
            .limit(2)
            .run();
        assert.deepEqual(entities.map(x => x.id), ids.reverse().slice(1, 3));
    });

    it("save an deleted entity", async () => {
        const id = 21;
        const entity = TestingGeneral.create({id, uniqueNumber: id, number: id});
        await entity.save();

        const [newEntity] = await TestingGeneral.find(id);
        assert.isDefined(newEntity);

        // delete entity
        if (newEntity) {
            await newEntity.delete();
        }

        // save an deleted entity
        try {
            entity.string2 = "happy";
            await entity.save();
            assert.isTrue(false);
        } catch (err) {
            assert.equal(err.message, `(${TestingGeneral.name}, TestingGeneral) Entity not exist. Entity Id "${entity.getEntityId()}"`);
        }

        // delete an deleted entity
        try {
            await entity.delete();
            assert.isTrue(false);
        } catch (err) {
            assert.equal(err.message, `(${TestingGeneral.name}, TestingGeneral) Entity not exist. Entity Id "${entity.getEntityId()}"`);
        }
    });

    it("create entity: massive create", async () => {
        const totalEntity = 100;
        const promises: Array<Promise<any>> = [];
        const now = new Date();
        const indexNumber = 101;
        for (let i = 0; i < totalEntity; i++) {
            const entity = new TestingGeneral();
            entity.id = i + totalEntity + 1;
            entity.uniqueNumber = entity.id;
            entity.number = indexNumber;
            entity.date = new Date(now.getTime() * Math.random());
            entity.boolean = Math.random() > 0.5;
            entity.array = new Array(Math.random() * 20 | 0).fill(1);
            entity.string1 = Math.random().toString();
            entity.object = {createdAt: new Date(), name: "Anonymous"};
            promises.push(entity.save());
        }
        await Promise.all(promises);

        const [total] = await TestingGeneral
            .query()
            .where("number", "=", indexNumber)
            .count();
        assert.equal(total, totalEntity);

        const entities = await TestingGeneral
            .query()
            .where("number", "=", indexNumber)
            .run();
    });

    it("create entity: increment errors", async () => {
        const id = 1001;
        const entity = TestingGeneral.create({id, uniqueNumber: id});

        // new model
        try {
            entity.increment("number", 10);
            assert.isTrue(false);
        } catch (err) {
            assert.match(err.message, /You cannot increment a new entity/);
        }

        // save it
        await entity.save();

        // primary column
        try {
            entity.increment("id", 10);
            assert.isTrue(false);
        } catch (err) {
            assert.match(err.message, /You cannot increment primary key/);
        }

        // unique column
        try {
            entity.increment("uniqueNumber", 10);
            assert.isTrue(false);
        } catch (err) {
            assert.match(err.message, /You cannot increment unique key/);
        }

        // not integer
        try {
            entity.increment("number", 10.1);
            assert.isTrue(false);
        } catch (err) {
            assert.match(err.message, /Increment value need to be an integer/);
        }
    });

    it("create entity: increment", async () => {
        const initialValue = 10;
        const updateValue = 30;
        const column = "number";

        const id = 1002;
        const entity = new TestingGeneral();
        entity.setValues({number: initialValue, id, uniqueNumber: id});
        await entity.save();

        // check index
        let [total] = await TestingGeneral.query().where(column, "=", entity.number).count();
        assert.equal(total, 1);

        entity.increment(column, updateValue);
        await entity.save();
        assert.equal(entity.number, initialValue + updateValue);
        //
        // index is updated
        [total] = await TestingGeneral.query().where(column, "=", entity.number).count();
        assert.equal(total, 1);

        // increment again and also do a set
        entity.increment(column, updateValue);
        entity.number = 101;
        await entity.save();
        assert.equal(entity.number, initialValue + updateValue * 2);

        const [newEntity] = await TestingGeneral.find(id);
        assert.isDefined(newEntity);
        if (newEntity) {
            assert.deepEqual(entity.number, newEntity.number);
        }
    });
});

describe("Events", () => {
    it("create, update, delete", async () => {
        const id = 10001;
        const entity = TestingGeneral.create({id, uniqueNumber: id});
        const events = TestingGeneral.getEvents();
        let createdEntity: any = null;
        let updatedEntity: any = null;
        let forcedDeletedEntity: any = null;

        // create
        const promise1 = new Promise(resolve => {
            events.once("create", (thisEntity) => {
                createdEntity = thisEntity;
                resolve();
            });
        });
        await entity.save();
        await promise1;
        assert.isNotNull(createdEntity);
        assert.equal(entity.id, (createdEntity as TestingGeneral).id);

        // create
        entity.string2 = "happy";
        const promise2 = new Promise(resolve => {
            events.once("update", (thisEntity) => {
                updatedEntity = thisEntity;
                resolve();
            });
        });
        await entity.save();
        await promise2;
        assert.isNotNull(updatedEntity);
        assert.equal(entity.string2, (updatedEntity as TestingGeneral).string2);

        // forceDelete
        const promise5 = new Promise(resolve => {
            events.once("delete", (thisEntity) => {
                forcedDeletedEntity = thisEntity;
                resolve();
            });
        });
        await entity.delete();
        await promise5;
        assert.isNotNull(forcedDeletedEntity);
    });
});

describe("Service Instance", () => {
    it("get entities", async () => {
        const entityTypes = redisOrm.getEntityTypes();
        const entityType = entityTypes.find(x => x === TestingGeneral);
        assert.isDefined(entityType);
    });

    it("get schemas list", async () => {
        const schemasList = await redisOrm.getRemoteSchemasList();
        assert.containsAllKeys(schemasList, ["TestingGeneral"]);
    });
});

describe("Clean up", () => {
    it("truncate", async () => {
        await TestingGeneral.truncate("TestingGeneral");
    });
});
