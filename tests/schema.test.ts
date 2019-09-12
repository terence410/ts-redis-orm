import { assert, expect } from "chai";
import {BaseEntity, Column, Entity, RedisOrmSchemaError} from "../src/";

@Entity({table: "testing_schema", connection: "default"})
class TestingSchema1 extends BaseEntity {
    @Column({primary: true, autoIncrement: true})
    public id: number = 0;

    @Column({index: true})
    public indexNumber: number = 0;

    @Column({unique: true})
    public uniqueNumber: number = 0;

    @Column()
    public type: string = "";

    @Column()
    public number1: number = 0;
}

@Entity({table: "testing_schema", connection: "default"})
class TestingSchema2 extends BaseEntity {
    @Column({primary: true})
    public key: string = "";

    @Column()
    public id: number = 0;

    @Column()
    public indexNumber: number = 0;

    @Column()
    public uniqueNumber: number = 0;

    @Column()
    public type: Date = new Date();

    @Column()
    public number2: number = 0;
}

describe("Schema Test", () => {
    const errors = [
        "Column: key does not exist in remote schemas",
        "Column: id has different autoIncrement. The current autoIncrement: false is different with the remote autoIncrement: true ",
        "Column: id has different primary. The current primary: false is different with the remote primary: true ",
        "Column: indexNumber has different index. The current index: false is different with the remote index: true ",
        "Column: uniqueNumber has different unique. The current unique: false is different with the remote unique: true ",
        "Column: type has different type. The current type: Date is different with the remote type: String ",
        "Column: number2 does not exist in remote schemas",
        "Column: number1 does not exist in client schemas",
    ];

    it("Resync schema", async () => {
        try {
            await TestingSchema1.connect();
        } catch (err) {
            if (err instanceof RedisOrmSchemaError) {
                await TestingSchema1.resyncSchemas();
            }
        }
    });

    it("Prompt Error for mismatch schema", async () => {
        // throw errors upon connect
        try {
            await TestingSchema2.connect();
        } catch (err) {
            if (err instanceof RedisOrmSchemaError) {
                const connectError = err as RedisOrmSchemaError;
                assert.isTrue(connectError.errors.length > 0);
                assert.deepEqual(errors, connectError.errors);
            } else {
                assert.isTrue(false);
            }
        }

        // throw errors upon save
        try {
            const entity = new TestingSchema2();
            entity.key = "1";
            await entity.save();
        } catch (err) {
            if (err instanceof RedisOrmSchemaError) {
                const connectError = err as RedisOrmSchemaError;
                assert.isTrue(connectError.errors.length > 0);
            } else {
                assert.isTrue(false);
            }
        }
    });
});
