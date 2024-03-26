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

import { CoreSites } from '@services/sites';
import { CoreTextUtils } from '@services/utils/text';
import { CoreUtils } from '@services/utils/utils';
import { CoreSyncBaseProvider } from '@classes/base-sync';
import { makeSingleton } from '@singletons';
import { CoreUserOffline } from './user-offline';
import { CoreUser } from './user';

/**
 * Service to sync user preferences.
 */
@Injectable({ providedIn: 'root' })
export class CoreUserSyncProvider extends CoreSyncBaseProvider<string[]> {

    static readonly AUTO_SYNCED = 'core_user_autom_synced';

    constructor() {
        super('CoreUserSync');
    }

    /**
     * Try to synchronize user preferences in a certain site or in all sites.
     *
     * @param siteId Site ID to sync. If not defined, sync all sites.
     * @returns Promise resolved with warnings if sync is successful, rejected if sync fails.
     */
    syncPreferences(siteId?: string): Promise<void> {
        return this.syncOnSites('all user preferences', (siteId) => this.syncSitePreferences(siteId), siteId);
    }

    /**
     * Sync user preferences of a site.
     *
     * @param siteId Site ID to sync.
     * @returns Promise resolved with warnings if sync is successful, rejected if sync fails.
     */
    async syncSitePreferences(siteId: string): Promise<string[]> {
        siteId = siteId || CoreSites.getCurrentSiteId();

        const syncId = 'preferences';
        const currentSyncPromise = this.getOngoingSync(syncId, siteId);

        if (currentSyncPromise) {
            // There's already a sync ongoing, return the promise.
            return currentSyncPromise;
        }

        this.logger.debug('Try to sync user preferences');

        const syncPromise = this.performSyncSitePreferences(siteId);

        return this.addOngoingSync(syncId, syncPromise, siteId);
    }

    /**
     * Sync user preferences of a site.
     *
     * @param siteId Site ID to sync.
     * @returns Promise resolved if sync is successful, rejected if sync fails.
     */
    protected async performSyncSitePreferences(siteId: string): Promise<string[]> {
        const warnings: string[] = [];

        const preferences = await CoreUserOffline.getChangedPreferences(siteId);

        await CoreUtils.allPromises(preferences.map(async (preference) => {
            const onlineValue = await CoreUser.getUserPreferenceOnline(preference.name, siteId);

            if (onlineValue !== null && preference.onlinevalue != onlineValue) {
                // Preference was changed on web while the app was offline, do not sync.
                return CoreUserOffline.setPreference(preference.name, onlineValue, onlineValue, siteId);
            }

            try {
                await CoreUser.setUserPreference(preference.name, preference.value, siteId);
            } catch (error) {
                if (CoreUtils.isWebServiceError(error)) {
                    const warning = CoreTextUtils.getErrorMessageFromError(error);
                    if (warning) {
                        warnings.push(warning);
                    }
                } else {
                    // Couldn't connect to server, reject.
                    throw error;
                }
            }
        }));

        // All done, return the warnings.
        return warnings;
    }

}

export const CoreUserSync = makeSingleton(CoreUserSyncProvider);
