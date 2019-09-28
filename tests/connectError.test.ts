import { assert, expect } from "chai";
import {BaseEntity, Column, Entity} from "../src/";

@Entity({table: "testing_error_connection", connection: "testing"})
class TestingErrorConnection extends BaseEntity {
    @Column({primary: true, autoIncrement: true})
    public id: number = 0;
}

async function createEntity(attempt: number) {
    try {
        const entity = new TestingErrorConnection();
        await entity.save();
        assert.isTrue(false);
    } catch (err) {
        assert.equal(err.message, "Connection is closed.");
    }
}

describe("Connect Error Test", () => {
    it("test: if redis is not able to connect", async () => {
        const trial = 10;
        let hasConnectionError = false;

        // suppress connection error
        const redis = await TestingErrorConnection.getRedis();
        redis.on("error", (err) => {
            assert.isTrue(err.message.startsWith("connect ETIMEDOUT") ||
                err.message.startsWith("connect ECONNREFUSED"));
            hasConnectionError = true;
        });

        // create multiple entity
        const promises: any[] = [];
        for (let i = 0; i < trial; i++) {
            const promise = createEntity(i);
            promises.push(promise);
        }

        // wait for all of them to return connection error
        await Promise.all(promises);

        // validate
        assert.isTrue(hasConnectionError);
    }).timeout(10 * 1000);
});
