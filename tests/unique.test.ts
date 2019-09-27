import { assert, expect } from "chai";
import {BaseEntity, Column, Entity} from "../src/";

@Entity({table: "testing_unique"})
class TestingUnique extends BaseEntity {
    @Column({primary: true, autoIncrement: true})
    public id: number = 0;

    @Column({unique: true})
    public uniqueString: string = "";

    @Column({unique: true})
    public uniqueNumber: number = 0;
}

describe("Unique Test", () => {
    it("truncate", async () => {
        await TestingUnique.truncate("TestingUnique");
    });

    it("create entity: default values", async () => {
        const unique = 1;
        const entity = new TestingUnique();
        await entity.save();

        let newEntity = await TestingUnique.query().findUnique("uniqueNumber", 0);
        assert.isDefined(newEntity);

        newEntity = await TestingUnique.query().findUnique("uniqueString", "");
        assert.isDefined(newEntity);

        // we can't create new entity without assigning unique values
        try {
            newEntity = new TestingUnique();
            await newEntity.save();
            assert.isTrue(false);
        } catch (err) {
            //
        }
    });

    it("create entity: softDelete", async () => {
        const uniqueNumber = 2;
        const uniqueString = "two";
        const entity = new TestingUnique();
        entity.uniqueNumber = uniqueNumber;
        entity.uniqueString = uniqueString.toString();
        await entity.save();
        await entity.delete();

        let newEntity = await TestingUnique.query().findUnique("uniqueNumber", uniqueNumber);
        assert.isUndefined(newEntity);

        newEntity = await TestingUnique.query().onlyDeleted().findUnique("uniqueNumber", uniqueNumber);
        assert.isUndefined(newEntity);

        newEntity = await TestingUnique.query().onlyDeleted().findUnique("uniqueString", uniqueString);
        assert.isUndefined(newEntity);
    });

    it("create entity: forceDelete", async () => {
        const uniqueNumber = 3;
        const uniqueString = "three";
        const entity = new TestingUnique();
        entity.uniqueNumber = uniqueNumber;
        entity.uniqueString = uniqueString.toString();
        await entity.save();
        await entity.delete();

        // we can't create new entity since the entity is soft delete
        try {
            const newEntity = new TestingUnique();
            newEntity.uniqueNumber = uniqueNumber;
            newEntity.uniqueString = uniqueString.toString();
            await newEntity.save();
            assert.isTrue(false);
        } catch (err) {
            //
        }

        // force delete
        await entity.forceDelete();

        // we can create the entity now
        try {
            const newEntity = new TestingUnique();
            newEntity.uniqueNumber = uniqueNumber;
            newEntity.uniqueString = uniqueString.toString();
            await newEntity.save();
        } catch (err) {
            assert.isTrue(false);
        }
    });

    it("create entity: update unique values", async () => {
        const uniqueNumber = 4;
        const uniqueString = "four";
        const entity = new TestingUnique();
        entity.uniqueNumber = uniqueNumber;
        entity.uniqueString = uniqueString.toString();
        await entity.save();
        entity.uniqueNumber = 5;
        entity.uniqueString = "five";
        await entity.save();

        // create a new entity
        const newEntity = new TestingUnique();
        newEntity.uniqueNumber = uniqueNumber;
        newEntity.uniqueString = uniqueString.toString();
        await newEntity.save();
    });
});

describe("Clean up", () => {
    it("truncate", async () => {
        await TestingUnique.truncate("TestingUnique");
    });
});
