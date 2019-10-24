import { assert, expect } from "chai";
import {BaseEntity, Column, Entity, RedisOrmSchemaError} from "../src/";

describe("Decorator Test", () => {
    it("test 1", async () => {
        try {
            @Entity({table: "testing_decorator", connection: "default"})
            class TestingDecorator1 extends BaseEntity {
                @Column({autoIncrement: true})
                public id: number = 0;
            }
            assert.isTrue(false);
        } catch (err) {
            assert.equal(err.message, "(TestingDecorator1) AutoIncrement needs pair up with primary key");
        }
    });

    it("test 2", async () => {
        try {
            @Entity({table: "testing_decorator", connection: "default"})
            class TestingDecorator2 extends BaseEntity {
                @Column({primary: true, autoIncrement: true})
                public id1: number = 0;

                @Column({primary: true, autoIncrement: true})
                public id2: number = 0;
            }
            assert.isTrue(false);
        } catch (err) {
            assert.equal(err.message, "(TestingDecorator2) AutoIncrement already exist for column: id1");
        }
    });

    it("test 3", async () => {
        try {
            @Entity({table: "testing_decorator", connection: "default"})
            class TestingDecorator3 extends BaseEntity {
                @Column({primary: true, autoIncrement: true})
                public id1: number = 0;

                @Column({primary: true})
                public string: string = "";
            }
            assert.isTrue(false);
        } catch (err) {
            assert.equal(err.message, "(TestingDecorator3) AutoIncrement can only work with one primary key");
        }
    });

    it("test 4", async () => {
        try {
            @Entity({table: "testing_decorator", connection: "default"})
            class TestingDecorator4 extends BaseEntity {
                @Column({primary: true})
                public id: Date = new Date();
            }
            assert.isTrue(false);
        } catch (err) {
            assert.equal(err.message, "(TestingDecorator4) Primary key only supports String or Number");
        }
    });

    it("test 5", async () => {
        try {
            @Entity({table: "testing_decorator", connection: "default"})
            class TestingDecorator5 extends BaseEntity {
                @Column({primary: true})
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
            @Entity({table: "testing_decorator", connection: "default"})
            class TestingDecorator6 extends BaseEntity {
                @Column({primary: true})
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
            @Entity({table: "testing_decorator", connection: "default"})
            class TestingDecorator7 extends BaseEntity {
                @Column()
                public id: string = "";
            }
            assert.isTrue(false);
        } catch (err) {
            assert.equal(err.message, "(TestingDecorator7) No primary keys exist for this entity");
        }
    });
});
