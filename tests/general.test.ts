import {assert, expect } from "chai";
import {BaseEntity, Column, Entity} from "../src/";
import {serviceInstance} from "../src/serviceInstance";

type NullableString = string | null;

@Entity({connection: "default", table: "testing_general"})
class TestingGeneral extends BaseEntity {
    @Column({primary: true, autoIncrement: true})
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
    public object: any;
}

describe("General Test: Internal", () => {
    it("truncate", async () => {
        await TestingGeneral.truncate("TestingGeneral");
    });

    it("check count", async () => {
        let total = await TestingGeneral.count();
        assert.equal(total, 0);

        total = await TestingGeneral.query().onlyDeleted().count();
        assert.equal(total, 0);
    });

    it("meta", async () => {
        assert.equal(serviceInstance.getTable(TestingGeneral), "testing_general");
        assert.deepEqual(serviceInstance.getPrimaryKeys(TestingGeneral), ["id"]);
        assert.equal(serviceInstance.getAutoIncrementKey(TestingGeneral), "id");
        assert.includeMembers(serviceInstance.getIndexKeys(TestingGeneral), ["uniqueNumber", "date", "boolean"]);
        assert.deepEqual(serviceInstance.getUniqueKeys(TestingGeneral), ["uniqueNumber"]);
    });
});

describe("General Test: Create Entity", () => {
    it("new entity", async () => {
        const entity = new TestingGeneral();
        assert.isTrue(entity.isNew);
        assert.isFalse(isNaN(entity.createdAt.getTime()));
        assert.isFalse(isNaN(entity.updatedAt.getTime()));
        assert.isTrue(isNaN(entity.deletedAt.getTime()));
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
        await entity.save();
        assert.isFalse(entity.isNew);
        assert.equal(entity.getEntityId(), id.toString());

        const newEntity = await TestingGeneral.find(id);
        assert.isDefined(newEntity);
        if (newEntity) {
            assert.deepEqual(entity.getValues(), newEntity.getValues());
        }
    });

    it("create entity: findUnique", async () => {
        const id = 2;
        const entity = TestingGeneral.create({id, uniqueNumber: id});
        await entity.save();

        const newEntity = await TestingGeneral.query().findUnique("uniqueNumber", id);
        assert.isDefined(newEntity);
        if (newEntity) {
            assert.deepEqual(entity.getValues(), newEntity.getValues());
        }
    });

    it("create entity: delete", async () => {
        const id = 3;
        const entity = TestingGeneral.create({id, uniqueNumber: id});
        await entity.save();

        // delete entity
        let newEntity = await TestingGeneral.find(id);
        assert.isDefined(newEntity);
        if (newEntity) {
            await newEntity.delete();
            assert.isFalse(isNaN(newEntity.deletedAt.getTime()));
            assert.isTrue(newEntity.isDeleted);

            // we cannot delete an deleted entity
            try {
                await newEntity.delete();
                assert.isTrue(false);
            } catch (err) {
                // console.log(err);
            }

            // we cannot save an deleted entity
            try {
                await newEntity.save();
                assert.isTrue(false);
            } catch (err) {
                // console.log(err);
            }
        }

        let deletedEntity = await TestingGeneral.find(id);
        assert.isUndefined(deletedEntity);

        // we cannot found by unique key anymore
        const foundDeletedEntity = await TestingGeneral.query().onlyDeleted().findUnique("uniqueNumber", id);
        assert.isUndefined(foundDeletedEntity);

        // restore entity
        deletedEntity = await TestingGeneral.query().onlyDeleted().find(id);
        assert.isDefined(deletedEntity);
        if (deletedEntity) {
            await deletedEntity.restore();
            assert.isFalse(deletedEntity.isDeleted);
        }

        // find again by id
        newEntity = await TestingGeneral.find(id);
        assert.isDefined(newEntity);

        // find again by unique
        newEntity = await TestingGeneral.query().findUnique("uniqueNumber", id);
        assert.isDefined(newEntity);

        // force delete
        if (newEntity) {
            await newEntity.forceDelete();
            assert.isTrue(newEntity.isDeleted);
        }

        // not exist anymore
        deletedEntity = await TestingGeneral.find(id);
        assert.isUndefined(deletedEntity);

        deletedEntity = await TestingGeneral.query().onlyDeleted().findUnique("uniqueNumber", id);
        assert.isUndefined(deletedEntity);
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
            // console.log(err);
        }

        // assign id = 0 and unique number
        newEntity.id = 0;
        newEntity.uniqueNumber = newId;
        await newEntity.save();
        assert.isFalse(newEntity.isNew);
        assert.equal(newEntity.id, newId);
    });

    it("create entity: custom createdAt, updatedAt", async () => {
        const id = 6;
        const createdAt = new Date(0);
        const updatedAt = new Date(1);
        const entity = TestingGeneral.create({id, uniqueNumber: id});
        entity.set({createdAt, updatedAt});
        await entity.save();

        assert.equal(entity.createdAt.getTime(), createdAt.getTime());
        assert.equal(entity.updatedAt.getTime(), updatedAt.getTime());

        const newEntity = await TestingGeneral.find(id);
        assert.isDefined(newEntity);
        if (newEntity) {
            assert.equal(entity.createdAt.getTime(), newEntity.createdAt.getTime());
            assert.equal(entity.updatedAt.getTime(), newEntity.updatedAt.getTime());
        }
    });

    it("create entity: custom deletedAt", async () => {
        const id = 7;
        const deletedAt = new Date(2);
        const entity = TestingGeneral.create({id, uniqueNumber: id});
        await entity.save();
        entity.set({deletedAt});
        await entity.delete();

        // use customized deleted time
        assert.equal(entity.deletedAt.getTime(), deletedAt.getTime());

        // validate the date again
        const newEntity = await TestingGeneral.query().onlyDeleted().find(id);
        assert.isDefined(newEntity);
        if (newEntity) {
            assert.equal(entity.deletedAt.getTime(), newEntity.deletedAt.getTime());
        }
    });

    it("create entity: non index search", async () => {
        const id = 8;
        const string1 = "abcdefg";
        const string2 = "tuvwxyz";
        const entity = TestingGeneral.create({id, uniqueNumber: id, string1, string2});
        await entity.save();

        // found the entity with "="
        let newEntity = await TestingGeneral.query()
            .where("string1", "=", string1)
            .where("string2", "=", string2)
            .first();
        assert.isDefined(newEntity);
        if (newEntity) {
            assert.equal(entity.id, newEntity.id);
        }
        // found the entity with "=", but not matching all condition
        newEntity = await TestingGeneral.query()
            .where("string1", "=", string1)
            .where("string2", "!=", string2)
            .first();
        assert.isUndefined(newEntity);

        // found the entity with "like
        newEntity = await TestingGeneral.query()
            .where("string1", "like", string1.substr(0, 3))
            .where("string2", "like", string2.substr(0, 3))
            .first();
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

        let entities = await TestingGeneral.query()
            .findMany([...ids, ids[ids.length - 1] + 1]);
        assert.deepEqual(entities.map(x => x.id), ids);

        entities = await TestingGeneral.query()
            .findUniqueMany("uniqueNumber", [...ids, ids[ids.length - 1] + 1]);
        assert.deepEqual(entities.map(x => x.id), ids);

        entities = await TestingGeneral
            .query()
            .where("number", ">=", ids[0])
            .where("number", "<=", ids[ids.length - 1])
            .get();
        assert.deepEqual(entities.map(x => x.id), ids);

        // sort
        entities = await TestingGeneral
            .query()
            .where("number", ">=", ids[0])
            .sortBy("number", "asc")
            .offset(1)
            .limit(2)
            .get();
        assert.deepEqual(entities.map(x => x.id), ids.slice(1, 3));

        // sort with last one
        entities = await TestingGeneral
            .query()
            .where("number", ">=", ids[0])
            .sortBy("number", "desc")
            .offset(1)
            .limit(2)
            .get();
        assert.deepEqual(entities.map(x => x.id), ids.reverse().slice(1, 3));
    });

    it("save an deleted entity", async () => {
        const id = 21;
        const entity = TestingGeneral.create({id, uniqueNumber: id, number: id});
        await entity.save();

        const newEntity = await TestingGeneral.find(id);
        assert.isDefined(newEntity);

        // delete entity
        if (newEntity) {
            await newEntity.delete();
            assert.isTrue(newEntity.isDeleted);
        }

        // save an deleted entity
        try {
            entity.string2 = "happy";
            await entity.save();
            assert.isTrue(false);
        } catch (err) {
            assert.equal(err.message, `(${TestingGeneral.name}) Entity not exist or deleted. Entity Id: ${entity.getEntityId()}`);
        }

        // delete an deleted entity
        try {
            await entity.delete();
            assert.isTrue(false);
        } catch (err) {
            assert.equal(err.message, `(${TestingGeneral.name}) Entity already deleted. Entity Id: ${entity.getEntityId()}`);
        }

        // force delete the entity
        if (newEntity) {
            await newEntity.forceDelete();
        }

        // delete an force deleted entity
        try {
            await entity.delete();
            assert.isTrue(false);
        } catch (err) {
            assert.equal(err.message, `(${TestingGeneral.name}) Entity not exist. Entity Id: ${entity.getEntityId()}`);
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
            entity.object = {};
            promises.push(entity.save());
        }
        await Promise.all(promises);

        const total = await TestingGeneral
            .query()
            .where("number", "=", indexNumber)
            .count();
        assert.equal(total, totalEntity);

        const entities = await TestingGeneral
            .query()
            .where("number", "=", indexNumber)
            .get();
    });

    it("create entity: increment errors", async () => {
        const id = 1001;
        const entity = TestingGeneral.create({id, uniqueNumber: id});

        // new model
        try {
            entity.increment("number", 10);
            assert.isTrue(false);
        } catch (err) {
            //
        }

        // save it
        await entity.save();

        // primary column
        try {
            entity.increment("id", 10);
            assert.isTrue(false);
        } catch (err) {
            //
        }

        // unique column
        try {
            entity.increment("uniqueNumber", 10);
            assert.isTrue(false);
        } catch (err) {
            //
        }

        // not integer
        try {
            entity.increment("number", 10.1);
            assert.isTrue(false);
        } catch (err) {
            //
        }
    });

    it("create entity: increment", async () => {
        const initialValue = 10;
        const updateValue = 30;
        const column = "number";

        const id = 1002;
        const entity = new TestingGeneral();
        entity.set({number: initialValue, id, uniqueNumber: id});
        await entity.save();

        // check index
        let total = await TestingGeneral.query().where(column, "=", entity.number).count();
        assert.equal(total, 1);

        entity.increment(column, updateValue);
        await entity.save();
        assert.equal(entity.number, initialValue + updateValue);
        //
        // index is updated
        total = await TestingGeneral.query().where(column, "=", entity.number).count();
        assert.equal(total, 1);

        // increment again and also do a set
        entity.increment(column, updateValue);
        entity.number = 101;
        await entity.save();
        assert.equal(entity.number, initialValue + updateValue * 2);

        const newEntity = await TestingGeneral.find(id);
        assert.isDefined(newEntity);
        if (newEntity) {
            assert.deepEqual(entity.number, newEntity.number);
        }
    });
});

describe("Events", () => {
    it("create, update, delete, restore, forceDelete", async () => {
        const id = 10001;
        const entity = TestingGeneral.create({id, uniqueNumber: id});
        const events = TestingGeneral.getEventEmitter();
        let createdEntity: any = null;
        let updatedEntity: any = null;
        let deletedEntity: any = null;
        let forcedDeletedEntity: any = null;
        let restoredEntity: any = null;

        // create
        events.once("create", (thisEntity) => {
            createdEntity = thisEntity;
        });
        await entity.save();
        assert.isNotNull(createdEntity);
        assert.equal(entity.id, (createdEntity as TestingGeneral).id);

        // create
        entity.string2 = "happy";
        events.once("update", (thisEntity) => {
            updatedEntity = thisEntity;
        });
        await entity.save();
        assert.isNotNull(updatedEntity);
        assert.equal(entity.string2, (updatedEntity as TestingGeneral).string2);

        // delete
        events.once("delete", (thisEntity) => {
            deletedEntity = thisEntity;
        });
        await entity.delete();
        assert.isNotNull(deletedEntity);
        assert.equal(entity.isDeleted, (deletedEntity as TestingGeneral).isDeleted);

        // restore
        events.once("restore", (thisEntity) => {
            restoredEntity = thisEntity;
        });
        await entity.restore();
        assert.isDefined(restoredEntity);
        assert.equal(entity.isDeleted, (restoredEntity as TestingGeneral).isDeleted);

        // forceDelete
        events.once("forceDelete", (thisEntity) => {
            forcedDeletedEntity = thisEntity;
        });
        await entity.forceDelete();
        assert.isNotNull(forcedDeletedEntity);
        assert.equal(entity.isDeleted, (forcedDeletedEntity as TestingGeneral).isDeleted);
    });
});

describe("Clean up", () => {
    it("truncate", async () => {
        await TestingGeneral.truncate("TestingGeneral");
    });
});
