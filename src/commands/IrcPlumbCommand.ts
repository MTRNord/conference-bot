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

import { ICommand } from "./ICommand";
import { LogLevel, LogService, MatrixClient } from "matrix-bot-sdk";
import { Conference } from "../Conference";
import { IRCBridge } from "../IRCBridge";
import { logMessage } from "../LogProxy";

const PLUMB_WAIT_MS = 1000;

export class IrcPlumbCommand implements ICommand {
    public readonly prefixes = ["plumb-irc"];

    constructor(private readonly ircBridge: IRCBridge) { }

    private async plumbAll(conference: Conference) {
        for (const auditorium of conference.storedAuditoriums) {
            const channelName = await this.ircBridge.deriveChannelName(auditorium);
            try {
                await this.ircBridge.plumbChannelToRoom(channelName, auditorium.roomId);
                // Wait before plumbing the next one so as to not overwhelm the poor bridge.
                await new Promise(r => setTimeout(r, PLUMB_WAIT_MS));
            } catch (error) {
                await logMessage(LogLevel.WARN, "IrcPlumbCommand", `Could not plumb channel ${channelName} to ${auditorium.roomId}`);
                LogService.warn("IrcPlumbCommand", `Could not plumb channel ${channelName} to ${auditorium.roomId}:`, error);
            }
        }
        for (const interest of conference.storedInterestRooms) {
            const channelName = await this.ircBridge.deriveChannelNameSI(interest);
            try {
                await this.ircBridge.plumbChannelToRoom(channelName, interest.roomId);
                // Wait before plumbing the next one so as to not overwhelm the poor bridge.
                await new Promise(r => setTimeout(r, PLUMB_WAIT_MS));
            } catch (error) {
                await logMessage(LogLevel.WARN, "IrcPlumbCommand", `Could not plumb channel ${channelName} to ${interest.roomId}`);
                LogService.warn("IrcPlumbCommand", `Could not plumb channel ${channelName} to ${interest.roomId}:`, error);
            }
        }
    }

    public async run(conference: Conference, client: MatrixClient, roomId: string, event: any, args: string[]) {
        await client.sendReadReceipt(roomId, event['event_id']);
        const [channel, requestedRoomIdOrAlias] = args;
        if (channel === 'all') {
            try {
                await this.plumbAll(conference);
            } catch {
                return client.sendNotice(roomId, "Failed to bridge all rooms, see logs");
            }
            await client.sendNotice(roomId, "Rooms bridged to IRC");
            return;
        }
        if (!this.ircBridge.isChannelAllowed(channel)) {
            return client.sendNotice(roomId, "Sorry, that channel is not allowed");
        }
        let resolvedRoomId: string;
        try {
            resolvedRoomId = await client.resolveRoom(requestedRoomIdOrAlias);
        } catch {
            return client.sendNotice(roomId, "Sorry, that alias could not be resolved");
        }
        try {
            await client.joinRoom(requestedRoomIdOrAlias);
        } catch {
            return client.sendNotice(roomId, "Could not join that room, is the bot invited?");
        }
        try {
            await this.ircBridge.plumbChannelToRoom(channel, resolvedRoomId);
        } catch (error) {
            LogService.warn("IrcPlumbCommand", error);
            return await logMessage(LogLevel.WARN, "IrcPlumbCommand", `Could not plumb channel to room`);
        }
        return client.sendNotice(roomId, "Plumbed channel");
    }
}
