class Parser {
    private _ISORegex = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*))(?:Z|(\+|-)([\d|:]*))?$/;

    public parseStorageStringToValue(type: any, storageString: string): any {
        let value: any;
        switch (type) {
            case String:
                value = storageString ? String(storageString) : "";
                break;

            case Number:
                value = storageString ? Number(storageString) : Number.NaN;
                break;

            case Boolean:
                value = storageString === "1";
                break;

            case Date:
                value = new Date(storageString ? Number(storageString) : Number.NaN);
                break;

            case Array:
                try {
                    const temp = JSON.parse(storageString, this._parseDate);
                    if (Array.isArray(temp)) {
                        value = temp;
                    } else {
                        value = undefined;
                    }
                } catch (err) {
                    value = undefined;
                }
                break;

            case Object:
                try {
                    value = JSON.parse(storageString, this._parseDate);
                } catch (err) {
                    value = undefined;
                }
                break;

        }

        return value;
    }

    public parseValueToStorageString(type: any, value: any): string {
        let storageString = "";

        switch (type) {
            case String:
                storageString = value ? value.toString() : "";
                break;

            case Number:
                storageString = Number(value).toString();
                break;

            case Boolean:
                storageString = value ? "1" : "0";
                break;

            case Date:
                let temp1: number;
                if (value === "now") {
                    temp1 = Number(new Date());

                } else if (value instanceof Date) {
                    temp1 = Number(value);

                } else {
                    temp1 = Number(new Date(value));
                }

                if (Number.isNaN(temp1)) {
                    storageString = "NaN";
                } else {
                    storageString = temp1.toString();
                }

                break;

            case Array:
                storageString = Array.isArray(value) ? JSON.stringify(value) : "";
                break;

            case Object:
                storageString = JSON.stringify(value);
                break;

        }

        return storageString;
    }

    private _parseDate(key: string, value: any): any {
        if (typeof value === "string") {
            if (value.match(this._ISORegex)) {
                return new Date(value);
            }
        }

        return value;
    }
}

export const parser = new Parser();
