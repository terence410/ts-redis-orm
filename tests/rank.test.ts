import { assert, expect } from "chai";
import {BaseEntity, Column, Entity} from "../src/";

@Entity({table: "TestingRank"})
class TestingRank extends BaseEntity {
    @Column()
    public id: number = 0;

    @Column({index: true})
    public index: number = 0;
}

describe("Rank Test", () => {
    const total = 1000;

    it("truncate", async () => {
        await TestingRank.truncate("TestingRank");
    });

    it("create entity and check rank", async () => {
        for (let i = 0; i < total; i++) {
            const entity = new TestingRank();
            entity.id = i + 1;
            entity.index = i;
            await entity.save();
        }

        const [index1] = await TestingRank.query().rank("index", 1);
        assert.equal(index1, 0);

        const [index2] = await TestingRank.query().rank("index", 1, true);
        assert.equal(index2, total - 1);

        const [index3] = await TestingRank.query().rank("index", -1);
        assert.equal(index3, -1);
    });
});

describe("Clean up", () => {
    it("truncate", async () => {
        await TestingRank.truncate("TestingRank");
    });
});
