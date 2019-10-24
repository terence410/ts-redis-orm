import {RedisOrmDecoratorError} from "..";
import {serviceInstance} from "../serviceInstance";
import {IEntityBaseMeta, IEntityMeta, ISchema} from "../types";

export function Entity(entityMeta: {[P in keyof IEntityBaseMeta]?: IEntityBaseMeta[P]} = {}) {
    return (target: object) => {
        // add entity meta
        let newEntityMeta: IEntityMeta = {
            table: "",
            connection: "default",
            indexUpdatedAt: true,
            redisMaster: null,
        };
        newEntityMeta = Object.assign(newEntityMeta, entityMeta);
        serviceInstance.addEntity(target, newEntityMeta);

        // add createdAt, updatedAt and deletedAt
        const schema: ISchema = {
            type: Date,
            primary: false,
            autoIncrement: false,
            index: true,
            unique: false,
        };
        serviceInstance.addColumn(target, "createdAt", schema);
        serviceInstance.addColumn(target, "updatedAt", {...schema, index: newEntityMeta.indexUpdatedAt});
        serviceInstance.addColumn(target, "deletedAt", schema);

        // validate from entity
        const primaryKeys = serviceInstance.getPrimaryKeys(target);
        if (primaryKeys.length === 0) {
            throw new RedisOrmDecoratorError(`(${(target as any).name}) No primary keys exist for this entity`);
        }

    };
}
