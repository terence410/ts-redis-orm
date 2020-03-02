import IORedis from "ioredis";
import {IPerformanceResult} from "../types";

type IOptions = {
    trackRedisInfo?: boolean;
    skipTracking?: boolean;
};

export  class PerformanceHelper {
    public static getEmptyResult(): IPerformanceResult {
        return {
            executionTime: 0,
            commandStats: {},
            diffCommandStats: {},
            usedCpuSys: 0,
            diffUsedCpuSys: 0,
            usedCpuUser: 0,
            diffUsedCpuUser: 0,
            usedMemory: 0,
            diffUsedMemory: 0,
        };
    }

    private _timer: [number, number] = [0, 0];
    private _initCommandStats: any = {};
    private _initRedisInfo: any = {};

    constructor(private _redis: IORedis.Redis, private _options: IOptions= {}) {
        //
    }

    public snakeToCamel(value: string) {
        return value.replace(/(_\w)/g, (m) => m[1].toUpperCase());
    }

    public async start() {
        if (!this._options.skipTracking) {
            this._timer = process.hrtime();

            if (this._options.trackRedisInfo) {
                const redisInfoAll = await this._getRedisInfoAll();
                this._initCommandStats = redisInfoAll[0];
                this._initRedisInfo = redisInfoAll[1];
            }
        }

        return this;
    }

    public async getResult(): Promise<IPerformanceResult> {
        let commandStats: any = {};
        let redisInfo: any = {};
        let executionTime = 0;
        const diffCommandStats: any = this._initCommandStats;
        const diffRedisInfo: any = this._initRedisInfo;

        if (!this._options.skipTracking) {
            if (this._options.trackRedisInfo) {
                const redisInfoAll = await this._getRedisInfoAll();
                commandStats = redisInfoAll[0];
                redisInfo = redisInfoAll[1];

                for (const key of Object.keys(this._initCommandStats)) {
                    diffCommandStats[key] = commandStats[key] - diffCommandStats[key];
                }

                for (const key of Object.keys(this._initRedisInfo)) {
                    diffRedisInfo[this.snakeToCamel(`diff_${key}`)] = redisInfo[key] - diffRedisInfo[key];
                }
            }

            // execution time
            const diff = process.hrtime(this._timer);
            executionTime = diff[0] * 1000 + (diff[1] / 1000000);
        }

        return {
            executionTime,
            commandStats,
            diffCommandStats,
            ...redisInfo,
            ...diffRedisInfo,
        } as IPerformanceResult;
    }
    
    private async _getRedisInfoAll() {
        const commandStats = await this._redis.info("all");
        const stats = commandStats.split(/\r?\n/).splice(1);
        const myCommandStats = {};
        const myRedisInfo = {};
        for (const stat of stats) {
            const matches = stat.match(/cmdstat_([a-z]*):calls=([0-9]*)/);
            if (matches) {
                (myCommandStats as any)[matches[1]] = Number(matches[2]);
            }

            const usedMatches = stat.match(/(used_memory|used_cpu_sys|used_cpu_user):([0-9\.]*)/);
            if (usedMatches) {
                (myRedisInfo as any)[this.snakeToCamel(usedMatches[1])] = Number(usedMatches[2]);
            }
        }

        return [myCommandStats, myRedisInfo];
    }
}
