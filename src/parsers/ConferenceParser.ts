import config, { AvailableBackends } from "../config";
import { RoomKind } from "../models/room_kinds";
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

export function deprefix(id: string): { kind: RoomKind, name: string; } {
    const override = config.conference.prefixes.nameOverrides[id];

    const auditoriumPrefix = config.conference.prefixes.auditoriumRooms.find(p => id.startsWith(p));
    if (auditoriumPrefix) {
        return { kind: RoomKind.Auditorium, name: override || id.slice(auditoriumPrefix.length) };
    }

    const interestPrefix = config.conference.prefixes.interestRooms.find(p => id.startsWith(p));
    if (interestPrefix) {
        return { kind: RoomKind.SpecialInterest, name: override || id.slice(interestPrefix.length) };
    }

    return { kind: RoomKind.SpecialInterest, name: override || id };
}