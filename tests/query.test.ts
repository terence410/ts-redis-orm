import { assert, expect } from "chai";
import {BaseEntity, Column, Entity} from "../src/";

@Entity({table: "TestingQuery"})
class TestingQuery extends BaseEntity {
    @Column({ autoIncrement: true})
    public id: number = 0;

    @Column({index: true})
    public indexInt: number = 0;

    @Column({index: true})
    public indexFloat: number = 0;

    @Column({index: true})
    public indexBoolean: boolean = false;

    @Column({index: true})
    public indexDate: Date = new Date();

    @Column()
    public groupBy: string = "";

    @Column()
    public randomString1: string = "";

    @Column()
    public randomString2: string = "";
}

describe("Query Test", () => {
    const epsilon = 0.000001;
    const total = 100;
    const ints: number[] = [];
    const floats: number[] = [];
    const dates: Date[] = [];
    const booleans: boolean[] = [];
    const groupByObject = {group1: 0, group2: 0, group3: 0, group4: 0, group5: 0, group6: 0, group7: 0};
    const groupBy = Object.keys(groupByObject);
    const filter = (x: any, i: number) => i % 2 !== 0;
    const deleteFilter = (x: any, i: number) => i % 2 === 0;

    it("prepare variables", async () => {
        const now = new Date();
        for (let i = 0; i < total; i++) {
            ints.push(i);
            floats.push(Math.random());
            dates.push(new Date(now.getTime() - 86400 * 30 * 1000 * Math.random()));
            booleans.push(Math.random() > 0.5);
        }
    });
    
    it("truncate", async () => {
        const [totalDeleted, performanceResult] = await TestingQuery.truncate("TestingQuery");
    });
    
    it("create and delete entities", async () => {
        for (let i = 0; i < total; i++) {
            const entity = new TestingQuery();
            entity.indexInt = ints[i];
            entity.indexFloat = floats[i];
            entity.indexBoolean = booleans[i];
            entity.indexDate = dates[i];
            entity.groupBy = groupBy[i % groupBy.length];
            await entity.save();
        }
    });

    it("delete 50% entities", async () => {
        const [entities, _] = await TestingQuery.query().sortBy("id", "asc").run();
        for (const entity of entities.filter(deleteFilter)) {
            await entity.delete();
        }
    });

    it("test: aggregate int", async () => {
        const [count] = await TestingQuery.query().count();
        const [sum] = await TestingQuery.query().sum("indexInt");
        const [min] = await TestingQuery.query().min("indexInt");
        const [max] = await TestingQuery.query().max("indexInt");
        const [avg] = await TestingQuery.query().avg("indexInt");

        const newInts = ints.filter(filter);
        assert.equal(count, newInts.length);
        assert.equal(sum, newInts.reduce((a, b) => a + b));
        assert.equal(min, Math.min(...newInts));
        assert.equal(max, Math.max(...newInts));
        assert.equal(avg, newInts.reduce((a, b) => a + b) / newInts.length);
    });

    it("test: aggregate float (have precision problem)", async () => {
        const minEntity = await TestingQuery.query().sortBy("indexFloat", "asc").runOnce();
        const [count] = await TestingQuery.query().count();
        const [sum] = await TestingQuery.query().sum("indexFloat");
        const [min] = await TestingQuery.query().min("indexFloat");
        const [max] = await TestingQuery.query().max("indexFloat");
        const [avg] = await TestingQuery.query().avg("indexFloat");

        const newFloats = floats.filter(filter);
        assert.equal(count, newFloats.length);
        assert.closeTo(sum, newFloats.reduce((a, b) => a + b), epsilon);
        assert.closeTo(min, Math.min(...newFloats), epsilon);
        assert.closeTo(max, Math.max(...newFloats), epsilon);
        assert.closeTo(avg, newFloats.reduce((a, b) => a + b) / newFloats.length, epsilon);
    });
    
    it("test: aggregate int with group by", async () => {
        const [count] = await TestingQuery.query().count();
        const [sum] = await TestingQuery.query().sum("indexInt", "groupBy");
        const [min] = await TestingQuery.query().min("indexInt", "groupBy");
        const [max] = await TestingQuery.query().max("indexInt", "groupBy");
        const [avg] = await TestingQuery.query().avg("indexInt", "groupBy");

        const sumInts: any = Object.assign({}, groupByObject);
        const minInts: any = Object.assign({}, groupByObject);
        const maxInts: any = Object.assign({}, groupByObject);
        const countInts: any = Object.assign({}, groupByObject);
        Object.keys(minInts).forEach(x => minInts[x] = Number.MAX_VALUE);

        // sum
        ints.forEach((x, i) => {
            if (i % 2 !== 0) {
                const groupName = groupBy[i % groupBy.length];
                sumInts[groupName] += x;
                countInts[groupName] += 1;
                minInts[groupName] = Math.min(minInts[groupName],  x);
                maxInts[groupName] = Math.max(maxInts[groupName],  x);
            }
        });

        // validate
        assert.deepEqual(sumInts, sum);
        assert.deepEqual(minInts, min);
        assert.deepEqual(maxInts, max);
        Object.keys(countInts).forEach(x => sumInts[x] /= countInts[x]);
        assert.deepEqual(sumInts, avg);
    });
});

describe("Clean up", () => {
    it("truncate", async () => {
        await TestingQuery.truncate("TestingQuery");
    });
});
