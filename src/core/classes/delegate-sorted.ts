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

import { BehaviorSubject, Subject } from 'rxjs';
import { CoreEvents } from '@singletons/events';
import { CoreDelegate, CoreDelegateDisplayHandler, CoreDelegateToDisplay } from './delegate';
import { CoreSites } from '@services/sites';
import { CorePromisedValue } from '@classes/promised-value';

/**
 * Superclass to help creating sorted delegates.
 */
export class CoreSortedDelegate<
    DisplayType extends CoreDelegateToDisplay,
    HandlerType extends CoreDelegateDisplayHandler<DisplayType>>
    extends CoreDelegate<HandlerType> {

    protected loaded = false;
    protected sortedHandlersRxJs: Subject<DisplayType[]> = new BehaviorSubject<DisplayType[]>([]);
    protected sortedHandlers: DisplayType[] = [];

    /**
     * Constructor of the Delegate.
     *
     * @param delegateName Delegate name used for logging purposes.
     */
    constructor(delegateName: string) {
        super(delegateName, true);

        CoreEvents.on(CoreEvents.LOGOUT, () => this.clearSortedHandlers());
        CoreEvents.on(CoreEvents.SITE_POLICY_AGREED, (data) => {
            if (data.siteId === CoreSites.getCurrentSiteId()) {
                // Clear loaded handlers when policy is agreed. The CoreDelegate class will load them again.
                this.clearSortedHandlers();
            }
        });
        // Clear loaded handlers on login, there could be an invalid list loaded when user reconnects after token expired.
        CoreEvents.on(CoreEvents.LOGIN, () => this.clearSortedHandlers());
    }

    /**
     * Check if handlers are loaded.
     *
     * @returns True if handlers are loaded, false otherwise.
     */
    areHandlersLoaded(): boolean {
        return this.loaded;
    }

    /**
     * Clear current site handlers. Reserved for core use.
     */
    protected clearSortedHandlers(): void {
        this.loaded = false;
        this.sortedHandlersRxJs.next([]);
        this.sortedHandlers = [];
    }

    /**
     * Get the handlers for the current site.
     *
     * @returns An observable that will receive the handlers.
     */
    getHandlers(): DisplayType[] {
        return this.sortedHandlers;
    }

    /**
     * Get the handlers for the current site.
     *
     * @returns An observable that will receive the handlers.
     */
    getHandlersObservable(): Subject<DisplayType[]> {
        return this.sortedHandlersRxJs;
    }

    /**
     * Get the handlers for the current site once they're loaded.
     *
     * @returns Promise resolved with the handlers.
     */
    async getHandlersWhenLoaded(): Promise<DisplayType[]> {
        if (this.loaded) {
            return this.sortedHandlers;
        }

        const promisedHandlers = new CorePromisedValue<DisplayType[]>();
        const subscription = this.getHandlersObservable().subscribe((handlers) => {
            if (this.loaded) {
                subscription?.unsubscribe();

                // Return main handlers.
                promisedHandlers.resolve(handlers);
            }
        });

        return promisedHandlers;
    }

    /**
     * Update handlers Data.
     */
    updateData(): void {
        const displayData: DisplayType[] = [];

        for (const name in this.enabledHandlers) {
            const handler = this.enabledHandlers[name];
            const data = <DisplayType> handler.getDisplayData();

            data.priority = data.priority ?? handler.priority ?? 0;
            data.name = handler.name;

            displayData.push(data);
        }

        // Sort them by priority.
        displayData.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

        this.loaded = true;
        this.sortedHandlersRxJs.next(displayData);
        this.sortedHandlers = displayData;
    }

}
