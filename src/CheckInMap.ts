/*
Copyright 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { LogService, MatrixClient } from "matrix-bot-sdk";
import AwaitLock from "await-lock";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import config from "./config";

interface ICheckin {
    expires: number;
}

const CHECKIN_TIME = 4 * 60 * 60 * 1000; // 4 hours

export class CheckInMap {
    private checkedIn: { [userId: string]: ICheckin; } = {};
    private lock = new AwaitLock();

    constructor(private client: MatrixClient) {
        this.client.on('room.event', async (roomId: string, event: any) => {
            if (!this.checkedIn[event['sender']]) return;

            if (event['type'] === 'm.room.message' || event['type'] === 'm.reaction') {
                await this.lock.acquireAsync();
                try {
                    this.checkedIn[event['sender']] = { expires: Date.now() + CHECKIN_TIME };
                    await this.persist();
                } finally {
                    this.lock.release();
                }
            }
        });
        this.load();
    }

    private async persist() {
        await fs.writeFile(path.join(config.dataPath, "checkins.json"), JSON.stringify(this.checkedIn), "utf-8");
    }

    private async load() {
        try {
            await this.lock.acquireAsync();
            const str = await fs.readFile(path.join(config.dataPath, "checkins.json"), "utf-8");
            this.checkedIn = JSON.parse(str || "{}");
        } catch (error) {
            LogService.error("CheckInMap", error);
        } finally {
            this.lock.release();
        }
    }

    public async expectCheckinFrom(userIds: string[]) {
        await this.lock.acquireAsync();
        try {
            for (const userId of userIds) {
                if (this.checkedIn[userId]) continue;
                this.checkedIn[userId] = { expires: 0 };
            }
            await this.persist();
        } finally {
            this.lock.release();
        }
    }

    public async extendCheckin(userId: string) {
        await this.lock.acquireAsync();
        try {
            if (!this.checkedIn[userId]) return;
            this.checkedIn[userId] = { expires: Date.now() + CHECKIN_TIME };
            await this.persist();
        } finally {
            this.lock.release();
        }
    }

    public isCheckedIn(userId: string): boolean {
        const checkin = this.checkedIn[userId];
        return checkin && checkin.expires >= Date.now();
    }
}
