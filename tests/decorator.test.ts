import { assert, expect } from "chai";
import {BaseEntity, Column, Entity, RedisOrmSchemaError} from "../src/";

describe("Decorator Test", () => {
    it("test 1", async () => {
        try {
            @Entity({table: "TestingDecorator", connection: "default"})
            class TestingDecorator1 extends BaseEntity {
                @Column()
                public value: number = 0;
            }
            assert.isTrue(false);
        } catch (err) {
            assert.equal(err.message, "(TestingDecorator1) No primary keys exist for this entity");
        }
    });

    it("test 2", async () => {
        try {
            @Entity({table: "TestingDecorator", connection: "default"})
            class TestingDecorator2 extends BaseEntity {
                @Column()
                public id: number = 0;

                @Column({autoIncrement: true})
                public id2: number = 0;
            }
            assert.isTrue(false);
        } catch (err) {
            assert.equal(err.message, "(TestingDecorator2) AutoIncrement can be applied on primary key only");
        }
    });

    it("test 3", async () => {
        try {
            @Entity({table: "TestingDecorator", connection: "default"})
            class TestingDecorator3 extends BaseEntity {
                @Column({unique: true})
                public id: number = 0;

                @Column()
                public string: string = "";
            }
            assert.isTrue(false);
        } catch (err) {
            assert.equal(err.message, "(TestingDecorator3) Primary key should not be set to unique");
        }
    });

    it("test 4", async () => {
        try {
            @Entity({table: "TestingDecorator", connection: "default"})
            class TestingDecorator4 extends BaseEntity {
                @Column()
                public id: Date = new Date();
            }
            assert.isTrue(false);
        } catch (err) {
            assert.equal(err.message, "(TestingDecorator4) Primary key only supports String or Number");
        }
    });

    it("test 5", async () => {
        try {
            @Entity({table: "TestingDecorator", connection: "default"})
            class TestingDecorator5 extends BaseEntity {
                @Column()
                public id: string = "";

                @Column({index: true})
                public string: string = "";
            }
            assert.isTrue(false);
        } catch (err) {
            assert.equal(err.message, "(TestingDecorator5) Index only supports Number, Boolean or Date");
        }
    });

    it("test 6", async () => {
        try {
            @Entity({table: "TestingDecorator", connection: "default"})
            class TestingDecorator6 extends BaseEntity {
                @Column()
                public id: string = "";

                @Column({unique: true})
                public date: Date = new Date();
            }
            assert.isTrue(false);
        } catch (err) {
            assert.equal(err.message, "(TestingDecorator6) Unique only supports String or Number");
        }
    });

    it("test 7", async () => {
        try {
            @Entity({table: "TestingDecorator", connection: "default"})
            class TestingDecorator7 extends BaseEntity {
                @Column()
                public id: string = "";

                @Column({index: true})
                public createdAt: Date = new Date();
            }
            assert.isTrue(false);
        } catch (err) {
            assert.equal(err.message, "(TestingDecorator7) createdAt is a preserved column name");
        }
    });

    it("test 8", async () => {
        try {
            @Entity({table: "Testing:Decorator", connection: "default"})
            class TestingDecorator8 extends BaseEntity {
                @Column()
                public id: string = "";
            }
            assert.isTrue(false);
        } catch (err) {
            assert.equal(err.message, "(TestingDecorator8) table and tablePrefix must not contains \":\"");
        }
    });
});
