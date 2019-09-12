import "reflect-metadata";
import { ISchemaBase } from "../types";
export declare function Column(schema?: {
    [P in keyof ISchemaBase]?: ISchemaBase[P];
}): (target: object, propertyKey: string) => void;
