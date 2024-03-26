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
import { CoreApp } from '@services/app';
import { CoreNetwork } from '@services/network';
import { CoreCronDelegate } from '@services/cron';
import { CoreEvents } from '@singletons/events';
import { CoreFilepool } from '@services/filepool';
import { CoreSite } from '@classes/sites/site';
import { CoreSites } from '@services/sites';
import { CoreUtils } from '@services/utils/utils';
import { CoreConstants } from '@/core/constants';
import { CoreConfig } from '@services/config';
import { CoreFilter } from '@features/filter/services/filter';
import { CoreDomUtils } from '@services/utils/dom';
import { CoreCourse } from '@features/course/services/course';
import { makeSingleton, Translate } from '@singletons';
import { CoreError } from '@classes/errors/error';
import { Observable, Subject } from 'rxjs';
import { CoreTextUtils } from '@services/utils/text';
import { CoreNavigator } from '@services/navigator';

/**
 * Object with space usage and cache entries that can be erased.
 */
export interface CoreSiteSpaceUsage {
    cacheEntries: number; // Number of cached entries that can be cleared.
    spaceUsage: number; // Space used in this site (total files + estimate of cache).
}

/**
 * Constants to define color schemes.
 */
export const enum CoreColorScheme {
    SYSTEM = 'system',
    LIGHT = 'light',
    DARK = 'dark',
}

/**
 * Constants to define zoom levels.
 */
export const enum CoreZoomLevel {
    NONE = 'none',
    MEDIUM = 'medium',
    HIGH = 'high',
}

/**
 * Settings helper service.
 */
@Injectable({ providedIn: 'root' })
export class CoreSettingsHelperProvider {

    protected syncPromises: { [s: string]: Promise<void> } = {};
    protected prefersDark?: MediaQueryList;
    protected colorSchemes: CoreColorScheme[] = [];
    protected currentColorScheme = CoreColorScheme.LIGHT;
    protected darkModeObservable = new Subject<boolean>();

    async initialize(): Promise<void> {
        this.prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

        if (!CoreConstants.CONFIG.forceColorScheme) {
            // Update color scheme when a user enters or leaves a site, or when the site info is updated.
            const applySiteScheme = (): void => {
                if (this.isColorSchemeDisabledInSite()) {
                    // Dark mode is disabled, force light mode.
                    this.setColorScheme(CoreColorScheme.LIGHT);
                } else {
                    // Reset color scheme settings.
                    this.initColorScheme();
                }
            };

            CoreEvents.on(CoreEvents.LOGIN, () => applySiteScheme());

            CoreEvents.on(CoreEvents.SITE_UPDATED, () => applySiteScheme());

            CoreEvents.on(CoreEvents.LOGOUT, () => {
                // Reset color scheme settings.
                this.initColorScheme();
            });
        } else {
            this.initColorScheme();
        }

        // Listen for changes to the prefers-color-scheme media query.
        this.prefersDark.addEventListener && this.prefersDark.addEventListener('change', () => {
            this.setColorScheme(this.currentColorScheme);
        });

        // Init zoom level.
        await this.upgradeZoomLevel();

        this.initDomSettings();
    }

    /**
     * Deletes files of a site and the tables that can be cleared.
     *
     * @param siteName Site Name.
     * @param siteId Site ID.
     * @returns Resolved with detailed new info when done.
     */
    async deleteSiteStorage(siteName: string, siteId: string): Promise<CoreSiteSpaceUsage> {
        const siteInfo: CoreSiteSpaceUsage = {
            cacheEntries: 0,
            spaceUsage: 0,
        };

        siteName = await CoreFilter.formatText(siteName, { clean: true, singleLine: true, filter: false }, [], siteId);

        const title = Translate.instant('addon.storagemanager.confirmdeleteallsitedata');

        await CoreDomUtils.showDeleteConfirm(
            'addon.storagemanager.deleteallsitedatainfo',
            { name: siteName },
            { header:  title },
        );

        const site = await CoreSites.getSite(siteId);

        // Clear cache tables.
        const cleanSchemas = CoreSites.getSiteTableSchemasToClear(site);
        const promises: Promise<number | void>[] = cleanSchemas.map((name) => site.getDb().deleteRecords(name));
        const filepoolService = CoreFilepool.instance;

        promises.push(site.deleteFolder().then(() => {
            filepoolService.clearAllPackagesStatus(siteId);
            filepoolService.clearFilepool(siteId);
            CoreCourse.clearAllCoursesStatus(siteId);

            siteInfo.spaceUsage = 0;

            return;
        }).catch(async (error) => {
            if (error && error.code === FileError.NOT_FOUND_ERR) {
                // Not found, set size 0.
                filepoolService.clearAllPackagesStatus(siteId);
                siteInfo.spaceUsage = 0;
            } else {
                // Error, recalculate the site usage.
                CoreDomUtils.showErrorModal('addon.storagemanager.errordeletedownloadeddata', true);

                siteInfo.spaceUsage = await site.getSpaceUsage();
            }
        }).then(async () => {
            CoreEvents.trigger(CoreEvents.SITE_STORAGE_DELETED, {}, siteId);

            siteInfo.cacheEntries = await this.calcSiteClearRows(site);

            return;
        }));

        await Promise.all(promises);

        return siteInfo;
    }

    /**
     * Calculates each site's usage, and the total usage.
     *
     * @param siteId ID of the site. Current site if undefined.
     * @returns Resolved with detailed info when done.
     */
    async getSiteSpaceUsage(siteId?: string): Promise<CoreSiteSpaceUsage> {
        const site = await CoreSites.getSite(siteId);

        // Get space usage.
        const siteInfo: CoreSiteSpaceUsage = {
            cacheEntries: 0,
            spaceUsage: 0,
        };

        siteInfo.cacheEntries = await this.calcSiteClearRows(site);
        siteInfo.spaceUsage = await site.getTotalUsage();

        return siteInfo;
    }

    /**
     * Calculate the number of rows to be deleted on a site.
     *
     * @param site Site object.
     * @returns If there are rows to delete or not.
     */
    protected async calcSiteClearRows(site: CoreSite): Promise<number> {
        const clearTables = CoreSites.getSiteTableSchemasToClear(site);

        let totalEntries = 0;

        await Promise.all(clearTables.map(async (name) =>
            totalEntries = await site.getDb().countRecords(name) + totalEntries));

        return totalEntries;
    }

    /**
     * Get the synchronization promise of a site.
     *
     * @param siteId ID of the site.
     * @returns Sync promise or null if site is not being syncrhonized.
     */
    getSiteSyncPromise(siteId: string): Promise<void> | void {
        if (this.syncPromises[siteId] !== undefined) {
            return this.syncPromises[siteId];
        }
    }

    /**
     * Synchronize a site.
     *
     * @param syncOnlyOnWifi True to sync only on wifi, false otherwise.
     * @param siteId ID of the site to synchronize.
     * @returns Promise resolved when synchronized, rejected if failure.
     */
    async synchronizeSite(syncOnlyOnWifi: boolean, siteId: string): Promise<void> {
        if (this.syncPromises[siteId] !== undefined) {
            // There's already a sync ongoing for this site, return the promise.
            return this.syncPromises[siteId];
        }

        const site = await CoreSites.getSite(siteId);
        const hasSyncHandlers = CoreCronDelegate.hasManualSyncHandlers();

        // All these errors should not happen on manual sync because are prevented on UI.
        if (site.isLoggedOut()) {
            // Cannot sync logged out sites.
            throw new CoreError(Translate.instant('core.settings.cannotsyncloggedout'));
        } else if (hasSyncHandlers && !CoreNetwork.isOnline()) {
            // We need connection to execute sync.
            throw new CoreError(Translate.instant('core.settings.cannotsyncoffline'));
        } else if (hasSyncHandlers && syncOnlyOnWifi && CoreNetwork.isNetworkAccessLimited()) {
            throw new CoreError(Translate.instant('core.settings.cannotsyncwithoutwifi'));
        }

        const syncPromise = Promise.all([
            // Invalidate all the site files so they are re-downloaded.
            CoreUtils.ignoreErrors(CoreFilepool.invalidateAllFiles(siteId)),
            // Invalidate and synchronize site data.
            site.invalidateWsCache(),
            CoreSites.updateSiteInfo(site.getId()),
            CoreCronDelegate.forceSyncExecution(site.getId()),
        // eslint-disable-next-line arrow-body-style
        ]).then(() => {
            return;
        });

        this.syncPromises[siteId] = syncPromise;

        try {
            await syncPromise;
        } catch (error) {
            throw CoreTextUtils.addTitleToError(error, Translate.instant('core.settings.sitesyncfailed'));
        } finally {
            delete this.syncPromises[siteId];
        }
    }

    /**
     * Upgrades from Font size to new zoom level.
     */
    async upgradeZoomLevel(): Promise<void> {
        // Check old setting and update the new.
        try {
            const fontSize = await CoreConfig.get<number>('CoreSettingsFontSize');
            if (fontSize === undefined) {
                // Already upgraded.
                return;
            }

            // Reset the value to solve edge cases.
            CoreConfig.set(CoreConstants.SETTINGS_ZOOM_LEVEL, CoreZoomLevel.NONE);

            if (fontSize < 100) {
                if (fontSize > 90) {
                    CoreConfig.set(CoreConstants.SETTINGS_ZOOM_LEVEL, CoreZoomLevel.HIGH);
                } else if (fontSize > 70) {
                    CoreConfig.set(CoreConstants.SETTINGS_ZOOM_LEVEL, CoreZoomLevel.MEDIUM);
                }
            }

            CoreConfig.delete('CoreSettingsFontSize');
        } catch {
            // Already upgraded.
            return;
        }
    }

    /**
     * Get saved Zoom Level setting.
     *
     * @returns The saved zoom Level option.
     */
    async getZoomLevel(): Promise<CoreZoomLevel> {
        return CoreConfig.get(CoreConstants.SETTINGS_ZOOM_LEVEL, CoreConstants.CONFIG.defaultZoomLevel);
    }

    /**
     * Get saved zoom level value.
     *
     * @returns The saved zoom level value in %.
     */
    async getZoom(): Promise<number> {
        const zoomLevel = await this.getZoomLevel();

        return CoreConstants.CONFIG.zoomlevels[zoomLevel];
    }

    /**
     * Init Settings related to DOM.
     */
    async initDomSettings(): Promise<void> {
        // Set the font size based on user preference.
        const zoomLevel = await this.getZoomLevel();

        this.applyZoomLevel(zoomLevel);

        this.initColorScheme();
    }

    /**
     * Init the color scheme.
     */
    async initColorScheme(): Promise<void> {
        if (CoreConstants.CONFIG.forceColorScheme) {
            this.setColorScheme(CoreConstants.CONFIG.forceColorScheme);
        } else {
            const scheme = await CoreConfig.get(CoreConstants.SETTINGS_COLOR_SCHEME, CoreColorScheme.LIGHT);
            this.setColorScheme(scheme);
        }
    }

    /**
     * Check if color scheme is disabled in a site.
     *
     * @param siteId Site ID. If not defined, current site.
     * @returns Promise resolved with whether color scheme is disabled.
     */
    async isColorSchemeDisabled(siteId?: string): Promise<boolean> {
        const site = await CoreSites.getSite(siteId);

        return this.isColorSchemeDisabledInSite(site);
    }

    /**
     * Check if color scheme is disabled in a site.
     *
     * @param site Site instance. If not defined, current site.
     * @returns Whether color scheme is disabled.
     */
    isColorSchemeDisabledInSite(site?: CoreSite): boolean {
        site = site || CoreSites.getCurrentSite();

        return site ? site.isFeatureDisabled('NoDelegate_DarkMode') : false;
    }

    /**
     * Set document default font size.
     *
     * @param zoomLevel Zoom Level.
     */
    applyZoomLevel(zoomLevel: CoreZoomLevel): void {
        const zoom = CoreConstants.CONFIG.zoomlevels[zoomLevel];

        document.documentElement.style.setProperty('--zoom-level', zoom + '%');
    }

    /**
     * Get system allowed color schemes.
     *
     * @returns Allowed color schemes.
     */
    getAllowedColorSchemes(): CoreColorScheme[] {
        if (this.colorSchemes.length > 0) {
            return this.colorSchemes;
        }

        if (!CoreConstants.CONFIG.forceColorScheme) {
            this.colorSchemes.push(CoreColorScheme.LIGHT);
            this.colorSchemes.push(CoreColorScheme.DARK);

            if (this.canIUsePrefersColorScheme()) {
                this.colorSchemes.push(CoreColorScheme.SYSTEM);
            }
        } else {
            this.colorSchemes = [CoreConstants.CONFIG.forceColorScheme];
        }

        return this.colorSchemes;
    }

    /**
     * Set body color scheme.
     *
     * @param colorScheme Name of the color scheme.
     */
    setColorScheme(colorScheme: CoreColorScheme): void {
        this.currentColorScheme = colorScheme;
        if (colorScheme == CoreColorScheme.SYSTEM && this.prefersDark) {
            this.toggleDarkMode(this.prefersDark.matches);
        } else {
            this.toggleDarkMode(colorScheme == CoreColorScheme.DARK);
        }
    }

    /**
     * Check if device can detect color scheme system preference.
     * https://caniuse.com/prefers-color-scheme
     *
     * @returns if the color scheme system preference is available.
     */
    canIUsePrefersColorScheme(): boolean {
        // The following check will check browser support but system may differ from that.
        return window.matchMedia('(prefers-color-scheme)').media !== 'not all';
    }

    /**
     * Toggles dark mode based on enabled boolean.
     *
     * @param enable True to enable dark mode, false to disable.
     */
    protected toggleDarkMode(enable: boolean = false): void {
        const isDark = CoreDomUtils.hasModeClass('dark');

        if (isDark !== enable) {
            CoreDomUtils.toggleModeClass('dark', enable, { includeLegacy: true });
            this.darkModeObservable.next(enable);

            CoreApp.setSystemUIColors();
        }
    }

    /**
     * Returns dark mode change observable.
     *
     * @returns Dark mode change observable.
     */
    onDarkModeChange(): Observable<boolean> {
        return this.darkModeObservable;
    }

    /**
     * Get if user enabled staging sites or not.
     *
     * @returns Staging sites.
     */
    async hasEnabledStagingSites(): Promise<boolean> {
        const staging = await CoreConfig.get<number>('stagingSites', 0);

        return !!staging;
    }

    /**
     * Persist staging sites enabled status and refresh app to apply changes.
     *
     * @param enabled Enabled or disabled staging sites.
     */
    async setEnabledStagingSites(enabled: boolean): Promise<void> {
        const reloadApp = !CoreSites.isLoggedIn();

        if (reloadApp) {
            await CoreDomUtils.showConfirm('Are you sure that you want to enable/disable staging sites?');
        }

        await CoreConfig.set('stagingSites', enabled ? 1 : 0);

        if (!reloadApp) {
            return;
        }

        await CoreNavigator.navigate('/');
        window.location.reload();
    }

}

export const CoreSettingsHelper = makeSingleton(CoreSettingsHelperProvider);
