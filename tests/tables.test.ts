import { assert, expect } from "chai";
import {BaseEntity, Column, Entity, RedisOrmEntityError, RedisOrmSchemaError} from "../src/";

@Entity({table: "testing_tables"})
class TestingTables extends BaseEntity {
    @Column({primary: true})
    public table: string = "";

    @Column({primary: true})
    public numberId: number = 0;

    @Column({index: true})
    public index: number = 0;

    @Column()
    public value: number = 0;
}

@Entity({table: "testing_tables_invalid"})
class TestingTablesInvalid extends BaseEntity {
    @Column({primary: true})
    public table: string = "";

    @Column({primary: true})
    public numberId: number = 0;

    @Column()
    public myValue: number = 0;
}

const table1 = "testing_tables1";
const table2 = "testing_tables2";
const exportFile = "./tests/exports/exportTablesTest.txt";

describe("Tables Test", () => {
    const table1Total = 10;
    const table2Total = 100;

    it("truncate", async () => {
        await TestingTables.connect(table1);
        await TestingTables.connect(table2);

        await TestingTables.truncate("TestingTables");
        await TestingTables.truncate("TestingTables", table1);
        await TestingTables.truncate("TestingTables", table2);
        await TestingTablesInvalid.truncate("TestingTablesInvalid");
    });

    it("create entity for table 1", async () => {
        for (let i = 0; i < table1Total; i++) {
            const entity = new TestingTables();
            entity.setTable(table1);
            entity.table = table1;
            entity.numberId = i + 1;
            entity.index = i;
            await entity.save();
        }
    });

    it("create entity for table 2", async () => {
        for (let i = 0; i < table2Total; i++) {
            const entity = new TestingTables();
            entity.setTable(table2);
            entity.table = table2;
            entity.numberId = i + 1;
            entity.index = i;
            await entity.save();
        }
    });

    it("query", async () => {
        const value = 1001;
        const total1 = await TestingTables.query().setTable(table1).count();
        const total2 = await TestingTables.query().setTable(table2).count();
        const sum1 = await TestingTables.query().setTable(table1).sum("index");
        const sum2 = await TestingTables.query().setTable(table2).sum("index");

        assert.equal(total1, table1Total);
        assert.equal(total2, table2Total);
        assert.notEqual(sum1, sum2);

        // normal query
        const entity1 = await TestingTables
            .query()
            .setTable(table1)
            .where("index", "=", 0)
            .first();
        const entity2 = await TestingTables
            .query()
            .setTable(table2)
            .where("index", "=", 0)
            .first();
        assert.isDefined(entity1);
        assert.isDefined(entity2);

        if (entity1 && entity2) {
            assert.equal(entity1.table, table1);
            assert.equal(entity1.getTable(), table1);
            entity1.value = 1001;
            await entity1.save();
            await entity1.delete();

            assert.equal(entity2.table, table2);
            assert.equal(entity2.getTable(), table2);
            entity2.value = 1001;
            await entity2.save();
            await entity2.delete();
        }

        // onlyDeleted query
        const entity1a = await TestingTables
            .query()
            .setTable(table1)
            .onlyDeleted()
            .where("value", "=", value)
            .first();
        const entity2a = await TestingTables
            .query()
            .setTable(table2)
            .onlyDeleted()
            .where("value", "=", value)
            .first();
        assert.isDefined(entity1a);
        assert.isDefined(entity2a);

        if (entity1a && entity2a) {
            assert.equal(entity1a.value, value);
            assert.isTrue(entity1a.isDeleted);
            await entity1a.restore();
            
            assert.equal(entity2a.value, value);
            assert.isTrue(entity2a.isDeleted);
            await entity2a.restore();
        }

        // multiple query
        const entity1b = await TestingTables
            .query()
            .setTable(table1)
            .where("index", "=", 0)
            .where("value", "=", value)
            .first();
        const entity2b = await TestingTables
            .query()
            .setTable(table2)
            .where("index", "=", 0)
            .where("value", "=", value)
            .first();
        assert.isDefined(entity1b);
        assert.isDefined(entity2b);
    });

    it("import/export", async () => {
        await TestingTables.export(exportFile, table1);
        await TestingTables.truncate("TestingTables", table2);
        const count2a = await TestingTables.query().setTable(table2).count();
        assert.equal(count2a, 0);

        await TestingTables.import(exportFile, false, table2);
        const count1b = await TestingTables.query().setTable(table1).count();
        const count2b = await TestingTables.query().setTable(table2).count();
        assert.equal(count1b, table1Total);
        assert.equal(count1b, count2b);
    });

    it("connect/resyncDb", async () => {
        // ok
        await TestingTablesInvalid.connect();

        // invalid schemas
        try {
            await TestingTablesInvalid.connect(table1);
            assert.isTrue(false);
        } catch (err) {
            assert.isTrue(err instanceof RedisOrmSchemaError);
        }

        // ok
        const entity1 = new TestingTablesInvalid();
        entity1.table = "table";
        entity1.numberId = 1001;
        entity1.myValue = 1001;
        await entity1.save();

        // invalid schemas
        try {
            const entity2 = new TestingTablesInvalid();
            entity2.setTable(table1);
            entity2.table = table1;
            entity2.numberId = 1002;
            entity2.myValue = 1002;
            await entity2.save();
            assert.isTrue(false);
        } catch (err) {
            assert.isTrue(err instanceof RedisOrmSchemaError);
        }

        // resync schema
        await TestingTablesInvalid.resyncDb(table1);
        const entity3 = new TestingTablesInvalid();
        entity3.setTable(table1);
        entity3.table = table1;
        entity3.numberId = 1003;
        entity3.myValue = 1003;
        await entity3.save();

        // query form different class
        const entity3a = await TestingTablesInvalid.query().setTable(table1).find({table: table1, numberId: 1003});
        assert.isDefined(entity3a);
        if (entity3a) {
            assert.equal(entity3a.getTable(), table1);
            entity3a.myValue = 1004;
            await entity3a.save();
        }

        // invalid schemas
        const entity3b = await TestingTables.query().setTable(table1).find({table: table1, numberId: 1003});
        assert.isDefined(entity3b);
        if (entity3b) {
            try {
                entity3b.value = 1003;
                await entity3b.save();
                assert.isTrue(false);
            } catch (err) {
                assert.isTrue(err instanceof RedisOrmSchemaError);
            }
        }
    });


});

describe("Clean up", () => {
    it("truncate", async () => {
        await TestingTables.truncate("TestingTables");
        await TestingTables.truncate("TestingTables", table1);
        await TestingTables.truncate("TestingTables", table2);
        await TestingTablesInvalid.truncate("TestingTablesInvalid");
    });
});
