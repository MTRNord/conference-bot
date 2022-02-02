import { IAuditorium, IConference, IInterestRoom, IPerson, ITalk } from "../models/schedule";
import { PentabarfParser } from "./PentabarfParser";

export abstract class ConferenceParser {
    public readonly conference: IConference;
    public readonly auditoriums: IAuditorium[];
    public readonly talks: ITalk[];
    public readonly speakers: IPerson[];
    public readonly interestRooms: IInterestRoom[];
}

export const getConferenceParser = (input: string): ConferenceParser => {
    return new PentabarfParser(input);
};