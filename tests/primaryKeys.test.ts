import { assert, expect } from "chai";
import {BaseEntity, Column, Entity} from "../src/";

@Entity({table: "testing_primary_keys"})
class TestingPrimaryKeys extends BaseEntity {
    @Column({primary: true, index: true})
    public numberKey1: number = 0;

    @Column({primary: true})
    public numberKey2: number = 0;

    @Column({primary: true})
    public stringKey3: string = "";
}

describe("Primary Keys Test", () => {
    it("truncate", async () => {
        await TestingPrimaryKeys.truncate("TestingPrimaryKeys");
    });

    it("create entity: valid primary key value", async () => {
        const entity = new TestingPrimaryKeys();

        // numberKey1 cannot be zero
        entity.set({numberKey1: 0, numberKey2: 2, stringKey3: "three"});
        try {
            await entity.save();
            assert.isTrue(false);
        } catch (err) {
            //
        }

        // numberKey2 cannot be non integer
        entity.set({numberKey1: 1, numberKey2: 2.2, stringKey3: "three"});
        try {
            await entity.save();
            assert.isTrue(false);
        } catch (err) {
            //
        }

        // stringKey3 cannot be empty string
        entity.set({numberKey1: 1, numberKey2: 2.2, stringKey3: ""});
        try {
            await entity.save();
            assert.isTrue(false);
        } catch (err) {
            //
        }

        const entityId = "1:2:three";
        entity.set({numberKey1: 1, numberKey2: 2, stringKey3: "three"});
        await entity.save();
        assert.equal(entity.getEntityId(), entityId);

        let newEntity = await TestingPrimaryKeys.find({numberKey1: 1, numberKey2: 2, stringKey3: "three"});
        assert.isDefined(newEntity);

        newEntity = await TestingPrimaryKeys.find(entityId);
        assert.isDefined(newEntity);
    });

    it("create entity: by pass colon for string", async () => {
        const entityId = "1:2:onetwo";
        const stringKeyA = "onetwo";
        const stringKeyB = "one:two";
        const entity = new TestingPrimaryKeys();
        entity.numberKey1 = 1;
        entity.numberKey2 = 2;
        entity.stringKey3 = stringKeyA;
        assert.equal(entity.getEntityId(), entityId);
        await entity.save();

        // we cannot save since entity id are the same
        const newEntity = new TestingPrimaryKeys();
        newEntity.numberKey1 = 1;
        newEntity.numberKey2 = 2;
        newEntity.stringKey3 = stringKeyB;
        assert.equal(newEntity.getEntityId(), entityId);
        try {
            await newEntity.save();
            assert.isTrue(false);
        } catch (err) {
            //
        }

    });
});

describe("Clean up", () => {
    it("truncate", async () => {
        await TestingPrimaryKeys.truncate("TestingPrimaryKeys");
    });
});
