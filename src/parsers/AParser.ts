import config, { AvailableBackends } from "../config";
import { IAuditorium, IConference, IInterestRoom, IPerson, ITalk } from "../models/schedule";
import { PentabarfParser } from "./PentabarfParser";

export abstract class ConferenceParser {
    public abstract getSystemName(): AvailableBackends;
    public readonly conference: IConference;
    public readonly auditoriums: IAuditorium[];
    public readonly talks: ITalk[];
    public readonly speakers: IPerson[];
    public readonly interestRooms: IInterestRoom[];
}

export const getConferenceParser = (input: string): ConferenceParser => {
    switch (config.conference.backend.type) {
        case "pentabarf": {
            return new PentabarfParser(input);
        }
        default: {
            throw new Error("Unsupported backend type set in the config");
        }
    }
};