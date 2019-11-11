import {assert, expect } from "chai";
import {BaseEntity, Column, Entity} from "../src/";

type IObject = undefined | {
    name: string;
    createdAt: Date;
};

@Entity({connection: "default", table: "testing_export"})
class TestingExport extends BaseEntity {
    @Column({primary: true, autoIncrement: true})
    public id: number = 0;

    @Column({unique: true})
    public uniqueString: string = "";

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
}

@Entity({connection: "default", table: "testing_new_export"})
class TestingNewExport extends BaseEntity {
    @Column({primary: true, autoIncrement: true})
    public id: number = 0;
}

describe("Export Test", () => {
    const totalEntity = 100;
    const exportFile = "./tests/exports/exportTest.txt";
    let allExist: TestingExport[] = [];
    let allDeleted: TestingExport[] = [];

    it("truncate", async () => {
        await TestingExport.truncate("TestingExport");
        await TestingNewExport.truncate("TestingNewExport");
    });

    it("add / delete entities", async () => {
        const promises: Array<Promise<any>> = [];
        const now = new Date();
        const indexNumber = 101;
        for (let i = 0; i < totalEntity; i++) {
            const entity = new TestingExport();
            entity.uniqueNumber = i + 1;
            entity.uniqueString = Math.random().toString();
            entity.number = indexNumber;
            entity.date = new Date(now.getTime() * Math.random());
            entity.boolean = Math.random() > 0.5;
            entity.array = new Array(Math.random() * 20 | 0).fill(1);
            entity.object = {name: "redis", createdAt: new Date()};
            promises.push(entity.save());
        }
        await Promise.all(promises);

        const all = await TestingExport.all();
        for (let i = 0; i < all.length; i++) {
            if (i % 2 === 0) {
                const entity = all[i];
                await entity.delete();
            }
        }

        allExist = await TestingExport.all();
        allDeleted = await TestingExport.query().onlyDeleted().get();
    });

    it("export and import from file", async () => {
        const entity = await TestingExport.query().limit(1).first();
        await TestingExport.export(exportFile);
        await TestingExport.truncate("TestingExport");
        await TestingExport.import(exportFile);
        const foundEntity = await TestingExport.query().limit(1).first();

        const currentAllExist = await TestingExport.all();
        const currentAllDeleted = await TestingExport.query().onlyDeleted().get();

        assert.equal(allExist.length, currentAllExist.length);
        assert.equal(allDeleted.length, currentAllDeleted.length);

        for (let i = 0; i < allExist.length; i++) {
            assert.deepEqual(allExist[i].getValues(), currentAllExist[i].getValues());
        }

        for (let i = 0; i < allDeleted.length; i++) {
            assert.deepEqual(allDeleted[i].getValues(), currentAllDeleted[i].getValues());
        }

        // validate the entity
        assert.isDefined(entity);
        assert.isDefined(foundEntity);

        // validate object date is correct
        if (entity && foundEntity && entity.object && foundEntity.object) {
            assert.isTrue(entity.object.createdAt instanceof Date);
            assert.isTrue(foundEntity.object.createdAt instanceof Date);
            assert.equal(entity.object.createdAt.getTime(), foundEntity.object.createdAt.getTime());
        }
    });

    it("create new entity with auto increment", async () => {
        const entity = TestingExport.create({});
        entity.uniqueNumber = totalEntity + 1;
        await entity.save();
        assert.equal(entity.id, totalEntity + 1);
    });

    it("import into another db", async () => {
        try {
            await TestingNewExport.import(exportFile);
            assert.isTrue(false);
        } catch (err) {
            assert.equal(err.message, 
                "Class name: TestingNewExport does not match with the import file: TestingExport");
        }
        
        // by pass schemas eheck
        await TestingNewExport.import(exportFile, true);
        const count = await TestingNewExport.count();
        assert.equal(count, totalEntity / 2);
    });
});

describe("Clean up", () => {
    it("truncate", async () => {
        await TestingExport.truncate("TestingExport");
        await TestingNewExport.truncate("TestingNewExport");
    });
});
