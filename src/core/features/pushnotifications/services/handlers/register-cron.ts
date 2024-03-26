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

import { CoreCronHandler } from '@services/cron';
import { makeSingleton } from '@singletons';
import { CorePushNotifications } from '../pushnotifications';

/**
 * Cron handler to force a register on a Moodle site when a site is manually synchronized.
 */
@Injectable({ providedIn: 'root' })
export class CorePushNotificationsRegisterCronHandlerService implements CoreCronHandler {

    name = 'CorePushNotificationsRegisterCronHandler';

    /**
     * Check whether the sync can be executed manually. Call isSync if not defined.
     *
     * @returns Whether the sync can be executed manually.
     */
    canManualSync(): boolean {
        return true; // Execute the handler when the site is manually synchronized.
    }

    /**
     * Execute the process.
     * Receives the ID of the site affected, undefined for all sites.
     *
     * @param siteId ID of the site affected, undefined for all sites.
     * @returns Promise resolved when done, rejected if failure.
     */
    async execute(siteId?: string): Promise<void> {
        if (!siteId || !CorePushNotifications.canRegisterOnMoodle()) {
            // It's not a specific site, don't do anything.
            return;
        }

        // Register the device again.
        await CorePushNotifications.registerDeviceOnMoodle(siteId, true);
    }

    /**
     * Get the time between consecutive executions.
     *
     * @returns Time between consecutive executions (in ms).
     */
    getInterval(): number {
        return 86400000; // 1 day. We won't do anything with automatic execution, so use a big number.
    }

    /**
     * Check whether it's a synchronization process or not. True if not defined.
     *
     * @returns Whether it's a synchronization process or not.
     */
    isSync(): boolean {
        return false;
    }

}

export const CorePushNotificationsRegisterCronHandler = makeSingleton(CorePushNotificationsRegisterCronHandlerService);
