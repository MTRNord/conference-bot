import config, { AvailableBackends } from "../config";
import { IAuditorium, IConference, IInterestRoom, IPerson, ITalk } from "../models/schedule";
import { PentabarfParser } from "./PentabarfParser";
import PretalxParser from "./PretalxParser";

export abstract class ConferenceParser {
    public abstract getSystemName(): AvailableBackends;
    public readonly conference: IConference;
    public readonly auditoriums: IAuditorium[];
    public readonly talks: ITalk[];
    public readonly speakers: IPerson[];
    public readonly interestRooms: IInterestRoom[];
}

export const getConferenceParser = async (): Promise<ConferenceParser> => {
    switch (config.conference.backend.type) {
        case "pentabarf": {
            const input = await fetch(config.conference.backend.pentabarf.definition).then(r => r.text());
            return new PentabarfParser(input);
        }
        case "pretalx":
            return PretalxParser.createPretalxParser();
        default: {
            throw new Error("Unsupported backend type set in the config");
        }
    }
};