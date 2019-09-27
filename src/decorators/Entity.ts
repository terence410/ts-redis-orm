import {RedisOrmDecoratorError} from "..";
import {metaInstance} from "../metaInstance";
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
        metaInstance.addEntity(target, newEntityMeta);

        // add createdAt, updatedAt and deletedAt
        const schema: ISchema = {
            type: Date,
            primary: false,
            autoIncrement: false,
            index: true,
            unique: false,
        };
        metaInstance.addColumn(target, "createdAt", schema);
        metaInstance.addColumn(target, "updatedAt", {...schema, index: newEntityMeta.indexUpdatedAt});
        metaInstance.addColumn(target, "deletedAt", schema);

        // validate from entity
        const primaryKeys = metaInstance.getPrimaryKeys(target);
        if (primaryKeys.length === 0) {
            throw new RedisOrmDecoratorError(`No primary keys exist for this entity`);
        }

    };
}
