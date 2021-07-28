import defaults from "./defaults";
import { System } from "../../types";
import { Db } from "@webiny/db";

interface Config {
    db: Db;
    tenant: string;
}

const keys = tenant => ({ PK: `T#${tenant}#SYSTEM`, SK: "FB" });

export default class SystemCrud {
    config: Config;
    constructor(config: Config) {
        this.config = config;
    }

    async get(): System {
        const [[system]] = await this.config.db.read<System>({
            ...defaults.db,
            query: keys(this.config.tenant)
        });

        return system;
    }

    async set(data) {
        const system = await this.get();
        if (system) {
            await this.config.db.update({
                ...defaults.db,
                query: keys(this.config.tenant),
                data: {
                    ...system.data,
                    ...data
                }
            });
        } else {
            await this.config.db.create({
                ...defaults.db,
                data: {
                    ...keys(this.config.tenant),
                    data
                }
            });
        }
    }
}
