import { DateTime } from "luxon";
import config, { AvailableBackends } from "../config";
import { IPretalxTalksResp, IPretalxTalksResult } from "../parsers/PretalxParser";
import { DBBackend } from "./backendDb";
import { IDbPerson } from "./DbPerson";
import { IDbTalk } from "./DbTalk";
import fetch from "node-fetch";

export class PretalxDb implements DBBackend {
    public getSystemName(): AvailableBackends {
        return "pretalx";
    }
    public async findPeopleWithId(personId: string): Promise<IDbPerson[]> {
        const pentalxTalks = await this.fetchAPI<IPretalxTalksResp>(`api/events/${config.conference.id}/talks `, undefined, undefined);
        return pentalxTalks.results
            .filter(talk => talk.speakers.some(speaker => speaker.code === personId))
            .map(talk => {
                const speaker = talk.speakers.find(speaker => speaker.code === personId);
                return {
                    name: speaker.name,
                    event_id: talk.code,
                    person_id: speaker.code,
                    event_role: undefined, // TODO figure this out
                    email: speaker.email,
                    matrix_id: talk.answers.find(answer => answer.question.question["en"] === "What is your Matrix ID?").answer,
                    conference_room: talk.slot.room["en"],
                    remark: "", // pretalx has no remarks it seems
                } as IDbPerson;
            });
    }

    public async findAllPeopleForAuditorium(auditoriumId: string): Promise<IDbPerson[]> {
        const pentalxTalks = await this.fetchAPI<IPretalxTalksResp>(`api/events/${config.conference.id}/talks `, undefined, undefined);
        return pentalxTalks.results
            .filter(talk => talk.slot.room["en"] === auditoriumId && config.conference.prefixes.auditoriumRooms.some(prefix => { return talk.slot.room["en"].startsWith(prefix); }))
            .flatMap(talk => talk.speakers
                .map(speaker => {
                    return {
                        name: speaker.name,
                        event_id: talk.code,
                        person_id: speaker.code,
                        event_role: undefined, // TODO figure this out
                        email: speaker.email,
                        matrix_id: talk.answers.find(answer => answer.question.question["en"] === "What is your Matrix ID?").answer,
                        conference_room: talk.slot.room["en"],
                        remark: "", // pretalx has no remarks it seems
                    } as IDbPerson;
                })
            );
    }

    public async findAllPeopleForTalk(talkId: string): Promise<IDbPerson[]> {
        const pentalxTalks = await this.fetchAPI<IPretalxTalksResp>(`api/events/${config.conference.id}/talks `, undefined, undefined);
        return pentalxTalks.results
            .filter(talk => talk.code === talkId)
            .flatMap(talk => talk.speakers
                .map(speaker => {
                    return {
                        name: speaker.name,
                        event_id: talk.code,
                        person_id: speaker.code,
                        event_role: undefined, // TODO figure this out
                        email: speaker.email,
                        matrix_id: talk.answers.find(answer => answer.question.question["en"] === "What is your Matrix ID?").answer,
                        conference_room: talk.slot.room["en"],
                        remark: "", // pretalx has no remarks it seems
                    } as IDbPerson;
                })
            );
    }

    // Not supported
    public async findAllPeopleWithRemark(remark: string): Promise<IDbPerson[]> {
        return [] as IDbPerson[];
    }

    public async getUpcomingTalkStarts(inNextMinutes: number, minBefore: number): Promise<IDbTalk[]> {
        // where starttime is >= now - minBefore AND starttime <= now + inNextMinutes
        const pentalxTalks = await this.fetchAPI<IPretalxTalksResp>(`api/events/${config.conference.id}/talks `, undefined, undefined);
        const now = DateTime.now();
        return pentalxTalks.results.filter(talk => {
            const startTime = DateTime.fromISO(talk.slot.start);
            return startTime >= now.minus({ minutes: minBefore }) && startTime <= now.plus({ minutes: inNextMinutes });
        }).map(talk => this.postprocessTalk(talk));
    }

    public async getUpcomingQAStarts(inNextMinutes: number, minBefore: number): Promise<IDbTalk[]> {
        // where (starttime + presentation_length) is >= now - minBefore AND (starttime + presentation_length) <= now + inNextMinutes
        const pentalxTalks = await this.fetchAPI<IPretalxTalksResp>(`api/events/${config.conference.id}/talks `, undefined, undefined);
        const now = DateTime.now();
        return pentalxTalks.results.filter(talk => {
            const presentation_length = talk.answers.find(answer => answer.question.question["en"] === "Duration of the video?").answer as number;
            const startTime = DateTime.fromISO(talk.slot.start).plus({ minutes: presentation_length });
            return startTime >= now.minus({ minutes: minBefore }) && startTime <= now.plus({ minutes: inNextMinutes });
        }).map(talk => this.postprocessTalk(talk));
    }

    public async getUpcomingTalkEnds(inNextMinutes: number, minBefore: number): Promise<IDbTalk[]> {
        // where (starttime + duration) is >= now - minBefore AND (starttime + duration) <= now + inNextMinutes
        const pentalxTalks = await this.fetchAPI<IPretalxTalksResp>(`api/events/${config.conference.id}/talks `, undefined, undefined);
        const now = DateTime.now();
        return pentalxTalks.results.filter(talk => {
            const startTime = DateTime.fromISO(talk.slot.start).plus({ minutes: talk.duration });
            return startTime >= now.minus({ minutes: minBefore }) && startTime <= now.plus({ minutes: inNextMinutes });
        }).map(talk => this.postprocessTalk(talk));
    }

    public async getTalk(talkId: string): Promise<IDbTalk> {
        const pentalxTalk = await this.fetchAPI<IPretalxTalksResult>(`api/events/${config.conference.id}/talks/${talkId} `, undefined, undefined);
        return this.postprocessTalk(pentalxTalk);
    }

    private async fetchAPI<T>(endpoint: string, method = "GET", body: string | undefined): Promise<T> {
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

    private postprocessTalk(pentalxTalk: IPretalxTalksResult): IDbTalk {
        const prerecorded = true;// TODO check if we have files and then use those?
        let livestreamStartDatetime: number;
        const videoLength = pentalxTalk.answers.find(answer => answer.question.question["en"] === "Duration of the video?").answer as number;
        const qaStartTimeRaw = DateTime.fromISO(pentalxTalk.slot.start).plus({ minutes: videoLength });
        const qaStartTime = qaStartTimeRaw.plus({ seconds: config.conference.backend.schedulePreBufferSeconds * 1000 }).toMillis();
        if (prerecorded) {
            // For prerecorded talks, a preroll is shown, followed by the talk recording, then an
            // interroll, then live Q&A.
            livestreamStartDatetime = qaStartTime;
        } else {
            // For live talks, both the preroll and interroll are shown, followed by the live talk.
            livestreamStartDatetime = DateTime.fromISO(pentalxTalk.slot.start).toMillis() + config.conference.backend.schedulePreBufferSeconds * 1000;
        }
        const livestreamEndDatetime = DateTime.fromISO(pentalxTalk.slot.end).toMillis() - config.conference.backend.schedulePostBufferSeconds * 1000;
        return {
            event_id: pentalxTalk.code,
            conference_room: pentalxTalk.slot.room["en"],
            start_datetime: DateTime.fromISO(pentalxTalk.slot.start).toMillis(),
            duration_seconds: pentalxTalk.duration * 60,
            presentation_length_seconds: 0, // TODO this we cant seem to get from the API easily
            end_datetime: DateTime.fromISO(pentalxTalk.slot.end).toMillis(),
            qa_start_datetime: qaStartTime,
            prerecorded: prerecorded,
            livestream_start_datetime: livestreamStartDatetime,
            livestream_end_datetime: livestreamEndDatetime
        };
    }
}