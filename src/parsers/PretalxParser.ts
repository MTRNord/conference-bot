import config, { AvailableBackends } from "../config";
import { IConference, IAuditorium, ITalk, IPerson, IInterestRoom } from "../models/schedule";
import { ConferenceParser } from "./ConferenceParser";
import fetch from "node-fetch";
import { DateTime } from "luxon";
import { RoomKind } from "../models/room_kinds";

interface IPretalxSpeaker {
    name: string;
    code: string;
    bioagraphy: string;
}

interface IPretalxTalksResult {
    code: string;
    speakers: IPretalxSpeaker[],
    title: string;
    state: "submitted" | "accepted" | "rejected" | "confirmed";
    abstract: string;
    description: string;
    duration: number;
    do_not_record: boolean;
    is_featured: boolean;
    content_locale: string;
    slot: {
        start: string;
        end: string;
        room: string;
    };
    answers: {
        id: number;
        question: {
            id: number;
            question: { [language: string]: string; };
            required: boolean;
            target: string;
            options: any[];
        };
        answer: string;
        answer_file?: string;
        submission: string;
        person?: any;
        options: any[];
    }[];
    notes: string;
    internal_notes: string;
    tags: string[];
}

interface IPretalxResp<T> {
    count: number;
    next?: string;
    previous?: string;
    results: T[];
}

interface IPretalxTalksResp extends IPretalxResp<IPretalxTalksResult> { }

interface IPretalxEvent {
    name: { [language: string]: string; };
    slug: string;
    timezone: string;
    date_from: string;
    date_to?: string;
    is_public: boolean;
    urls: {
        base: string;
        schedule: string;
        login: string;
        feed: string;
    };
}

interface IPretalxRoomsResult {
    id: number;
    name: { [language: string]: string; };
    description: { [language: string]: string; };
    capacity: number;
    position: number;
    speaker_info: { [language: string]: string; };
    availabilities: { start: string; end: string; }[];
}

interface IPretalxRoomsResp extends IPretalxResp<IPretalxRoomsResult> { }

interface IPretalxSpreakersResult {
    code: string;
    name: string;
    biography: string;
    submissions: string[];
    avatar: string;
    availabilities: {
        id: number;
        start: string;
        end: string;
        allDay: boolean;
    };
}

interface IPretalxSpreakersResp extends IPretalxResp<IPretalxSpreakersResult> { }

export default class PretalxParser implements ConferenceParser {
    public getSystemName(): AvailableBackends {
        return "pretalx";
    }

    public conference: IConference;
    public auditoriums: IAuditorium[];
    public talks: ITalk[];
    public speakers: IPerson[];
    public interestRooms: IInterestRoom[];

    private constructor(conference: IConference, auditoriums: IAuditorium[], talks: ITalk[], speakers: IPerson[], interestRooms: IInterestRoom[]) {
        this.conference = conference;
        this.auditoriums = auditoriums;
        this.talks = talks;
        this.speakers = speakers;
        this.interestRooms = interestRooms;
    }

    // Pretalx calls the conference an event
    // 
    // auditoriums/interestRooms are called slot.room in a talk.
    //
    // Matrix ID is handled using a question
    // Talk slug should be done using a question
    //
    // See docs for more
    public static async createPretalxParser(): Promise<PretalxParser> {
        const pretalxConference = await this.fetchAPI<IPretalxEvent>(`api/events/${config.conference.id}`, undefined, undefined);
        const pretalxRooms = await this.fetchAPI<IPretalxRoomsResp>(`api/events/${config.conference.id}/rooms `, undefined, undefined);
        const pretalxTalks = await this.fetchAPI<IPretalxTalksResp>(`api/events/${config.conference.id}/talks `, undefined, undefined);
        const pretalxSpeakers = await this.fetchAPI<IPretalxSpreakersResp>(`api/events/${config.conference.id}/speakers `, undefined, undefined);
        const auditoriums: IAuditorium[] = [];
        const interestRooms: IInterestRoom[] = [];

        for (const room of pretalxRooms.results) {
            if (config.conference.prefixes.auditoriumRooms.some(prefix => room.name["en"].startsWith(prefix))) {
                if (!auditoriums.some(r => r.id === room.id.toString())) {
                    auditoriums.push({
                        id: room.id.toString(),
                        name: room.name["en"],
                        kind: RoomKind.Auditorium,
                        talksByDate: {},
                    });
                }
            } else if (config.conference.prefixes.interestRooms.some(prefix => room.name["en"].startsWith(prefix))) {
                if (!interestRooms.some(r => r.id === room.id.toString())) {
                    interestRooms.push({
                        id: room.id.toString(),
                        name: room.name["en"],
                        kind: RoomKind.SpecialInterest
                    });
                }
            }
        }

        const talks = pretalxTalks.results.map(talk => {
            const italk: ITalk = {
                id: talk.code,
                dateTs: DateTime.fromISO(talk.slot.start).toMillis(),
                startTime: DateTime.fromISO(talk.slot.start).toMillis(),
                endTime: DateTime.fromISO(talk.slot.end).toMillis(),
                slug: talk.answers.find(answer => answer.question["en"] === "Slug for the submission?").answer,
                title: talk.title,
                subtitle: talk.abstract,
                track: talk.slot.room,
                speakers: talk.speakers.map(speaker => {
                    return {
                        id: speaker.code,
                        name: speaker.name
                    } as IPerson;
                }),
            };
            const auditoriumroom = auditoriums.find(room => room.name === talk.slot.room);
            if (auditoriumroom) {
                if (auditoriumroom.talksByDate[DateTime.fromISO(talk.slot.start).toMillis()]) {
                    auditoriumroom.talksByDate[DateTime.fromISO(talk.slot.start).toMillis()].push(italk);
                } else {
                    auditoriumroom.talksByDate[DateTime.fromISO(talk.slot.start).toMillis()];
                    auditoriumroom.talksByDate[DateTime.fromISO(talk.slot.start).toMillis()] = [italk];
                }
            }
            return italk;
        });

        const conference = {
            title: pretalxConference.name["en"],
            auditoriums: auditoriums,
            interestRooms: interestRooms,
        };

        const speakers: IPerson[] = pretalxSpeakers.results.map(speaker => {
            return {
                id: speaker.code,
                name: speaker.name
            };
        });


        return new PretalxParser(conference, auditoriums, talks, speakers, interestRooms);
    }

    private static async fetchAPI<T>(endpoint: string, method = "GET", body: string | undefined): Promise<T> {
        const resp = await fetch(`${config.conference.backend.pretalx.instanceDomain}/${endpoint}`,
            {
                method: method,
                body: body,
                headers: {
                    "Authorization": `Token ${config.conference.backend.pretalx.apiToken}`
                }
            }
        );
        const json = await resp.json();
        return json as T;
    }
}