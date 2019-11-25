import fs from "fs";
import * as readline from "readline";
import {BaseEntity} from "./BaseEntity";
import {schemaJsonReplacer, serviceInstance} from "./serviceInstance";

class EntityExporter {
    public exportEntities<T extends BaseEntity>(entityType: object, entities: T[], file: string) {
        return new Promise((resolve, reject) => {
            const writeStream = fs.createWriteStream(file, {encoding: "utf-8"});

            // write the meta
            const meta = {
                createdAt: new Date(),
                class: (entityType as any).name,
                tablePrefix: serviceInstance.getTablePrefix(entityType),
                table: serviceInstance.getDefaultTable(entityType),
                schemas: serviceInstance.getSchemasJson(entityType),
                total: entities.length,
            };
            writeStream.write(JSON.stringify(meta, schemaJsonReplacer) + "\r\n");

            // write all the models
            for (const entity of entities) {
                writeStream.write(JSON.stringify(entity.getValues()) + "\r\n");
            }

            writeStream.on("error", err => {
                reject(err);
            });

            writeStream.on("finish", () => {
                resolve();
            });

            writeStream.end();
        });
    }

    public async import(entityType: object, file: string, skipSchemasCheck: boolean, table: string) {
        const readStream = fs.createReadStream(file, {encoding: "utf8"});
        const r1 = readline.createInterface({input: readStream});

        return new Promise((resolve, reject) => {
            const valuesList: any[] = [];
            let meta: any = null;
            let closed = false;
            const saveModelPromise = null;
            let promiseRunning = false;
            let currentError: Error | null = null;

            function checkComplete() {
                if (closed) {
                    r1.removeAllListeners();
                    r1.close();
                    readStream.close();

                    if (!promiseRunning) {
                        resolve(true);
                    }
                }
            }

            function checkError() {
                if (currentError) {
                    r1.removeAllListeners();
                    r1.close();
                    readStream.close();
                    if (!promiseRunning) {
                        reject(currentError);
                    }
                }
            }

            function saveEntity() {
                if (!promiseRunning) {
                    promiseRunning = true;
                    asyncSaveModel().then(() => {
                        promiseRunning = false;
                        checkError();
                        checkComplete();
                        r1.resume();

                    }).catch(err => {
                        promiseRunning = false;
                        currentError = err;
                        checkError();

                    });
                }
            }

            async function asyncSaveModel() {
                while (valuesList.length > 0) {
                    const values = valuesList.shift();
                    try {
                        const entity = new (entityType as any)() as BaseEntity;
                        entity.setTable(table);
                        entity.set(values);
                        await entity.save();

                        if (values.deletedAt) {
                            const deletedAt = new Date(values.deletedAt);
                            if (!isNaN(Number(deletedAt))) {
                                entity.deletedAt = deletedAt;
                                await entity.delete();
                            }
                        }
                    } catch (err) {
                        err.message = `data: ${JSON.stringify(values)}\r\n` + err.message;
                        throw err;
                    }
                }
            }

            r1.on("line", data => {
                r1.pause();

                // the first line will be meta
                if (!meta) {
                    try {
                        meta = JSON.parse(data);
                        r1.resume();
                    } catch (err) {
                        err.message = `data: ${data}\r\n` + err.message;
                        currentError = err;
                        checkError();
                    }

                    if (!skipSchemasCheck) {
                        const className = (entityType as any).name;
                        const clientSchemas = serviceInstance.getSchemasJson(entityType);
                        if (meta.class !== className) {
                            const err = new Error();
                            err.message = `Class name: ${className} does not match with the import file: ${meta.class}`;
                            currentError = err;
                            checkError();
                        } else if (meta.schemas !== clientSchemas) {
                            const err = new Error();
                            err.message = `Current Schemas: ${clientSchemas} does not match with the import file: ${meta.schemas}`;
                            currentError = err;
                            checkError();
                        }
                    }

                } else {
                    try {
                        const values = JSON.parse(data);
                        valuesList.push(values);
                        saveEntity();
                    } catch (err) {
                        err.message = `data: ${data}\r\n` + err.message;
                        currentError = err;
                        checkError();
                    }

                }
            });

            r1.on("error", err => {
                currentError = err;
                checkError();
            });

            r1.on("close", () => {
                closed = true;
                checkComplete();
            });
        });
    }

}

export const entityExporter = new EntityExporter();
