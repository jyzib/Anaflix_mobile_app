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

import { Injectable, Type } from '@angular/core';

import { AddonModQuizAccessRuleHandler } from '@addons/mod/quiz/services/access-rules-delegate';
import { makeSingleton } from '@singletons';
import { AddonModQuizAttemptWSData, AddonModQuizQuizWSData } from '@addons/mod/quiz/services/quiz';
import { CoreSites } from '@services/sites';
import { AddonModQuizAccessPasswordDBRecord, PASSWORD_TABLE_NAME } from '../database/password';
import { AddonModQuizAccessPasswordComponent } from '../../component/password';
import { CoreUtils } from '@services/utils/utils';

/**
 * Handler to support password access rule.
 */
@Injectable({ providedIn: 'root' })
export class AddonModQuizAccessPasswordHandlerService implements AddonModQuizAccessRuleHandler {

    name = 'AddonModQuizAccessPassword';
    ruleName = 'quizaccess_password';

    /**
     * Add preflight data that doesn't require user interaction. The data should be added to the preflightData param.
     *
     * @param quiz The quiz the rule belongs to.
     * @param preflightData Object where to add the preflight data.
     * @param attempt The attempt started/continued. If not supplied, user is starting a new attempt.
     * @param prefetch Whether the user is prefetching the quiz.
     * @param siteId Site ID. If not defined, current site.
     * @returns Promise resolved when done if async, void if it's synchronous.
     */
    async getFixedPreflightData(
        quiz: AddonModQuizQuizWSData,
        preflightData: Record<string, string>,
        attempt?: AddonModQuizAttemptWSData,
        prefetch?: boolean,
        siteId?: string,
    ): Promise<void> {
        if (preflightData.quizpassword !== undefined) {
            return;
        }

        try {
            // Try to get a password stored. If it's found, use it.
            const entry = await this.getPasswordEntry(quiz.id, siteId);

            preflightData.quizpassword = entry.password;
        } catch {
            // No password stored.
        }
    }

    /**
     * Get a password stored in DB.
     *
     * @param quizId Quiz ID.
     * @param siteId Site ID. If not defined, current site.
     * @returns Promise resolved with the DB entry on success.
     */
    protected async getPasswordEntry(quizId: number, siteId?: string): Promise<AddonModQuizAccessPasswordDBRecord> {
        const site = await CoreSites.getSite(siteId);

        return site.getDb().getRecord(PASSWORD_TABLE_NAME, { id: quizId });
    }

    /**
     * Return the Component to use to display the access rule preflight.
     * Implement this if your access rule requires a preflight check with user interaction.
     * It's recommended to return the class of the component, but you can also return an instance of the component.
     *
     * @returns The component (or promise resolved with component) to use, undefined if not found.
     */
    getPreflightComponent(): Type<unknown> | Promise<Type<unknown>> {
        return AddonModQuizAccessPasswordComponent;
    }

    /**
     * Whether or not the handler is enabled on a site level.
     *
     * @returns True or promise resolved with true if enabled.
     */
    async isEnabled(): Promise<boolean> {
        return true;
    }

    /**
     * Whether the rule requires a preflight check when prefetch/start/continue an attempt.
     *
     * @param quiz The quiz the rule belongs to.
     * @param attempt The attempt started/continued. If not supplied, user is starting a new attempt.
     * @param prefetch Whether the user is prefetching the quiz.
     * @param siteId Site ID. If not defined, current site.
     * @returns Whether the rule requires a preflight check.
     */
    async isPreflightCheckRequired(
        quiz: AddonModQuizQuizWSData,
        attempt?: AddonModQuizAttemptWSData,
        prefetch?: boolean,
        siteId?: string,
    ): Promise<boolean> {
        // If there's a password stored don't require the preflight since we'll use the stored one.
        const entry = await CoreUtils.ignoreErrors(this.getPasswordEntry(quiz.id, siteId));

        return !entry;
    }

    /**
     * Function called when the preflight check has passed. This is a chance to record that fact in some way.
     *
     * @param quiz The quiz the rule belongs to.
     * @param attempt The attempt started/continued.
     * @param preflightData Preflight data gathered.
     * @param prefetch Whether the user is prefetching the quiz.
     * @param siteId Site ID. If not defined, current site.
     * @returns Promise resolved when done if async, void if it's synchronous.
     */
    async notifyPreflightCheckPassed(
        quiz: AddonModQuizQuizWSData,
        attempt: AddonModQuizAttemptWSData | undefined,
        preflightData: Record<string, string>,
        prefetch?: boolean,
        siteId?: string,
    ): Promise<void> {
        // The password is right, store it to use it automatically in following executions.
        if (preflightData.quizpassword !== undefined) {
            return this.storePassword(quiz.id, preflightData.quizpassword, siteId);
        }
    }

    /**
     * Function called when the preflight check fails. This is a chance to record that fact in some way.
     *
     * @param quiz The quiz the rule belongs to.
     * @param attempt The attempt started/continued.
     * @param preflightData Preflight data gathered.
     * @param prefetch Whether the user is prefetching the quiz.
     * @param siteId Site ID. If not defined, current site.
     * @returns Promise resolved when done if async, void if it's synchronous.
     */
    notifyPreflightCheckFailed?(
        quiz: AddonModQuizQuizWSData,
        attempt: AddonModQuizAttemptWSData | undefined,
        preflightData: Record<string, string>,
        prefetch?: boolean,
        siteId?: string,
    ): Promise<void> {
        // The password is wrong, remove it from DB if it's there.
        return this.removePassword(quiz.id, siteId);
    }

    /**
     * Remove a password from DB.
     *
     * @param quizId Quiz ID.
     * @param siteId Site ID. If not defined, current site.
     * @returns Promise resolved when done.
     */
    protected async removePassword(quizId: number, siteId?: string): Promise<void> {
        const site = await CoreSites.getSite(siteId);

        await site.getDb().deleteRecords(PASSWORD_TABLE_NAME, { id: quizId });
    }

    /**
     * Store a password in DB.
     *
     * @param quizId Quiz ID.
     * @param password Password.
     * @param siteId Site ID. If not defined, current site.
     * @returns Promise resolved when done.
     */
    protected async storePassword(quizId: number, password: string, siteId?: string): Promise<void> {
        const site = await CoreSites.getSite(siteId);

        const entry: AddonModQuizAccessPasswordDBRecord = {
            id: quizId,
            password,
            timemodified: Date.now(),
        };

        await site.getDb().insertRecord(PASSWORD_TABLE_NAME, entry);
    }

}

export const AddonModQuizAccessPasswordHandler = makeSingleton(AddonModQuizAccessPasswordHandlerService);
