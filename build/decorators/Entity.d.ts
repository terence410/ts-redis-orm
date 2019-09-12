import { IEntityBaseMeta } from "../types";
export declare function Entity(entityMeta?: {
    [P in keyof IEntityBaseMeta]?: IEntityBaseMeta[P];
}): (target: object) => void;
