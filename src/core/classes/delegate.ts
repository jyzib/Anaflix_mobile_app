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

import { CoreSites } from '@services/sites';
import { CoreEvents } from '@singletons/events';
import { CoreSite } from '@classes/sites/site';
import { CoreLogger } from '@singletons/logger';

/**
 * Superclass to help creating delegates
 */
export class CoreDelegate<HandlerType extends CoreDelegateHandler> {

    /**
     * Logger instance.
     */
    protected logger: CoreLogger;

    /**
     * List of registered handlers.
     */
    protected handlers: { [s: string]: HandlerType } = {};

    /**
     * List of registered handlers enabled for the current site.
     */
    protected enabledHandlers: { [s: string]: HandlerType } = {};

    /**
     * Default handler
     */
    protected defaultHandler?: HandlerType;

    /**
     * Time when last updateHandler functions started.
     */
    protected lastUpdateHandlersStart = 0;

    /**
     * Feature prefix to check is feature is enabled or disabled in site.
     * This check is only made if not false. Override on the subclass or override isFeatureDisabled function.
     */
    protected featurePrefix?: string;

    /**
     * Name of the property to be used to index the handlers. By default, the handler's name will be used.
     * If your delegate uses a Moodle component name to identify the handlers, please override this property.
     * E.g. CoreCourseModuleDelegate uses 'modName' to index the handlers.
     */
    protected handlerNameProperty = 'name';

    /**
     * Set of promises to update a handler, to prevent doing the same operation twice.
     */
    protected updatePromises: {[siteId: string]: {[name: string]: Promise<void>}} = {};

    /**
     * Whether handlers have been initialized.
     */
    protected handlersInitialized = false;

    /**
     * Promise to wait for handlers to be initialized.
     */
    protected handlersInitPromise: Promise<void>;

    /**
     * Function to resolve the handlers init promise.
     */
    protected handlersInitResolve!: () => void;

    /**
     * Constructor of the Delegate.
     *
     * @param delegateName Delegate name used for logging purposes.
     * @param listenSiteEvents Whether to update the handler when a site event occurs (login, site updated, ...).
     */
    constructor(delegateName: string, listenSiteEvents: boolean = true) {
        this.logger = CoreLogger.getInstance(delegateName);

        this.handlersInitPromise = new Promise((resolve): void => {
            this.handlersInitResolve = resolve;
        });

        if (listenSiteEvents) {
            // Update handlers on this cases.
            CoreEvents.on(CoreEvents.LOGIN, () => this.updateHandlers());
            CoreEvents.on(CoreEvents.SITE_UPDATED, () => this.updateHandlers());
            CoreEvents.on(CoreEvents.SITE_PLUGINS_LOADED, () => this.updateHandlers());
            CoreEvents.on(CoreEvents.SITE_POLICY_AGREED, (data) => {
                if (data.siteId === CoreSites.getCurrentSiteId()) {
                    this.updateHandlers();
                }
            });
            CoreEvents.on(CoreEvents.COMPLETE_REQUIRED_PROFILE_DATA_FINISHED, (data) => {
                if (data.siteId === CoreSites.getCurrentSiteId()) {
                    this.updateHandlers();
                }
            });
        }
    }

    /**
     * Execute a certain function in a enabled handler.
     * If the handler isn't found or function isn't defined, call the same function in the default handler.
     *
     * @param handlerName The handler name.
     * @param fnName Name of the function to execute.
     * @param params Parameters to pass to the function.
     * @returns Function returned value or default value.
     */
    protected executeFunctionOnEnabled<T = unknown>(handlerName: string, fnName: string, params?: unknown[]): T | undefined {
        return this.execute<T>(this.enabledHandlers[handlerName], fnName, params);
    }

    /**
     * Execute a certain function in a handler.
     * If the handler isn't found or function isn't defined, call the same function in the default handler.
     *
     * @param handlerName The handler name.
     * @param fnName Name of the function to execute.
     * @param params Parameters to pass to the function.
     * @returns Function returned value or default value.
     */
    protected executeFunction<T = unknown>(handlerName: string, fnName: string, params?: unknown[]): T | undefined {
        return this.execute<T>(this.handlers[handlerName], fnName, params);
    }

    /**
     * Execute a certain function in a handler.
     * If the handler isn't found or function isn't defined, call the same function in the default handler.
     *
     * @param handler The handler.
     * @param fnName Name of the function to execute.
     * @param params Parameters to pass to the function.
     * @returns Function returned value or default value.
     */
    private execute<T = unknown>(handler: HandlerType, fnName: string, params?: unknown[]): T | undefined {
        if (handler && handler[fnName]) {
            return handler[fnName].apply(handler, params);
        } else if (this.defaultHandler && this.defaultHandler[fnName]) {
            return this.defaultHandler[fnName].apply(this.defaultHandler, params);
        }
    }

    /**
     * Get a handler.
     *
     * @param handlerName The handler name.
     * @param enabled Only enabled, or any.
     * @returns Handler.
     */
    protected getHandler(handlerName: string, enabled: boolean = false): HandlerType {
        return enabled ? this.enabledHandlers[handlerName] : this.handlers[handlerName];
    }

    /**
     * Gets the handler full name for a given name. This is useful when the handlerNameProperty is different than "name".
     * E.g. blocks are indexed by blockName. If you call this function passing the blockName it will return the name.
     *
     * @param name Name used to indentify the handler.
     * @returns Full name of corresponding handler.
     */
    getHandlerName(name: string): string {
        const handler = this.getHandler(name, true);

        if (!handler) {
            return '';
        }

        return handler.name;
    }

    /**
     * Check if function exists on a handler.
     *
     * @param handlerName The handler name.
     * @param fnName Name of the function to execute.
     * @param onlyEnabled If check only enabled handlers or all.
     * @returns Function returned value or default value.
     */
    protected hasFunction(handlerName: string, fnName: string, onlyEnabled: boolean = true): boolean {
        const handler = onlyEnabled ? this.enabledHandlers[handlerName] : this.handlers[handlerName];

        return handler && typeof handler[fnName] == 'function';
    }

    /**
     * Check if a handler name has a registered handler (not necessarily enabled).
     *
     * @param name The handler name.
     * @param enabled Only enabled, or any.
     * @returns If the handler is registered or not.
     */
    hasHandler(name: string, enabled: boolean = false): boolean {
        return enabled ? this.enabledHandlers[name] !== undefined : this.handlers[name] !== undefined;
    }

    /**
     * Check if the delegate has at least 1 registered handler (not necessarily enabled).
     *
     * @returns If there is at least 1 handler.
     */
    hasHandlers(): boolean {
        return Object.keys(this.handlers).length > 0;
    }

    /**
     * Check if a time belongs to the last update handlers call.
     * This is to handle the cases where updateHandlers don't finish in the same order as they're called.
     *
     * @param time Time to check.
     * @returns Whether it's the last call.
     */
    isLastUpdateCall(time: number): boolean {
        if (!this.lastUpdateHandlersStart) {
            return true;
        }

        return time == this.lastUpdateHandlersStart;
    }

    /**
     * Register a handler.
     *
     * @param handler The handler delegate object to register.
     * @returns True when registered, false if already registered.
     */
    registerHandler(handler: HandlerType): boolean {
        const key = handler[this.handlerNameProperty] || handler.name;

        if (this.handlers[key] !== undefined) {
            this.logger.log(`Handler '${handler[this.handlerNameProperty]}' already registered`);

            return false;
        }

        this.logger.log(`Registered handler '${handler[this.handlerNameProperty]}'`);
        this.handlers[key] = handler;

        return true;
    }

    /**
     * Update the handler for the current site.
     *
     * @param handler The handler to check.
     * @returns Resolved when done.
     */
    protected updateHandler(handler: HandlerType): Promise<void> {
        const siteId = CoreSites.getCurrentSiteId();
        const currentSite = CoreSites.getCurrentSite();
        let promise: Promise<boolean>;

        if (this.updatePromises[siteId] && this.updatePromises[siteId][handler.name] !== undefined) {
            // There's already an update ongoing for this handler, return the promise.
            return this.updatePromises[siteId][handler.name];
        } else if (!this.updatePromises[siteId]) {
            this.updatePromises[siteId] = {};
        }

        if (!currentSite || this.isFeatureDisabled(handler, currentSite)) {
            promise = Promise.resolve(false);
        } else {
            promise = Promise.resolve(handler.isEnabled()).catch(() => false);
        }

        // Checks if the handler is enabled.
        this.updatePromises[siteId][handler.name] = promise.then((enabled: boolean) => {
            // Check that site hasn't changed since the check started.
            if (CoreSites.getCurrentSiteId() === siteId) {
                const key = handler[this.handlerNameProperty] || handler.name;

                if (enabled) {
                    this.enabledHandlers[key] = handler;
                } else {
                    delete this.enabledHandlers[key];
                }
            }

            return;
        }).finally(() => {
            // Update finished, delete the promise.
            delete this.updatePromises[siteId][handler.name];
        });

        return this.updatePromises[siteId][handler.name];
    }

    /**
     * Check if feature is enabled or disabled in the site, depending on the feature prefix and the handler name.
     *
     * @param handler Handler to check.
     * @param site Site to check.
     * @returns Whether is enabled or disabled in site.
     */
    protected isFeatureDisabled(handler: HandlerType, site: CoreSite): boolean {
        return this.featurePrefix !== undefined && site.isFeatureDisabled(this.featurePrefix + handler.name);
    }

    /**
     * Update the handlers for the current site.
     *
     * @returns Resolved when done.
     */
    async updateHandlers(): Promise<void> {
        const promises: Promise<void>[] = [];
        const now = Date.now();

        this.logger.debug('Updating handlers for current site.');

        this.lastUpdateHandlersStart = now;

        // Loop over all the handlers.
        for (const name in this.handlers) {
            promises.push(this.updateHandler(this.handlers[name]));
        }

        try {
            await Promise.all(promises);
        } catch (e) {
            // Never reject
        }

        // Verify that this call is the last one that was started.
        if (this.isLastUpdateCall(now)) {
            this.handlersInitialized = true;
            this.handlersInitResolve();

            this.updateData();
        }
    }

    /**
     * Update handlers Data.
     * Override this function to update handlers data.
     */
    updateData(): void {
        // To be overridden.
    }

}

/**
 * Base interface for any delegate.
 */
export interface CoreDelegateHandler {
    /**
     * Name of the handler, or name and sub context (AddonMessages, AddonMessages:blockContact, ...).
     * This name will be used to check if the feature is disabled.
     */
    name: string;

    /**
     * Whether or not the handler is enabled on a site level.
     *
     * @returns Whether or not the handler is enabled on a site level.
     */
    isEnabled(): Promise<boolean>;
}

/**
 * Data returned by the delegate for each handler to be displayed.
 */
export interface CoreDelegateToDisplay {
    /**
     * Name of the handler.
     */
    name?: string;

    /**
     * Priority of the handler.
     */
    priority?: number;
}

/**
 * Base interface for a core delegate needed to be displayed.
 */
export interface CoreDelegateDisplayHandler<HandlerData extends CoreDelegateToDisplay> extends CoreDelegateHandler {
    /**
     * The highest priority is displayed first.
     */
    priority?: number;

    /**
     * Returns the data needed to render the handler.
     *
     * @returns Data.
     */
    getDisplayData(): HandlerData;
}
