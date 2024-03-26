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

import { CoreDB } from '@services/db';
import { CoreEventObserver, CoreEvents } from '@singletons/events';
import { SQLiteDB, SQLiteDBTableSchema } from '@classes/sqlitedb';

import { makeSingleton, Keyboard, StatusBar } from '@singletons';
import { CoreLogger } from '@singletons/logger';
import { CoreColors } from '@singletons/colors';
import { DBNAME, SCHEMA_VERSIONS_TABLE_NAME, SCHEMA_VERSIONS_TABLE_SCHEMA, SchemaVersionsDBEntry } from '@services/database/app';
import { CoreObject } from '@singletons/object';
import { CoreRedirectPayload } from './navigator';
import { CoreDatabaseCachingStrategy, CoreDatabaseTableProxy } from '@classes/database/database-table-proxy';
import { asyncInstance } from '../utils/async-instance';
import { CoreDatabaseTable } from '@classes/database/database-table';
import { CorePromisedValue } from '@classes/promised-value';
import { Subscription } from 'rxjs';
import { CorePlatform } from '@services/platform';
import { CoreNetwork, CoreNetworkConnection } from '@services/network';
import { CoreMainMenuProvider } from '@features/mainmenu/services/mainmenu';

/**
 * Factory to provide some global functionalities, like access to the global app database.
 *
 * @description
 * Each service or component should be responsible of creating their own database tables. Example:
 *
 * ```ts
 * constructor(appProvider: CoreAppProvider) {
 *     this.appDB = appProvider.getDB();
 *     this.appDB.createTableFromSchema(this.tableSchema);
 * }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class CoreAppProvider {

    protected db?: SQLiteDB;
    protected logger: CoreLogger;
    protected ssoAuthenticationDeferred?: CorePromisedValue<void>;
    protected isKeyboardShown = false;
    protected keyboardOpening = false;
    protected keyboardClosing = false;
    protected redirect?: CoreRedirectData;
    protected schemaVersionsTable = asyncInstance<CoreDatabaseTable<SchemaVersionsDBEntry, 'name'>>();
    protected mainMenuListener?: CoreEventObserver;

    constructor() {
        this.logger = CoreLogger.getInstance('CoreAppProvider');
        if (CorePlatform.isAndroid()) {
            this.mainMenuListener =
                CoreEvents.on(CoreMainMenuProvider.MAIN_MENU_VISIBILITY_UPDATED, () => this.setAndroidNavigationBarColor());
        }
    }

    /**
     * Returns whether the user agent is controlled by automation. I.e. Behat testing.
     *
     * @returns True if the user agent is controlled by automation, false otherwise.
     */
    static isAutomated(): boolean {
        return !!navigator.webdriver;
    }

    /**
     * Returns the forced timezone to use. Timezone is forced for automated tests.
     *
     * @returns Timezone. Undefined to use the user's timezone.
     */
    static getForcedTimezone(): string | undefined {
        if (CoreAppProvider.isAutomated()) {
            // Use the same timezone forced for LMS in tests.
            return 'Australia/Perth';
        }
    }

    /**
     * Initialize database.
     */
    async initializeDatabase(): Promise<void> {
        const database = this.getDB();

        await database.createTableFromSchema(SCHEMA_VERSIONS_TABLE_SCHEMA);

        const schemaVersionsTable = new CoreDatabaseTableProxy<SchemaVersionsDBEntry, 'name'>(
            { cachingStrategy: CoreDatabaseCachingStrategy.Eager },
            database,
            SCHEMA_VERSIONS_TABLE_NAME,
            ['name'],
        );

        await schemaVersionsTable.initialize();

        this.schemaVersionsTable.setInstance(schemaVersionsTable);
    }

    /**
     * Check if the browser supports mediaDevices.getUserMedia.
     *
     * @returns Whether the function is supported.
     */
    canGetUserMedia(): boolean {
        return !!(navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }

    /**
     * Check if the browser supports MediaRecorder.
     *
     * @returns Whether the function is supported.
     */
    canRecordMedia(): boolean {
        return !!window.MediaRecorder;
    }

    /**
     * Closes the keyboard.
     */
    closeKeyboard(): void {
        if (CorePlatform.isMobile()) {
            Keyboard.hide();
        }
    }

    /**
     * Install and upgrade a certain schema.
     *
     * @param schema The schema to create.
     * @returns Promise resolved when done.
     */
    async createTablesFromSchema(schema: CoreAppSchema): Promise<void> {
        this.logger.debug(`Apply schema to app DB: ${schema.name}`);

        const oldVersion = await this.getInstalledSchemaVersion(schema);

        if (oldVersion >= schema.version) {
            // Version already installed, nothing else to do.
            return;
        }

        this.logger.debug(`Migrating schema '${schema.name}' of app DB from version ${oldVersion} to ${schema.version}`);

        if (schema.tables) {
            await this.getDB().createTablesFromSchema(schema.tables);
        }
        if (schema.install && oldVersion === 0) {
            await schema.install(this.getDB());
        }
        if (schema.migrate && oldVersion > 0) {
            await schema.migrate(this.getDB(), oldVersion);
        }

        // Set installed version.
        await this.schemaVersionsTable.insert({ name: schema.name, version: schema.version });
    }

    /**
     * Delete table schema.
     *
     * @param name Schema name.
     */
    async deleteTableSchema(name: string): Promise<void> {
        await this.schemaVersionsTable.deleteByPrimaryKey({ name });
    }

    /**
     * Get the application global database.
     *
     * @returns App's DB.
     */
    getDB(): SQLiteDB {
        if (!this.db) {
            this.db = CoreDB.getDB(DBNAME);
        }

        return this.db;
    }

    /**
     * Get app store URL.
     *
     * @param storesConfig Config params to send the user to the right place.
     * @returns Store URL.
     */
    getAppStoreUrl(storesConfig: CoreStoreConfig): string | undefined {
        if (CorePlatform.isIOS() && storesConfig.ios) {
            return 'itms-apps://itunes.apple.com/app/' + storesConfig.ios;
        }

        if (CorePlatform.isAndroid() && storesConfig.android) {
            return 'market://details?id=' + storesConfig.android;
        }

        if (CorePlatform.isMobile() && storesConfig.mobile) {
            return storesConfig.mobile;
        }

        return storesConfig.default;
    }

    /**
     * Get platform major version number.
     *
     * @returns The platform major number.
     * @deprecated since 4.1.1. Use CorePlatform.getPlatformMajorVersion instead.
     */
    getPlatformMajorVersion(): number {
        return CorePlatform.getPlatformMajorVersion();
    }

    /**
     * Checks if the app is running in an Android mobile or tablet device.
     *
     * @returns Whether the app is running in an Android mobile or tablet device.
     * @deprecated since 4.1.1. Use CorePlatform.isAndroid instead.
     */
    isAndroid(): boolean {
        return CorePlatform.isAndroid();
    }

    /**
     * Checks if the app is running in an iOS mobile or tablet device.
     *
     * @returns Whether the app is running in an iOS mobile or tablet device.
     * @deprecated since 4.1.1. Use CorePlatform.isIOS instead.
     */
    isIOS(): boolean {
        return CorePlatform.isIOS();
    }

    /**
     * Check if the keyboard is closing.
     *
     * @returns Whether keyboard is closing (animating).
     */
    isKeyboardClosing(): boolean {
        return this.keyboardClosing;
    }

    /**
     * Check if the keyboard is being opened.
     *
     * @returns Whether keyboard is opening (animating).
     */
    isKeyboardOpening(): boolean {
        return this.keyboardOpening;
    }

    /**
     * Check if the keyboard is visible.
     *
     * @returns Whether keyboard is visible.
     */
    isKeyboardVisible(): boolean {
        return this.isKeyboardShown;
    }

    /**
     * Checks if the app is running in a mobile or tablet device (Cordova).
     *
     * @returns Whether the app is running in a mobile or tablet device.
     * @deprecated since 4.1. Use CorePlatform instead.
     */
    isMobile(): boolean {
        return CorePlatform.isMobile();
    }

    /**
     * Checks if the current window is wider than a mobile.
     *
     * @returns Whether the app the current window is wider than a mobile.
     */
    isWide(): boolean {
        return CorePlatform.width() > 768;
    }

    /**
     * Returns whether we are online.
     *
     * @returns Whether the app is online.
     * @deprecated since 4.1. Use CoreNetwork instead.
     */
    isOnline(): boolean {
        return CoreNetwork.isOnline();
    }

    /**
     * Check if device uses a limited connection.
     *
     * @returns Whether the device uses a limited connection.
     * @deprecated since 4.1. Use CoreNetwork instead.
     */
    isNetworkAccessLimited(): boolean {
        return CoreNetwork.isNetworkAccessLimited();
    }

    /**
     * Check if device uses a wifi connection.
     *
     * @returns Whether the device uses a wifi connection.
     * @deprecated since 4.1. Use CoreNetwork instead.
     */
    isWifi(): boolean {
        return CoreNetwork.isWifi();
    }

    /**
     * Open the keyboard.
     */
    openKeyboard(): void {
        // Open keyboard is not supported in desktop and in iOS.
        if (CorePlatform.isAndroid()) {
            Keyboard.show();
        }
    }

    /**
     * Notify that Keyboard has been shown.
     *
     * @param keyboardHeight Keyboard height.
     */
    onKeyboardShow(keyboardHeight: number): void {
        document.body.classList.add('keyboard-is-open');
        this.setKeyboardShown(true);
        // Error on iOS calculating size.
        // More info: https://github.com/ionic-team/ionic-plugin-keyboard/issues/276 .
        CoreEvents.trigger(CoreEvents.KEYBOARD_CHANGE, keyboardHeight);
    }

    /**
     * Notify that Keyboard has been hidden.
     */
    onKeyboardHide(): void {
        document.body.classList.remove('keyboard-is-open');
        this.setKeyboardShown(false);
        CoreEvents.trigger(CoreEvents.KEYBOARD_CHANGE, 0);
    }

    /**
     * Notify that Keyboard is about to be shown.
     */
    onKeyboardWillShow(): void {
        this.keyboardOpening = true;
        this.keyboardClosing = false;
    }

    /**
     * Notify that Keyboard is about to be hidden.
     */
    onKeyboardWillHide(): void {
        this.keyboardOpening = false;
        this.keyboardClosing = true;
    }

    /**
     * Set keyboard shown or hidden.
     *
     * @param shown Whether the keyboard is shown or hidden.
     */
    protected setKeyboardShown(shown: boolean): void {
        this.isKeyboardShown = shown;
        this.keyboardOpening = false;
        this.keyboardClosing = false;
    }

    /**
     * Start an SSO authentication process.
     * Please notice that this function should be called when the app receives the new token from the browser,
     * NOT when the browser is opened.
     */
    startSSOAuthentication(): void {
        this.ssoAuthenticationDeferred = new CorePromisedValue();

        // Resolve it automatically after 10 seconds (it should never take that long).
        const cancelTimeout = setTimeout(() => this.finishSSOAuthentication(), 10000);

        // If the promise is resolved because finishSSOAuthentication is called, stop the cancel promise.
        // eslint-disable-next-line promise/catch-or-return
        this.ssoAuthenticationDeferred.then(() => clearTimeout(cancelTimeout));
    }

    /**
     * Finish an SSO authentication process.
     */
    finishSSOAuthentication(): void {
        if (this.ssoAuthenticationDeferred) {
            this.ssoAuthenticationDeferred.resolve();
            this.ssoAuthenticationDeferred = undefined;
        }
    }

    /**
     * Check if there's an ongoing SSO authentication process.
     *
     * @returns Whether there's a SSO authentication ongoing.
     */
    isSSOAuthenticationOngoing(): boolean {
        return !!this.ssoAuthenticationDeferred;
    }

    /**
     * Returns a promise that will be resolved once SSO authentication finishes.
     *
     * @returns Promise resolved once SSO authentication finishes.
     */
    async waitForSSOAuthentication(): Promise<void> {
        await this.ssoAuthenticationDeferred;
    }

    /**
     * Wait until the application is resumed.
     *
     * @param timeout Maximum time to wait, use null to wait forever.
     */
    async waitForResume(timeout: number | null = null): Promise<void> {
        let deferred: CorePromisedValue<void> | null = new CorePromisedValue();
        let resumeSubscription: Subscription | null = null;
        let timeoutId: number | null = null;

        const stopWaiting = () => {
            if (!deferred) {
                return;
            }

            deferred.resolve();
            resumeSubscription?.unsubscribe();
            timeoutId && clearTimeout(timeoutId);

            deferred = null;
        };

        resumeSubscription = CorePlatform.resume.subscribe(stopWaiting);
        timeoutId = timeout ? window.setTimeout(stopWaiting, timeout) : null;

        await deferred;
    }

    /**
     * Read redirect data from local storage and clear it if it existed.
     */
    consumeStorageRedirect(): void {
        if (!localStorage?.getItem) {
            return;
        }

        try {
            // Read data from storage.
            const jsonData = localStorage.getItem('CoreRedirect');

            if (!jsonData) {
                return;
            }

            // Clear storage.
            localStorage.removeItem('CoreRedirect');

            // Remember redirect data.
            const data: CoreRedirectData = JSON.parse(jsonData);

            if (!CoreObject.isEmpty(data)) {
                this.redirect = data;
            }
        } catch (error) {
            this.logger.error('Error loading redirect data:', error);
        }
    }

    /**
     * Retrieve and forget redirect data.
     *
     * @returns Redirect data if any.
     */
    consumeMemoryRedirect(): CoreRedirectData | null {
        const redirect = this.getRedirect();

        this.forgetRedirect();

        if (redirect && (!redirect.timemodified || Date.now() - redirect.timemodified > 300000)) {
            // Redirect data is only valid for 5 minutes, discard it.
            return null;
        }

        return redirect;
    }

    /**
     * Close the app.
     */
    closeApp(): void {
        const nav = <any> window.navigator; // eslint-disable-line @typescript-eslint/no-explicit-any
        nav.app?.exitApp();
    }

    /**
     * Forget redirect data.
     */
    forgetRedirect(): void {
        delete this.redirect;
    }

    /**
     * Retrieve redirect data.
     *
     * @returns Redirect data if any.
     */
    getRedirect(): CoreRedirectData | null {
        return this.redirect || null;
    }

    /**
     * Store redirect params.
     *
     * @param siteId Site ID.
     * @param redirectData Redirect data.
     */
    storeRedirect(siteId: string, redirectData: CoreRedirectPayload = {}): void {
        if (!redirectData.redirectPath && !redirectData.urlToOpen) {
            return;
        }

        try {
            const redirect: CoreRedirectData = {
                siteId,
                timemodified: Date.now(),
                ...redirectData,
            };

            localStorage.setItem('CoreRedirect', JSON.stringify(redirect));
        } catch {
            // Ignore errors.
        }
    }

    /**
     * Set System UI Colors.
     */
    setSystemUIColors(): void {
        this.setStatusBarColor();
        this.setAndroidNavigationBarColor();
    }

    /**
     * Set StatusBar color depending on platform.
     *
     * @param color RGB color to use as status bar background. If not set the css variable will be read.
     */
    setStatusBarColor(color?: string): void {
        if (!CorePlatform.isMobile()) {
            return;
        }

        if (!color) {
            // Get the default color to change it.
            color = CoreColors.getToolbarBackgroundColor();
        }

        this.logger.debug(`Set status bar color ${color}`);

        StatusBar.backgroundColorByHexString(color);
    }

    /**
     * Set value of forceOffline flag. If true, the app will think the device is offline.
     *
     * @param value Value to set.
     * @deprecated since 4.1. Use CoreNetwork.setForceConnectionMode instead.
     */
    setForceOffline(value: boolean): void {
        CoreNetwork.setForceConnectionMode(value ? CoreNetworkConnection.NONE : CoreNetworkConnection.WIFI);
    }

    /**
     * Get the installed version for the given schema.
     *
     * @param schema App schema.
     * @returns Installed version number, or 0 if the schema is not installed.
     */
    protected async getInstalledSchemaVersion(schema: CoreAppSchema): Promise<number> {
        try {
            // Fetch installed version of the schema.
            const entry = await this.schemaVersionsTable.getOneByPrimaryKey({ name: schema.name });

            return entry.version;
        } catch {
            // No installed version yet.
            return 0;
        }
    }

    /**
     * Set NavigationBar color for Android
     *
     * @param color RGB color to use as background. If not set the css variable will be read.
     */
    protected setAndroidNavigationBarColor(color?: string): void {
        if (!CorePlatform.isAndroid()) {
            return;
        }

        if (!color) {
            // Get the default color to change it.
            color = CoreColors.getBottomPageBackgroundColor();
        }

        this.logger.debug(`Set navigation bar color ${color}`);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (<any> window).StatusBar.navigationBackgroundColorByHexString(color);
    }

}

export const CoreApp = makeSingleton(CoreAppProvider);

/**
 * Data stored for a redirect to another page/site.
 */
export type CoreRedirectData = CoreRedirectPayload & {
    siteId?: string; // ID of the site to load.
    timemodified?: number; // Timestamp when this redirect was last modified.
};

/**
 * Store config data.
 */
export type CoreStoreConfig = {
    /**
     * ID of the Apple store where the mobile iOS app is uploaded.
     */
    ios?: string;

    /**
     * ID of the Google play store where the android app is uploaded.
     */
    android?: string;

    /**
     * Fallback URL when the mobile options is not set.
     */
    mobile?: string;

    /**
     * Fallback URL when the other fallbacks options are not set.
     */
    default?: string;
};

/**
 * App DB schema and migration function.
 */
export type CoreAppSchema = {
    /**
     * Name of the schema.
     */
    name: string;

    /**
     * Latest version of the schema (integer greater than 0).
     */
    version: number;

    /**
     * Tables to create when installing or upgrading the schema.
     */
    tables?: SQLiteDBTableSchema[];

    /**
     * Migrates the schema to the latest version.
     *
     * Called when upgrading the schema, after creating the defined tables.
     *
     * @param db The affected DB.
     * @param oldVersion Old version of the schema or 0 if not installed.
     * @returns Promise resolved when done.
     */
    migrate?(db: SQLiteDB, oldVersion: number): Promise<void>;

    /**
     * Make changes to install the schema.
     *
     * Called when installing the schema, after creating the defined tables.
     *
     * @param db Site database.
     * @returns Promise resolved when done.
     */
    install?(db: SQLiteDB): Promise<void> | void;
};
