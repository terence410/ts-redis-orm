import { assert, expect } from "chai";
import {BaseEntity, Column, Entity, RedisOrmSchemaError} from "../src/";

@Entity({table: "TestingSchema", connection: "default"})
class TestingSchema1 extends BaseEntity {
    @Column({ autoIncrement: true})
    public id: number = 0;

    @Column()
    public type: string = "";

    @Column()
    public existNumber1: number = 0;

    @Column({index: true})
    public index1: number = 0;

    @Column()
    public index2: number = 0;

    @Column({unique: true})
    public unique1: number = 0;
}

@Entity({table: "TestingSchema", connection: "default"})
class TestingSchema2 extends BaseEntity {
    @Column({ autoIncrement: false})
    public id: number = 0;

    @Column()
    public type: Date = new Date();

    @Column()
    public existNumber2: number = 0;

    @Column()
    public index1: number = 0;

    @Column({index: true})
    public index2: number = 0;

    @Column()
    public unique1: number = 0;

    @Column({unique: true})
    public unique2: number = 0;
}

@Entity({table: "TestingSchema", connection: "default"})
class TestingSchema3 extends BaseEntity {
    @Column()
    public id: string = "";
}

describe("Schema Test", () => {
    const errors = [
        "Column: existNumber2 does not exist in remote schemas",
        "Incompatible autoIncrement on column: id, current value: false, remove value: true",
        "Incompatible index on column: index1, current value: false, remove value: true",
        "Incompatible index on column: index2, current value: true, remove value: false",
        "Incompatible type on column: type, current value: Date, remove value: String",
        "Incompatible unique on column: unique1, current value: false, remove value: true",
        "Column: unique2 does not exist in remote schemas",
        "Column: existNumber1 does not exist in current schemas",
    ];

    it("truncate", async () => {
        await TestingSchema1.truncate("TestingSchema1");
    });

    it("schema 1 create > schema 2 has error", async () => {
        await TestingSchema1.connect();
        await TestingSchema2.connect();

        const entity1 = new TestingSchema1();
        await entity1.save();

        // connect will check schemas
        try {
            await TestingSchema2.connect();
            assert.isTrue(false);
        } catch (err) {
            assert.isTrue(err instanceof RedisOrmSchemaError);
        }

        try {
            const entity2 = new TestingSchema2();
            entity2.id = -1;
            await entity2.save();
            assert.isTrue(false);
        } catch (err) {
            if (err instanceof RedisOrmSchemaError) {
                const connectError = err as RedisOrmSchemaError;
                assert.isTrue(connectError.errors.length > 0);
                assert.deepEqual(errors, connectError.errors);
            } else {
                assert.isTrue(false);
            }
        }
    });

    it("schema 1 truncate > schema 2 create > schema 1 has error", async () => {
        await TestingSchema1.truncate("TestingSchema1");

        const entity2 = new TestingSchema2();
        entity2.id = -2;
        await entity2.save();

        // this will instead cause error
        const entity1 = new TestingSchema1();
        try {
            await entity1.save();
            assert.isTrue(false);
        } catch (err) {
            assert.match(err.message, /Mismatch with remote Schemas/);
        }

        // clear all data
        await TestingSchema2.truncate("TestingSchema2");
    });

    it("create entities on schema 2", async () => {
        const duplicatedEntity = TestingSchema2.create({
            id: -100,
            index1: 0,
            index2: 0,
            unique1: 0,
            unique2: -1,
        });
        await duplicatedEntity.save();

        for (let i = 0; i < 100 ; i++) {
            const entity = TestingSchema2.create({
                id: i + 1,
                index1: i,
                index2: i,
                unique1: i,
                unique2: i,
            });
            await entity.save();
        }
    });

    it("schema 1 resync db: error on duplicated key", async () => {
        try {
            await TestingSchema1.resyncDb();
            assert.isTrue(false);
        } catch (err) {
            assert.match(err.message, /Unique key "unique1" with value "0" already exist on entity id/);
        }
    });

    it("schema 1 resync db > schema 2 has error", async () => {
        // fix unique error
        const [duplicatedEntity] = await TestingSchema2.find(-100);
        assert.isDefined(duplicatedEntity);
        if (duplicatedEntity) {
            await duplicatedEntity.delete();
        }

        // resync db
        await TestingSchema1.resyncDb();

        // this will instead cause error
        const entity2 = TestingSchema2.create({id: -100});
        try {
            await entity2.save();
            assert.isTrue(false);
        } catch (err) {
            assert.match(err.message, /Mismatch with remote Schemas/);
        }
    });
});

describe("Clean up", () => {
    it("truncate", async () => {
        await TestingSchema1.truncate("TestingSchema1");
    });
});
