import { IDbPerson } from "./DbPerson";
import { IDbTalk } from "./DbTalk";

export abstract class DBBackend {
    public abstract getSystemName(): string;
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