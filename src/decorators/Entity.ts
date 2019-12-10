import {RedisOrmDecoratorError} from "..";
import {redisOrm} from "../redisOrm";
import {IEntityBaseMeta, IEntityMeta, IEntityColumn} from "../types";

export function Entity(entityMeta: {[P in keyof IEntityBaseMeta]?: IEntityBaseMeta[P]} = {}) {
    return (target: object) => {
        // add entity meta
        let newEntityMeta: IEntityMeta = {
            table: "",
            tablePrefix: "",
            connection: "default",
            indexUpdatedAt: true,
            redisMaster: null,
        };
        newEntityMeta = Object.assign(newEntityMeta, entityMeta);
        redisOrm.addEntity(target, newEntityMeta);

        // add createdAt, updatedAt and deletedAt
        const schema: IEntityColumn = {
            type: Date,
            primary: false,
            autoIncrement: false,
            index: true,
            unique: false,
        };
        redisOrm.addColumn(target, "createdAt", schema);
        redisOrm.addColumn(target, "updatedAt", {...schema, index: newEntityMeta.indexUpdatedAt});
        redisOrm.addColumn(target, "deletedAt", schema);

        // validate from entity
        const primaryKeys = redisOrm.getPrimaryKeys(target);
        if (primaryKeys.length === 0) {
            throw new RedisOrmDecoratorError(`(${(target as any).name}) No primary keys exist for this entity`);
        }

    };
}
