// (C) Copyright 2015 Moodle Pty Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { SQLiteDB } from '@classes/sqlitedb';
import { CoreRemindersService, CoreReminders } from '@features/reminders/services/reminders';
import { CoreConfig } from '@services/config';
import { CoreSiteSchema } from '@services/sites';
import { CoreUtils } from '@services/utils/utils';
import { AddonCalendarEventType } from '../calendar';

/**
 * Database variables for AddonCalendarProvider service.
 */
export const EVENTS_TABLE = 'addon_calendar_events_3';
export const CALENDAR_SITE_SCHEMA: CoreSiteSchema = {
    name: 'AddonCalendarProvider',
    version: 5,
    canBeCleared: [EVENTS_TABLE],
    tables: [
        {
            name: EVENTS_TABLE,
            columns: [
                {
                    name: 'id',
                    type: 'INTEGER',
                    primaryKey: true,
                },
                {
                    name: 'name',
                    type: 'TEXT',
                    notNull: true,
                },
                {
                    name: 'description',
                    type: 'TEXT',
                },
                {
                    name: 'eventtype',
                    type: 'TEXT',
                },
                {
                    name: 'courseid',
                    type: 'INTEGER',
                },
                {
                    name: 'timestart',
                    type: 'INTEGER',
                },
                {
                    name: 'timeduration',
                    type: 'INTEGER',
                },
                {
                    name: 'categoryid',
                    type: 'INTEGER',
                },
                {
                    name: 'groupid',
                    type: 'INTEGER',
                },
                {
                    name: 'userid',
                    type: 'INTEGER',
                },
                {
                    name: 'instance',
                    type: 'INTEGER',
                },
                {
                    name: 'modulename',
                    type: 'TEXT',
                },
                {
                    name: 'timemodified',
                    type: 'INTEGER',
                },
                {
                    name: 'repeatid',
                    type: 'INTEGER',
                },
                {
                    name: 'visible',
                    type: 'INTEGER',
                },
                {
                    name: 'uuid',
                    type: 'TEXT',
                },
                {
                    name: 'sequence',
                    type: 'INTEGER',
                },
                {
                    name: 'subscriptionid',
                    type: 'INTEGER',
                },
                {
                    name: 'location',
                    type: 'TEXT',
                },
                {
                    name: 'eventcount',
                    type: 'INTEGER',
                },
                {
                    name: 'timesort',
                    type: 'INTEGER',
                },
                {
                    name: 'category',
                    type: 'TEXT',
                },
                {
                    name: 'course',
                    type: 'TEXT',
                },
                {
                    name: 'subscription',
                    type: 'TEXT',
                },
                {
                    name: 'canedit',
                    type: 'INTEGER',
                },
                {
                    name: 'candelete',
                    type: 'INTEGER',
                },
                {
                    name: 'deleteurl',
                    type: 'TEXT',
                },
                {
                    name: 'editurl',
                    type: 'TEXT',
                },
                {
                    name: 'viewurl',
                    type: 'TEXT',
                },
                {
                    name: 'isactionevent',
                    type: 'INTEGER',
                },
                {
                    name: 'url',
                    type: 'TEXT',
                },
                {
                    name: 'islastday',
                    type: 'INTEGER',
                },
                {
                    name: 'popupname',
                    type: 'TEXT',
                },
                {
                    name: 'mindaytimestamp',
                    type: 'INTEGER',
                },
                {
                    name: 'maxdaytimestamp',
                    type: 'INTEGER',
                },
                {
                    name: 'draggable',
                    type: 'INTEGER',
                },
            ],
        },
    ],
    async migrate(db: SQLiteDB, oldVersion: number, siteId: string): Promise<void> {
        if (oldVersion < 5) {
            await migrateDefaultTime(siteId, oldVersion < 4);
        }
    },
};

/**
 * Migrate default notification time if it was changed.
 * Don't use getDefaultNotificationTime to be able to detect if the value was changed or not.
 *
 * @param siteId Site ID to migrate.
 * @param convertToSeconds If true, time will be converted to seconds.
 */
const migrateDefaultTime = async (siteId: string, convertToSeconds = false): Promise<void> => {

    const key = 'mmaCalendarDefaultNotifTime#' + siteId;
    try {
        let defaultTime = await CoreConfig.get<number>(key);
        await CoreUtils.ignoreErrors(CoreConfig.delete(key));

        if (defaultTime <= 0) {
            defaultTime = CoreRemindersService.DISABLED;
        } else if (convertToSeconds) {
            // Convert from minutes to seconds.
            defaultTime = defaultTime * 60;
        }

        CoreReminders.setDefaultNotificationTime(defaultTime, siteId);
    } catch {
        // Ignore errors, already migrated.
    }
};

export type AddonCalendarEventDBRecord = {
    id: number;
    name: string;
    description: string;
    eventtype: AddonCalendarEventType | string;
    timestart: number;
    timeduration: number;
    categoryid?: number;
    groupid?: number;
    userid?: number;
    instance?: number;
    modulename?: string;
    timemodified: number;
    repeatid?: number;
    visible: number;
    // Following properties are only available on AddonCalendarGetEventsEvent
    courseid?: number;
    uuid?: string;
    sequence?: number;
    subscriptionid?: number;
    // Following properties are only available on AddonCalendarCalendarEvent
    location?: string;
    eventcount?: number;
    timesort?: number;
    category?: string;
    course?: string;
    subscription?: string;
    canedit?: number;
    candelete?: number;
    deleteurl?: string;
    editurl?: string;
    viewurl?: string;
    isactionevent?: number;
    url?: string;
    islastday?: number;
    popupname?: string;
    mindaytimestamp?: number;
    maxdaytimestamp?: number;
    draggable?: number;
};
