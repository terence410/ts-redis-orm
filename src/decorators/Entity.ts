import {RedisOrmDecoratorError} from "..";
import {redisOrm} from "../redisOrm";
import {IEntityBaseMeta, IEntityColumn, IEntityMeta} from "../types";

export function Entity(entityMeta: {[P in keyof IEntityBaseMeta]?: IEntityBaseMeta[P]} = {}) {
    return (target: object) => {
        // validate from entity
        if (!redisOrm.hasPrimaryKey(target)) {
            throw new RedisOrmDecoratorError(`(${(target as any).name}) No primary keys exist for this entity`);
        }

        if (entityMeta.table?.match(/:/) || entityMeta.tablePrefix?.match(/:/)) {
            throw new RedisOrmDecoratorError(`(${(target as any).name}) table and tablePrefix must not contains ":"`);
        }

        // add entity meta
        let newEntityMeta: IEntityMeta = {
            table: "",
            tablePrefix: "",
            connection: "default",
            redisMaster: null,
        };
        newEntityMeta = Object.assign(newEntityMeta, entityMeta);
        redisOrm.addEntity(target, newEntityMeta);

        // add createdAt
        const schema: IEntityColumn = {
            type: Date,
            primary: false,
            autoIncrement: false,
            index: true,
            unique: false,
        };
        redisOrm.addColumn(target, "createdAt", schema);

    };
}
