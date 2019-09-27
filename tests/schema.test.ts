import { assert, expect } from "chai";
import {BaseEntity, Column, Entity, RedisOrmSchemaError} from "../src/";

@Entity({table: "testing_schema", connection: "default", indexUpdatedAt: true})
class TestingSchema1 extends BaseEntity {
    @Column({primary: true, autoIncrement: true})
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

@Entity({table: "testing_schema", connection: "default", indexUpdatedAt: false})
class TestingSchema2 extends BaseEntity {
    @Column({primary: true, autoIncrement: false})
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

@Entity({table: "testing_schema", connection: "default", indexUpdatedAt: false})
class TestingSchema3 extends BaseEntity {
    @Column({primary: true})
    public key: string = "";
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
        "Incompatible index on column: updatedAt, current value: false, remove value: true",
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
            //
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
    }).timeout(100 * 1000);

    it("schema 3 resync db: error on invalid key", async () => {
        try {
            await TestingSchema3.resyncDb();
            assert.isTrue(false);
        } catch (err) {
            assert.equal(err.message, "Resync can only apply to same primary keys. The remote primary key: id is not the same or not exist in current schemas");
        }
    });

    // around 1 seconds for 100, 000 records
    it("schema 1 resync db: error on duplicated key", async () => {
        try {
            await TestingSchema1.resyncDb();
            assert.isTrue(false);
        } catch (err) {
            //
        }
    });

    it("schema 1 resync db > schema 2 has error", async () => {
        // fix unique error
        const duplicatedEntity = await TestingSchema2.find(-100);
        assert.isDefined(duplicatedEntity);
        if (duplicatedEntity) {
            await duplicatedEntity.delete();
        }

        // resync db
        await TestingSchema1.resyncDb();

        // this will instead cause error
        const entity2 = new TestingSchema2();
        try {
            await entity2.save();
            assert.isTrue(false);
        } catch (err) {
            //
        }
    });

    it("schema 1 resync db: restore deleted entity", async () => {
        const duplicatedEntity = await TestingSchema1.query().onlyDeleted().find(-100);
        assert.isDefined(duplicatedEntity);
        if (duplicatedEntity) {
            assert.isTrue(duplicatedEntity.isDeleted);
            
            // we cannot restore since key duplicated
            try {
                await duplicatedEntity.restore();
                assert.isTrue(false);
            } catch (err) {
                assert.equal(err.message, `Unique key: unique1 with value: 0 already exist on entity id: 1. Current entity id: ${duplicatedEntity.id}`);
            }

            // update the value and restore again
            duplicatedEntity.unique1 = -100;
            await duplicatedEntity.restore();
        }
    });
});

describe("Clean up", () => {
    it("truncate", async () => {
        // await TestingSchema1.truncate("TestingSchema1");
    });
});
