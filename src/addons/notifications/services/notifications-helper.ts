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

import { Injectable } from '@angular/core';

import { CoreUtils } from '@services/utils/utils';
import { makeSingleton } from '@singletons';
import { AddonMessageOutputDelegate } from '@addons/messageoutput/services/messageoutput-delegate';
import {
    AddonNotifications,
    AddonNotificationsNotificationMessageFormatted,
    AddonNotificationsPreferences,
    AddonNotificationsPreferencesComponent,
    AddonNotificationsPreferencesNotification,
    AddonNotificationsPreferencesNotificationProcessor,
    AddonNotificationsPreferencesProcessor,
    AddonNotificationsProvider,
} from './notifications';
import { CoreEvents } from '@singletons/events';
import { AddonNotificationsPushNotification } from './handlers/push-click';
import { CoreTimeUtils } from '@services/utils/time';

/**
 * Service that provides some helper functions for notifications.
 */
@Injectable({ providedIn: 'root' })
export class AddonNotificationsHelperProvider {

    /**
     * Formats the text of a notification.
     *
     * @param notification The notification object.
     * @returns The notification formatted to render.
     * @deprecated since 4.2. This function isn't needed anymore.
     */
    formatNotificationText(
        notification: AddonNotificationsNotificationMessageFormatted,
    ): AddonNotificationsNotificationMessageFormatted {
        return notification;
    }

    /**
     * Format preferences data.
     *
     * @param preferences Preferences to format.
     * @returns Formatted preferences.
     */
    formatPreferences(preferences: AddonNotificationsPreferences): AddonNotificationsPreferencesFormatted {
        const formattedPreferences: AddonNotificationsPreferencesFormatted = preferences;

        formattedPreferences.processors.forEach((processor) => {
            processor.supported = AddonMessageOutputDelegate.hasHandler(processor.name, true);
        });

        formattedPreferences.components.forEach((component) => {
            component.notifications.forEach((notification) => {
                notification.processorsByName = CoreUtils.arrayToObject(notification.processors, 'name');
            });
        });

        return formattedPreferences;
    }

    /**
     * Return the components and notifications that have a certain processor.
     *
     * @param processorName Name of the processor to filter.
     * @param components Array of components.
     * @returns Filtered components.
     */
    getProcessorComponents(
        processorName: string,
        components: AddonNotificationsPreferencesComponentFormatted[],
    ): AddonNotificationsPreferencesComponentFormatted[] {
        const result: AddonNotificationsPreferencesComponentFormatted[] = [];

        components.forEach((component) => {
            // Check if the component has any notification with this processor.
            const notifications: AddonNotificationsPreferencesNotificationFormatted[] = [];

            component.notifications.forEach((notification) => {
                const processor = notification.processorsByName?.[processorName];

                if (processor) {
                    // Add the notification.
                    notifications.push(notification);
                }
            });

            if (notifications.length) {
                // At least 1 notification added, add the component to the result.
                result.push({
                    displayname: component.displayname,
                    notifications,
                });
            }
        });

        return result;
    }

    /**
     * Mark notification as read, trigger event and invalidate data.
     *
     * @param notification Notification object.
     * @returns Promise resolved when done.
     */
    async markNotificationAsRead(
        notification: AddonNotificationsNotificationMessageFormatted | AddonNotificationsPushNotification,
        siteId?: string,
    ): Promise<boolean> {
        if ('read' in notification && (notification.read || notification.timeread > 0)) {
            // Already read, don't mark it.
            return false;
        }

        const notifId = 'savedmessageid' in notification ? notification.savedmessageid || notification.id : notification.id;
        if (!notifId) {
            return false;
        }

        siteId = 'site' in notification ? notification.site : siteId;

        await CoreUtils.ignoreErrors(AddonNotifications.markNotificationRead(notifId, siteId));

        const time = CoreTimeUtils.timestamp();
        if ('read' in notification) {
            notification.read = true;
            notification.timeread = time;
        }

        await CoreUtils.ignoreErrors(AddonNotifications.invalidateNotificationsList());

        CoreEvents.trigger(AddonNotificationsProvider.READ_CHANGED_EVENT, {
            id: notifId,
            time,
        }, siteId);

        return true;
    }

}

export const AddonNotificationsHelper = makeSingleton(AddonNotificationsHelperProvider);

/**
 * Preferences with some calculated data.
 */
export type AddonNotificationsPreferencesFormatted = Omit<AddonNotificationsPreferences, 'processors'|'components'> & {
    processors: AddonNotificationsPreferencesProcessorFormatted[]; // Config form values.
    components: AddonNotificationsPreferencesComponentFormatted[]; // Available components.
};

/**
 * Preferences component with some calculated data.
 */
export type AddonNotificationsPreferencesComponentFormatted = Omit<AddonNotificationsPreferencesComponent, 'notifications'> & {
    notifications: AddonNotificationsPreferencesNotificationFormatted[]; // List of notificaitons for the component.
};

/**
 * Preferences notification with some calculated data.
 */
export type AddonNotificationsPreferencesNotificationFormatted = AddonNotificationsPreferencesNotification & {
    processorsByName?: Record<string, AddonNotificationsPreferencesNotificationProcessorFormatted>; // Calculated in the app.
};

type AddonNotificationsPreferencesNotificationProcessorFormatted = AddonNotificationsPreferencesNotificationProcessor & {
    updating?: boolean; // Calculated in the app. Whether the state is being updated.
};

/**
 * Preferences processor with some calculated data.
 */
export type AddonNotificationsPreferencesProcessorFormatted = AddonNotificationsPreferencesProcessor & {
    supported?: boolean; // Calculated in the app. Whether the processor is supported in the app.
};
