import { BaseEntity } from "./BaseEntity";
import { IEvent } from "./types";
declare class EventEmitters {
    private _eventEmitters;
    getEventEmitter<T extends typeof BaseEntity>(target: T): IEvent<InstanceType<T>>;
}
export declare const eventEmitters: EventEmitters;
export {};
