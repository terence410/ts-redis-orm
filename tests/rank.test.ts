import { assert, expect } from "chai";
import {BaseEntity, Column, Entity} from "../src/";

@Entity({table: "testing_rank"})
class TestingRank extends BaseEntity {
    @Column({primary: true})
    public stringId: string = "";

    @Column({primary: true})
    public numberId: number = 0;

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
            entity.stringId = "a";
            entity.numberId = i + 1;
            entity.index = i;
            await entity.save();
        }

        const index1 = await TestingRank.query().rank("index", {stringId: "a", numberId: 1});
        assert.equal(index1, 0);

        const index2 = await TestingRank.query().rank("index", {stringId: "a", numberId: 1}, true);
        assert.equal(index2, total - 1);

        const index3 = await TestingRank.query().rank("index", {stringId: "b", numberId: 1});
        assert.equal(index3, -1);
    });
});

describe("Clean up", () => {
    it("truncate", async () => {
        await TestingRank.truncate("TestingRank");
    });
});
