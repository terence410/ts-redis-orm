import IORedis from "ioredis";
import {IPerformanceResult} from "../types";

type IOptions = {
    trackCommandStats?: boolean;
    skipTracking?: boolean;
};

export  class PerformanceHelper {
    public static getEmptyResult(): IPerformanceResult {
        return {executionTime: 0, commandStats: {}, commandStatsUsed: {}};
    }

    private _timer: [number, number] = [0, 0];
    private _initCommandStats: any = {};

    constructor(private _redis: IORedis.Redis, private _options: IOptions= {}) {
        //
    }

    public async start() {
        if (!this._options.skipTracking) {
            this._timer = process.hrtime();

            if (this._options.trackCommandStats) {
                this._initCommandStats = await this._getCommandStats();
            }
        }

        return this;
    }

    public async getResult(): Promise<IPerformanceResult> {
        let commandStats: any = {};
        let executionTime = 0;
        const commandStatsUsed: any = this._initCommandStats;

        if (!this._options.skipTracking) {
            if (this._options.trackCommandStats) {
                commandStats = await this._getCommandStats();
                for (const key of Object.keys(this._initCommandStats)) {
                    commandStatsUsed[key] = commandStats[key] - commandStatsUsed[key];
                }
            }

            // execution time
            const diff = process.hrtime(this._timer);
            executionTime = diff[0] * 1000 + (diff[1] / 1000000);
        }

        return {
            executionTime,
            commandStats,
            commandStatsUsed,
        };
    }
    
    private async _getCommandStats() {
        const commandStats = await this._redis.info("commandstats");
        const stats = commandStats.split(/\r?\n/).splice(1);
        const myCommandStats = {};
        for (const stat of stats) {
            const matches = stat.match(/cmdstat_([a-z]*):calls=([0-9]*)/);
            if (matches) {
                (myCommandStats as any)[matches[1]] = Number(matches[2]);
            }
        }

        return myCommandStats;
    }
}
