import {assert, expect } from "chai";
import {BaseEntity, Column, Entity} from "../src/";
import {metaInstance} from "../src/metaInstance";

type IObject = {
    string1?: string,
    number1?: number,
} | undefined;

@Entity({connection: "default", table: "testing_speed"})
class TestingSpeed extends BaseEntity {
    @Column({primary: true, autoIncrement: true})
    public id: number = 0;

    @Column()
    public string: string = "string";

    @Column()
    public nullableString: string | null = null;

    @Column({unique: true, index: true})
    public number: number = 100;

    @Column({index: true})
    public date: Date = new Date();

    @Column({index: true})
    public boolean: boolean = false;

    @Column()
    public array: number[] = [];

    @Column()
    public object: IObject = undefined;
}

describe("Speed Test", () => {
    const batch = 1000;
    const iterate = 10;
    const before: any = {};
    const after: any = {};

    beforeEach(async () => {
        const redis = await metaInstance.getRedis(TestingSpeed);
        const info = await redis.info("all");
        const matches1 = info.match(/used_memory:(.*)/);
        if (matches1) { before.used_memory = matches1[1]; }

        const matches2 = info.match(/used_cpu_sys:(.*)/);
        if (matches2) { before.used_cpu_sys = parseFloat(matches2[1]); }

        const matches3 = info.match(/used_cpu_user:(.*)/);
        if (matches3) { before.used_cpu_user = parseFloat(matches3[1]); }
    });

    afterEach(async () => {
        const redis = await metaInstance.getRedis(TestingSpeed);
        const info = await redis.info("all");

        const matches1 = info.match(/used_memory:(.*)/);
        if (matches1) { after.used_memory = matches1[1]; }

        const matches2 = info.match(/used_cpu_sys:(.*)/);
        if (matches2) { after.used_cpu_sys = parseFloat(matches2[1]); }

        const matches3 = info.match(/used_cpu_user:(.*)/);
        if (matches3) { after.used_cpu_user = parseFloat(matches3[1]); }

        console.log("Memory Diff: ", ((after.used_memory - before.used_memory) / 1024 / 1024).toFixed(2) + "MB");
        console.log("CPU Sys Diff: ", ((after.used_cpu_sys - before.used_cpu_sys)).toFixed(2) + "s");
        console.log("CPU User Diff: ", (after.used_cpu_user - before.used_cpu_user).toFixed(2) + "s");
    });

    it("truncate", async () => {
        await TestingSpeed.truncate("TestingSpeed");
    });

    it(`create entity: ${iterate * batch} entities`, async () => {
        for (let i = 0; i < iterate; i++) {
            const promises: Array<Promise<any>> = [];
            for (let j = 0; j < batch; j++) {
                const testing = new TestingSpeed();
                testing.date = new Date(+new Date() - Math.random() * 3600 * 1000);
                testing.boolean = Math.random() > 0.5;
                testing.number = Math.random();
                testing.array = new Array(Math.random() * 20 | 0).fill(1);
                testing.string = Math.random().toString();
                testing.nullableString = testing.number > 0.5 ? testing.string : null;
                testing.object = {};
                promises.push(testing.save());
            }

            await Promise.all(promises);
        }

        const total = await TestingSpeed.count();
        assert.equal(total, batch * iterate);
    });
});

describe("Clean up", () => {
    it("truncate", async () => {
        console.log("truncate after");
        await TestingSpeed.truncate("TestingSpeed");
    });
});
