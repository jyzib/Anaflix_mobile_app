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

import { InAppBrowserObject, InAppBrowserOptions } from '@awesome-cordova-plugins/in-app-browser';

import { CoreNetwork } from '@services/network';
import { CoreDB } from '@services/db';
import { CoreEventData, CoreEvents } from '@singletons/events';
import { CoreFile } from '@services/file';
import {
    CoreWS,
    CoreWSFileUploadOptions,
    CoreWSExternalWarning,
    CoreWSUploadFileResult,
} from '@services/ws';
import { CoreDomUtils } from '@services/utils/dom';
import { CoreTextUtils } from '@services/utils/text';
import { CoreTimeUtils } from '@services/utils/time';
import { CoreUrlUtils } from '@services/utils/url';
import { CoreUtils, CoreUtilsOpenInBrowserOptions } from '@services/utils/utils';
import { CoreConstants } from '@/core/constants';
import { SQLiteDB } from '@classes/sqlitedb';
import { CoreError } from '@classes/errors/error';
import { CoreLogger } from '@singletons/logger';
import { Translate } from '@singletons';
import { CoreIonLoadingElement } from '../ion-loading';
import { CoreSites, CoreSitesReadingStrategy } from '@services/sites';
import { asyncInstance, AsyncInstance } from '../../utils/async-instance';
import { CoreDatabaseTable } from '../database/database-table';
import { CoreDatabaseCachingStrategy } from '../database/database-table-proxy';
import {
    CONFIG_TABLE,
    CoreSiteConfigDBRecord,
    CoreSiteLastViewedDBRecord,
    CoreSiteWSCacheRecord,
    LAST_VIEWED_TABLE,
    WS_CACHE_TABLE,
} from '@services/database/sites';
import { map } from 'rxjs/operators';
import { CoreFilepool } from '@services/filepool';
import { CoreSiteInfo } from './unauthenticated-site';
import { CoreAuthenticatedSite, CoreAuthenticatedSiteOptionalData, CoreSiteWSPreSets, WSObservable } from './authenticated-site';
import { firstValueFrom } from 'rxjs';

/**
 * Class that represents a site (combination of site + user).
 * It will have all the site data and provide utility functions regarding a site.
 */
export class CoreSite extends CoreAuthenticatedSite {

    id: string;
    config?: CoreSiteConfig;
    loggedOut?: boolean;

    protected db!: SQLiteDB;
    protected cacheTable: AsyncInstance<CoreDatabaseTable<CoreSiteWSCacheRecord>>;
    protected configTable: AsyncInstance<CoreDatabaseTable<CoreSiteConfigDBRecord, 'name'>>;
    protected lastViewedTable: AsyncInstance<CoreDatabaseTable<CoreSiteLastViewedDBRecord, 'component' | 'id'>>;
    protected lastAutoLogin = 0;
    protected tokenPluginFileWorks?: boolean;
    protected tokenPluginFileWorksPromise?: Promise<boolean>;
    protected oauthId?: number;

    /**
     * Create a site.
     *
     * @param id Site ID.
     * @param siteUrl Site URL.
     * @param token Site's WS token.
     * @param otherData Other data.
     */
    constructor(
        id: string,
        siteUrl: string,
        token: string,
        otherData: CoreSiteOptionalData = {},
    ) {
        super(siteUrl, token, otherData);

        this.id = id;
        this.config = otherData.config;
        this.loggedOut = otherData.loggedOut;
        this.logger = CoreLogger.getInstance('CoreSite');

        this.cacheTable = asyncInstance(() => CoreSites.getSiteTable(WS_CACHE_TABLE, {
            siteId: this.getId(),
            database: this.getDb(),
            config: { cachingStrategy: CoreDatabaseCachingStrategy.None },
        }));

        this.configTable = asyncInstance(() => CoreSites.getSiteTable(CONFIG_TABLE, {
            siteId: this.getId(),
            database: this.getDb(),
            config: { cachingStrategy: CoreDatabaseCachingStrategy.Eager },
            primaryKeyColumns: ['name'],
        }));

        this.lastViewedTable = asyncInstance(() => CoreSites.getSiteTable(LAST_VIEWED_TABLE, {
            siteId: this.getId(),
            database: this.getDb(),
            config: { cachingStrategy: CoreDatabaseCachingStrategy.Eager },
            primaryKeyColumns: ['component', 'id'],
        }));
        this.setInfo(otherData.info);
        this.calculateOfflineDisabled();

        this.db = CoreDB.getDB('Site-' + this.id);
    }

    /**
     * Get site ID.
     *
     * @returns Site ID.
     */
    getId(): string {
        return this.id;
    }

    /**
     * Get site DB.
     *
     * @returns Site DB.
     */
    getDb(): SQLiteDB {
        return this.db;
    }

    /**
     * Check if user logged out from the site and needs to authenticate again.
     *
     * @returns Whether is logged out.
     */
    isLoggedOut(): boolean {
        return !!this.loggedOut;
    }

    /**
     * Get OAuth ID.
     *
     * @returns OAuth ID.
     */
    getOAuthId(): number | undefined {
        return this.oauthId;
    }

    /**
     * Set site config.
     *
     * @param config Config.
     */
    setConfig(config: CoreSiteConfig): void {
        if (config) {
            config.tool_mobile_disabledfeatures = CoreTextUtils.treatDisabledFeatures(config.tool_mobile_disabledfeatures);
        }

        this.config = config;
        this.calculateOfflineDisabled();
    }

    /**
     * Set site logged out.
     *
     * @param loggedOut True if logged out and needs to authenticate again, false otherwise.
     */
    setLoggedOut(loggedOut: boolean): void {
        this.loggedOut = !!loggedOut;
    }

    /**
     * Set OAuth ID.
     *
     * @param oauthId OAuth ID.
     */
    setOAuthId(oauthId: number | undefined): void {
        this.oauthId = oauthId;
    }

    /**
     * Check if the user authenticated in the site using an OAuth method.
     *
     * @returns Whether the user authenticated in the site using an OAuth method.
     */
    isOAuth(): boolean {
        return this.oauthId != null && this.oauthId !== undefined;
    }

    /**
     * @inheritdoc
     */
    protected async getCacheEntryById(id: string): Promise<CoreSiteWSCacheRecord> {
        return this.cacheTable.getOneByPrimaryKey({ id });
    }

    /**
     * @inheritdoc
     */
    protected async getCacheEntriesByKey(key: string): Promise<CoreSiteWSCacheRecord[]> {
        return this.cacheTable.getMany({ key });
    }

    /**
     * @inheritdoc
     */
    protected async storeCacheEntry(entry: CoreSiteWSCacheRecord): Promise<void> {
        await this.cacheTable.insert(entry);
    }

    /**
     * @inheritdoc
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    protected async deleteFromCache(method: string, data: any, preSets: CoreSiteWSPreSets, allCacheKey?: boolean): Promise<void> {
        if (allCacheKey) {
            await this.cacheTable.delete({ key: preSets.cacheKey });
        } else {
            await this.cacheTable.deleteByPrimaryKey({ id: this.getCacheId(method, data) });
        }
    }

    /**
     * Gets the size of cached data for a specific component or component instance.
     *
     * @param component Component name
     * @param componentId Optional component id (if not included, returns sum for whole component)
     * @returns Promise resolved when we have calculated the size
     */
    async getComponentCacheSize(component: string, componentId?: number): Promise<number> {
        const params: Array<string | number> = [component];
        let extraClause = '';
        if (componentId !== undefined && componentId !== null) {
            params.push(componentId);
            extraClause = ' AND componentId = ?';
        }

        return this.cacheTable.reduce(
            {
                sql: 'SUM(length(data))',
                js: (size, record) => size + record.data.length,
                jsInitialValue: 0,
            },
            {
                sql: 'WHERE component = ?' + extraClause,
                sqlParams: params,
                js: record => record.component === component && (params.length === 1 || record.componentId === componentId),
            },
        );
    }

    /**
     * Deletes WS cache entries for all methods relating to a specific component (and
     * optionally component id).
     *
     * @param component Component name.
     * @param componentId Component id.
     * @returns Promise resolved when the entries are deleted.
     */
    async deleteComponentFromCache(component: string, componentId?: number): Promise<void> {
        if (!component) {
            return;
        }

        const params = { component };

        if (componentId) {
            params['componentId'] = componentId;
        }

        await this.cacheTable.delete(params);
    }

    /*
     * Uploads a file using Cordova File API.
     *
     * @param filePath File path.
     * @param options File upload options.
     * @param onProgress Function to call on progress.
     * @returns Promise resolved when uploaded.
     */
    uploadFile(
        filePath: string,
        options: CoreWSFileUploadOptions,
        onProgress?: (event: ProgressEvent) => void,
    ): Promise<CoreWSUploadFileResult> {
        if (!options.fileArea) {
            options.fileArea = 'draft';
        }

        return CoreWS.uploadFile(filePath, options, {
            siteUrl: this.siteUrl,
            wsToken: this.token || '',
        }, onProgress);
    }

    /**
     * Invalidates all caches related to the site.
     */
    async invalidateCaches(): Promise<void> {
        await Promise.all([
            CoreFilepool.invalidateAllFiles(this.getId()),
            this.invalidateWsCache(),
        ]);
    }

    /**
     * @inheritdoc
     */
    async invalidateWsCache(): Promise<void> {
        this.logger.debug('Invalidate all the cache for site: ' + this.id);

        try {
            await this.cacheTable.update({ expirationTime: 0 });
        } finally {
            CoreEvents.trigger(CoreEvents.WS_CACHE_INVALIDATED, {}, this.getId());
        }
    }

    /**
     * @inheritdoc
     */
    async invalidateWsCacheForKey(key: string): Promise<void> {
        if (!key) {
            return;
        }

        this.logger.debug('Invalidate cache for key: ' + key);

        await this.cacheTable.update({ expirationTime: 0 }, { key });
    }

    /**
     * @inheritdoc
     */
    async invalidateWsCacheForKeyStartingWith(key: string): Promise<void> {
        if (!key) {
            return;
        }

        this.logger.debug('Invalidate cache for key starting with: ' + key);

        await this.cacheTable.updateWhere({ expirationTime: 0 }, {
            sql: 'key LIKE ?',
            sqlParams: [key + '%'],
            js: record => !!record.key?.startsWith(key),
        });
    }

    /**
     * Check if tokenpluginfile can be used, and fix the URL afterwards.
     *
     * @param url The url to be fixed.
     * @returns Promise resolved with the fixed URL.
     */
    checkAndFixPluginfileURL(url: string): Promise<string> {
        return this.checkTokenPluginFile(url).then(() => this.fixPluginfileURL(url));
    }

    /**
     * Generic function for adding the wstoken to Moodle urls and for pointing to the correct script.
     * Uses CoreUtilsProvider.fixPluginfileURL, passing site's token.
     *
     * @param url The url to be fixed.
     * @returns Fixed URL.
     */
    fixPluginfileURL(url: string): string {
        const accessKey = this.tokenPluginFileWorks || this.tokenPluginFileWorks === undefined ?
            this.infos && this.infos.userprivateaccesskey : undefined;

        return CoreUrlUtils.fixPluginfileURL(url, this.token || '', this.siteUrl, accessKey);
    }

    /**
     * Deletes site's DB.
     *
     * @returns Promise to be resolved when the DB is deleted.
     */
    async deleteDB(): Promise<void> {
        await CoreDB.deleteDB('Site-' + this.id);
    }

    /**
     * Deletes site's folder.
     *
     * @returns Promise to be resolved when the DB is deleted.
     */
    async deleteFolder(): Promise<void> {
        if (!CoreFile.isAvailable() || !this.id) {
            return;
        }

        const siteFolder = CoreFile.getSiteFolder(this.id);

        // Ignore any errors, removeDir fails if folder doesn't exists.
        await CoreUtils.ignoreErrors(CoreFile.removeDir(siteFolder));
    }

    /**
     * Get space usage of the site.
     *
     * @returns Promise resolved with the site space usage (size).
     */
    getSpaceUsage(): Promise<number> {
        if (CoreFile.isAvailable() && this.id) {
            const siteFolderPath = CoreFile.getSiteFolder(this.id);

            return CoreFile.getDirectorySize(siteFolderPath).catch(() => 0);
        } else {
            return Promise.resolve(0);
        }
    }

    /**
     * Gets an approximation of the cache table usage of the site.
     *
     * Currently this is just the total length of the data fields in the cache table.
     *
     * @returns Promise resolved with the total size of all data in the cache table (bytes)
     */
    async getCacheUsage(): Promise<number> {
        return this.cacheTable.reduce({
            sql: 'SUM(length(data))',
            js: (size, record) => size + record.data.length,
            jsInitialValue: 0,
        });
    }

    /**
     * Gets a total of the file and cache usage.
     *
     * @returns Promise with the total of getSpaceUsage and getCacheUsage
     */
    async getTotalUsage(): Promise<number> {
        const space = await this.getSpaceUsage();
        const cache = await this.getCacheUsage();

        return space + cache;
    }

    /**
     * Check if GET method is supported for AJAX calls.
     *
     * @returns Whether it's supported.
     */
    protected isAjaxGetSupported(): boolean {
        return !!this.getInfo() && this.isVersionGreaterEqualThan('3.8');
    }

    /**
     * Open a URL in browser using auto-login in the Moodle site if available.
     *
     * @param url The URL to open.
     * @param alertMessage If defined, an alert will be shown before opening the browser.
     * @param options Other options.
     * @returns Promise resolved when done, rejected otherwise.
     */
    async openInBrowserWithAutoLogin(
        url: string,
        alertMessage?: string,
        options: CoreUtilsOpenInBrowserOptions = {},
    ): Promise<void> {
        await this.openWithAutoLogin(false, url, options, alertMessage);
    }

    /**
     * Open a URL in browser using auto-login in the Moodle site if available and the URL belongs to the site.
     *
     * @param url The URL to open.
     * @param alertMessage If defined, an alert will be shown before opening the browser.
     * @param options Other options.
     * @returns Promise resolved when done, rejected otherwise.
     * @deprecated since 4.1. Use openInBrowserWithAutoLogin instead, now it always checks that URL belongs to same site.
     */
    async openInBrowserWithAutoLoginIfSameSite(
        url: string,
        alertMessage?: string,
        options: CoreUtilsOpenInBrowserOptions = {},
    ): Promise<void> {
        return this.openInBrowserWithAutoLogin(url, alertMessage, options);
    }

    /**
     * Open a URL in inappbrowser using auto-login in the Moodle site if available.
     *
     * @param url The URL to open.
     * @param options Override default options passed to InAppBrowser.
     * @param alertMessage If defined, an alert will be shown before opening the inappbrowser.
     * @returns Promise resolved when done.
     */
    async openInAppWithAutoLogin(url: string, options?: InAppBrowserOptions, alertMessage?: string): Promise<InAppBrowserObject> {
        const iabInstance = <InAppBrowserObject> await this.openWithAutoLogin(true, url, options, alertMessage);

        return iabInstance;
    }

    /**
     * Open a URL in inappbrowser using auto-login in the Moodle site if available and the URL belongs to the site.
     *
     * @param url The URL to open.
     * @param options Override default options passed to inappbrowser.
     * @param alertMessage If defined, an alert will be shown before opening the inappbrowser.
     * @returns Promise resolved when done.
     * @deprecated since 4.1. Use openInAppWithAutoLogin instead, now it always checks that URL belongs to same site.
     */
    async openInAppWithAutoLoginIfSameSite(
        url: string,
        options?: InAppBrowserOptions,
        alertMessage?: string,
    ): Promise<InAppBrowserObject> {
        return this.openInAppWithAutoLogin(url, options, alertMessage);
    }

    /**
     * Open a URL in browser or InAppBrowser using auto-login in the Moodle site if available.
     *
     * @param inApp True to open it in InAppBrowser, false to open in browser.
     * @param url The URL to open.
     * @param options Override default options passed to $cordovaInAppBrowser#open.
     * @param alertMessage If defined, an alert will be shown before opening the browser/inappbrowser.
     * @returns Promise resolved when done. Resolve param is returned only if inApp=true.
     */
    async openWithAutoLogin(
        inApp: boolean,
        url: string,
        options: InAppBrowserOptions & CoreUtilsOpenInBrowserOptions = {},
        alertMessage?: string,
    ): Promise<InAppBrowserObject | void> {
        // Get the URL to open.
        const autoLoginUrl = await this.getAutoLoginUrl(url);

        if (alertMessage) {
            // Show an alert first.
            const alert = await CoreDomUtils.showAlert(
                Translate.instant('core.notice'),
                alertMessage,
                undefined,
                3000,
            );

            await alert.onDidDismiss();
            options.showBrowserWarning = false; // A warning already shown, no need to show another.
        }

        options.originalUrl = url;

        // Open the URL.
        if (inApp) {
            return CoreUtils.openInApp(autoLoginUrl, options);
        } else {
            return CoreUtils.openInBrowser(autoLoginUrl, options);
        }
    }

    /**
     * Open a URL in browser or InAppBrowser using auto-login in the Moodle site if available and the URL belongs to the site.
     *
     * @param inApp True to open it in InAppBrowser, false to open in browser.
     * @param url The URL to open.
     * @param options Override default options passed to inappbrowser.
     * @param alertMessage If defined, an alert will be shown before opening the browser/inappbrowser.
     * @returns Promise resolved when done. Resolve param is returned only if inApp=true.
     * @deprecated since 4.1. Use openWithAutoLogin instead, now it always checks that URL belongs to same site.
     */
    async openWithAutoLoginIfSameSite(
        inApp: boolean,
        url: string,
        options: InAppBrowserOptions & CoreUtilsOpenInBrowserOptions = {},
        alertMessage?: string,
    ): Promise<InAppBrowserObject | void> {
        return this.openWithAutoLogin(inApp, url, options, alertMessage);
    }

    /**
     * Get the config of this site.
     * It is recommended to use getStoredConfig instead since it's faster and doesn't use network.
     *
     * @param name Name of the setting to get. If not set or false, all settings will be returned.
     * @param ignoreCache True if it should ignore cached data.
     * @returns Promise resolved with site config.
     */
    getConfig(name?: undefined, ignoreCache?: boolean): Promise<CoreSiteConfig>;
    getConfig(name: string, ignoreCache?: boolean): Promise<string>;
    getConfig(name?: string, ignoreCache?: boolean): Promise<string | CoreSiteConfig> {
        return firstValueFrom(
            this.getConfigObservable(<string> name, ignoreCache ? CoreSitesReadingStrategy.ONLY_NETWORK : undefined),
        );
    }

    /**
     * Get the config of this site.
     * It is recommended to use getStoredConfig instead since it's faster and doesn't use network.
     *
     * @param name Name of the setting to get. If not set or false, all settings will be returned.
     * @param readingStrategy Reading strategy.
     * @returns Observable returning site config.
     */
    getConfigObservable(name?: undefined, readingStrategy?: CoreSitesReadingStrategy): WSObservable<CoreSiteConfig>;
    getConfigObservable(name: string, readingStrategy?: CoreSitesReadingStrategy): WSObservable<string>;
    getConfigObservable(name?: string, readingStrategy?: CoreSitesReadingStrategy): WSObservable<string | CoreSiteConfig> {
        const preSets: CoreSiteWSPreSets = {
            cacheKey: this.getConfigCacheKey(),
            ...CoreSites.getReadingStrategyPreSets(readingStrategy),
        };

        return this.readObservable<CoreSiteConfigResponse>('tool_mobile_get_config', {}, preSets).pipe(map(config => {
            if (name) {
                // Return the requested setting.
                for (const x in config.settings) {
                    if (config.settings[x].name == name) {
                        return String(config.settings[x].value);
                    }
                }

                throw new CoreError('Site config not found: ' + name);
            } else {
                // Return all settings in the same array.
                const settings: CoreSiteConfig = {};
                config.settings.forEach((setting) => {
                    settings[setting.name] = String(setting.value);
                });

                return settings;
            }
        }));
    }

    /**
     * Invalidates config WS call.
     *
     * @returns Promise resolved when the data is invalidated.
     */
    async invalidateConfig(): Promise<void> {
        await this.invalidateWsCacheForKey(this.getConfigCacheKey());
    }

    /**
     * Get cache key for getConfig WS calls.
     *
     * @returns Cache key.
     */
    protected getConfigCacheKey(): string {
        return 'tool_mobile_get_config';
    }

    /**
     * Get the stored config of this site.
     *
     * @param name Name of the setting to get. If not set, all settings will be returned.
     * @returns Site config or a specific setting.
     */
    getStoredConfig(): CoreSiteConfig | undefined;
    getStoredConfig(name: string): string | undefined;
    getStoredConfig(name?: string): string | CoreSiteConfig | undefined {
        if (!this.config) {
            return;
        }

        if (name) {
            return this.config[name];
        } else {
            return this.config;
        }
    }

    /**
     * @inheritdoc
     */
    protected getDisabledFeatures(): string | undefined {
        return this.config ? this.getStoredConfig('tool_mobile_disabledfeatures') : super.getDisabledFeatures();
    }

    /**
     * @inheritdoc
     */
    protected triggerSiteEvent<Fallback = unknown, Event extends string = string>(
        eventName: Event,
        data?: CoreEventData<Event, Fallback>,
    ): void {
        CoreEvents.trigger(eventName, data, this.id);
    }

    /**
     * Calculate if offline is disabled in the site.
     */
    calculateOfflineDisabled(): void {
        this.offlineDisabled = this.isFeatureDisabled('NoDelegate_CoreOffline');
    }

    /**
     * Get whether offline is disabled in the site.
     *
     * @returns Whether it's disabled.
     */
    isOfflineDisabled(): boolean {
        return this.offlineDisabled;
    }

    /**
     * Given a URL, convert it to a URL that will auto-login if supported.
     *
     * @param url The URL to convert.
     * @param showModal Whether to show a loading modal.
     * @returns Promise resolved with the converted URL.
     */
    async getAutoLoginUrl(url: string, showModal: boolean = true): Promise<string> {
        if (!this.privateToken) {
            // No private token, don't change the URL.
            return url;
        }

        if (!this.containsUrl(url)) {
            // URL doesn't belong to the site, don't auto login.
            return url;
        }

        if (this.lastAutoLogin > 0) {
            const timeBetweenRequests = await CoreUtils.ignoreErrors(
                this.getConfig('tool_mobile_autologinmintimebetweenreq'),
                CoreConstants.SECONDS_MINUTE * 6,
            );

            if (CoreTimeUtils.timestamp() - this.lastAutoLogin < Number(timeBetweenRequests)) {
                // Not enough time has passed since last auto login.
                return url;
            }
        }

        const userId = this.getUserId();
        const params = {
            privatetoken: this.privateToken,
        };
        let modal: CoreIonLoadingElement | undefined;

        if (showModal) {
            modal = await CoreDomUtils.showModalLoading();
        }

        try {
            // Use write to not use cache.
            const data = await this.write<CoreSiteAutologinKeyResult>('tool_mobile_get_autologin_key', params);

            if (!data.autologinurl || !data.key) {
                // Not valid data, return the same URL.
                return url;
            }

            this.lastAutoLogin = CoreTimeUtils.timestamp();

            return data.autologinurl + '?userid=' + userId + '&key=' + data.key + '&urltogo=' + encodeURIComponent(url);
        } catch (error) {
            // Couldn't get autologin key, return the same URL.
            return url;
        } finally {
            modal?.dismiss();
        }
    }

    /**
     * Deletes a site setting.
     *
     * @param name The config name.
     * @returns Promise resolved when done.
     */
    async deleteSiteConfig(name: string): Promise<void> {
        await this.configTable.deleteByPrimaryKey({ name });
    }

    /**
     * Get a site setting on local device.
     *
     * @param name The config name.
     * @param defaultValue Default value to use if the entry is not found.
     * @returns Resolves upon success along with the config data. Reject on failure.
     */
    async getLocalSiteConfig<T extends number | string>(name: string, defaultValue?: T): Promise<T> {
        try {
            const entry = await this.configTable.getOneByPrimaryKey({ name });

            return <T> entry.value;
        } catch (error) {
            if (defaultValue !== undefined) {
                return defaultValue;
            }

            throw error;
        }
    }

    /**
     * Set a site setting on local device.
     *
     * @param name The config name.
     * @param value The config value. Can only store number or strings.
     * @returns Promise resolved when done.
     */
    async setLocalSiteConfig(name: string, value: number | string): Promise<void> {
        await this.configTable.insert({ name, value });
    }

    /*
     * Check if tokenpluginfile script works in the site.
     *
     * @param url URL to check.
     * @returns Promise resolved with boolean: whether it works or not.
     */
    checkTokenPluginFile(url: string): Promise<boolean> {
        if (!CoreUrlUtils.canUseTokenPluginFile(url, this.siteUrl, this.infos && this.infos.userprivateaccesskey)) {
            // Cannot use tokenpluginfile.
            return Promise.resolve(false);
        } else if (this.tokenPluginFileWorks !== undefined) {
            // Already checked.
            return Promise.resolve(this.tokenPluginFileWorks);
        } else if (this.tokenPluginFileWorksPromise) {
            // Check ongoing, use the same promise.
            return this.tokenPluginFileWorksPromise;
        } else if (!CoreNetwork.isOnline()) {
            // Not online, cannot check it. Assume it's working, but don't save the result.
            return Promise.resolve(true);
        }

        url = this.fixPluginfileURL(url);

        this.tokenPluginFileWorksPromise = CoreWS.urlWorks(url).then((result) => {
            this.tokenPluginFileWorks = result;

            return result;
        });

        return this.tokenPluginFileWorksPromise;
    }

    /**
     * Deletes last viewed records based on some conditions.
     *
     * @param conditions Conditions.
     * @returns Promise resolved when done.
     */
    async deleteLastViewed(conditions?: Partial<CoreSiteLastViewedDBRecord>): Promise<void> {
        await this.lastViewedTable.delete(conditions);
    }

    /**
     * Get a last viewed record for a component+id.
     *
     * @param component The component.
     * @param id ID.
     * @returns Resolves with last viewed record, undefined if not found.
     */
    async getLastViewed(component: string, id: number): Promise<CoreSiteLastViewedDBRecord | undefined> {
        try {
            return await this.lastViewedTable.getOneByPrimaryKey({ component, id });
        } catch {
            // Not found.
        }
    }

    /**
     * Get several last viewed for a certain component.
     *
     * @param component The component.
     * @param ids IDs. If not provided or empty, return all last viewed for a component.
     * @returns Resolves with last viewed records, undefined if error.
     */
    async getComponentLastViewed(component: string, ids: number[] = []): Promise<CoreSiteLastViewedDBRecord[] | undefined> {
        try {
            if (!ids.length) {
                return await this.lastViewedTable.getMany({ component });
            }

            const whereAndParams = SQLiteDB.getInOrEqual(ids);

            whereAndParams.sql = 'id ' + whereAndParams.sql + ' AND component = ?';
            whereAndParams.params.push(component);

            return await this.lastViewedTable.getManyWhere({
                sql: whereAndParams.sql,
                sqlParams: whereAndParams.params,
                js: (record) => record.component === component && ids.includes(record.id),
            });
        } catch {
            // Not found.
        }
    }

    /**
     * Store a last viewed record.
     *
     * @param component The component.
     * @param id ID.
     * @param value Last viewed item value.
     * @param options Options.
     * @returns Promise resolved when done.
     */
    async storeLastViewed(
        component: string,
        id: number,
        value: string | number,
        options: CoreSiteStoreLastViewedOptions = {},
    ): Promise<void> {
        await this.lastViewedTable.insert({
            component,
            id,
            value: String(value),
            data: options.data,
            timeaccess: options.timeaccess ?? Date.now(),
        });
    }

}

/**
 * Optional data to create a site.
 */
export type CoreSiteOptionalData = CoreAuthenticatedSiteOptionalData & {
    info?: CoreSiteInfo;
    config?: CoreSiteConfig;
    loggedOut?: boolean;
};

/**
 * Result of WS tool_mobile_get_config.
 */
export type CoreSiteConfigResponse = {
    settings: { // Settings.
        name: string; // The name of the setting.
        value: string | number; // The value of the setting.
    }[];
    warnings?: CoreWSExternalWarning[];
};

/**
 * Site config indexed by name.
 */
export type CoreSiteConfig = Record<string, string> & {
    supportavailability?: string; // String representation of CoreSiteConfigSupportAvailability.
    searchbanner?: string; // Search banner text.
    searchbannerenable?: string; // Whether search banner is enabled.
};

/**
 * Result of WS tool_mobile_get_autologin_key.
 */
export type CoreSiteAutologinKeyResult = {
    key: string; // Auto-login key for a single usage with time expiration.
    autologinurl: string; // Auto-login URL.
    warnings?: CoreWSExternalWarning[];
};

/**
 * Options for storeLastViewed.
 */
export type CoreSiteStoreLastViewedOptions = {
    data?: string; // Other data.
    timeaccess?: number; // Accessed time. If not set, current time.
};
