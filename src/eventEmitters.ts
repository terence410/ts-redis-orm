import {EventEmitter} from "events";
import {BaseEntity} from "./BaseEntity";
import {IEvents, IEventsType} from "./types";

class EventEmitters {
    private _eventEmitters = new Map<object, any>();

    public getEventEmitter<T extends typeof BaseEntity>(target: T): IEvents<InstanceType<T>> {
        if (!this._eventEmitters.has(target)) {
            this._eventEmitters.set(target, new EventEmitter());
        }

        return this._eventEmitters.get(target) as IEvents<InstanceType<T>>;
    }

    public emit<T extends BaseEntity>(eventType: IEventsType, entity: T) {
        const eventEmitter = this.getEventEmitter(entity.constructor as any);
        if (eventEmitter) {
            setImmediate(() => eventEmitter.emit(eventType, entity));
        }
    }
}

export const eventEmitters = new EventEmitters();
