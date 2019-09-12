import { BaseEntity } from "./BaseEntity";
declare class EntityExporter {
    exportEntities<T extends BaseEntity>(entityType: object, entities: T[], file: string): Promise<unknown>;
    import(entityType: object, file: string): Promise<unknown>;
}
export declare const entityExporter: EntityExporter;
export {};
