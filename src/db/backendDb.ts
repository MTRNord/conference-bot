
import config, { AvailableBackends } from "../config";
import { IDbPerson } from "./DbPerson";
import { IDbTalk } from "./DbTalk";
import { PentaDb } from "./PentaDb";

export abstract class DBBackend {
    public abstract getSystemName(): AvailableBackends;
    public abstract findPeopleWithId(personId: string): Promise<IDbPerson[]>;
    public abstract findAllPeopleForAuditorium(auditoriumId: string): Promise<IDbPerson[]>;
    public abstract findAllPeopleForTalk(talkId: string): Promise<IDbPerson[]>;
    public abstract findAllPeopleWithRemark(remark: string): Promise<IDbPerson[]>;
    public abstract getUpcomingTalkStarts(inNextMinutes: number, minBefore: number): Promise<IDbTalk[]>;
    public abstract getUpcomingQAStarts(inNextMinutes: number, minBefore: number): Promise<IDbTalk[]>;
    public abstract getUpcomingTalkEnds(inNextMinutes: number, minBefore: number): Promise<IDbTalk[]>;
    /**
     * Gets the record for a talk.
     * @param talkId The talk ID.
     * @returns The record for the talk, if it exists; `undefined` otherwise.
     */
    public abstract getTalk(talkId: string): Promise<IDbTalk | undefined>;
}

export const getBackendDB = (): DBBackend => {
    switch (config.conference.backendType) {
        case "pentabarf": {
            return new PentaDb();
        }
        default: {
            throw new Error("Unsupported backend type set in the config");
        }
    }
};