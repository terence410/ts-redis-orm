declare class Parser {
    parseStorageStringToValue(type: any, storageString: string): any;
    parseValueToStorageString(type: any, value: any): string;
}
export declare const parser: Parser;
export {};
