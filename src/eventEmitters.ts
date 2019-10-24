import {EventEmitter} from "events";
import {BaseEntity} from "./BaseEntity";
import {IEvent} from "./types";

class EventEmitters {
    private _eventEmitters = new Map<object, any>();

    public getEventEmitter<T extends typeof BaseEntity>(target: T): IEvent<InstanceType<T>> {
        if (!this._eventEmitters.has(target)) {
            this._eventEmitters.set(target, new EventEmitter());
        }

        return this._eventEmitters.get(target) as IEvent<InstanceType<T>>;
    }
}

export const eventEmitters = new EventEmitters();
