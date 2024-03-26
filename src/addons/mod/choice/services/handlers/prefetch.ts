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
import { CoreCourseActivityPrefetchHandlerBase } from '@features/course/classes/activity-prefetch-handler';
import { CoreCourseAnyModuleData, CoreCourseCommonModWSOptions } from '@features/course/services/course';
import { CoreUser } from '@features/user/services/user';
import { CoreFilepool } from '@services/filepool';
import { CoreSitesReadingStrategy } from '@services/sites';
import { CoreUtils } from '@services/utils/utils';
import { CoreWSFile } from '@services/ws';
import { makeSingleton } from '@singletons';
import { AddonModChoice, AddonModChoiceProvider } from '../choice';
import { AddonModChoiceSync, AddonModChoiceSyncResult } from '../choice-sync';

/**
 * Handler to prefetch choices.
 */
@Injectable({ providedIn: 'root' })
export class AddonModChoicePrefetchHandlerService extends CoreCourseActivityPrefetchHandlerBase {

    name = 'AddonModChoice';
    modName = 'choice';
    component = AddonModChoiceProvider.COMPONENT;
    updatesNames = /^configuration$|^.*files$|^answers$/;

    /**
     * @inheritdoc
     */
    prefetch(module: CoreCourseAnyModuleData, courseId: number, single?: boolean): Promise<void> {
        return this.prefetchPackage(module, courseId, (siteId) => this.prefetchChoice(module, courseId, !!single, siteId));
    }

    /**
     * Prefetch a choice.
     *
     * @param module Module.
     * @param courseId Course ID the module belongs to.
     * @param single True if we're downloading a single module, false if we're downloading a whole section.
     * @param siteId Site ID.
     * @returns Promise resolved when done.
     */
    protected async prefetchChoice(
        module: CoreCourseAnyModuleData,
        courseId: number,
        single: boolean,
        siteId: string,
    ): Promise<void> {
        const commonOptions = {
            readingStrategy: CoreSitesReadingStrategy.ONLY_NETWORK,
            siteId,
        };
        const modOptions = {
            cmId: module.id,
            ...commonOptions, // Include all common options.
        };

        const choice = await AddonModChoice.getChoice(courseId, module.id, commonOptions);

        // Get the intro files.
        const introFiles = this.getIntroFilesFromInstance(module, choice);

        await Promise.all([
            AddonModChoice.getOptions(choice.id, modOptions),
            this.prefetchResults(choice.id, courseId, modOptions),
            CoreFilepool.addFilesToQueue(siteId, introFiles, AddonModChoiceProvider.COMPONENT, module.id),
        ]);
    }

    /**
     * Prefetch choice results.
     *
     * @param choiceId Choice Id.
     * @param courseId Course Id.
     * @param modOptions Options.
     * @returns Promise resolved when done.
     */
    protected async prefetchResults(
        choiceId: number,
        courseId: number,
        modOptions: CoreCourseCommonModWSOptions,
    ): Promise<void> {
        const options = await AddonModChoice.getResults(choiceId, modOptions);

        // If we can see the users that answered, prefetch their profile and avatar.
        const promises: Promise<unknown>[] = [];

        options.forEach((option) => {
            option.userresponses.forEach((response) => {
                if (response.userid) {
                    promises.push(CoreUser.getProfile(response.userid, courseId, false, modOptions.siteId));
                }
                if (response.profileimageurl) {
                    promises.push(CoreFilepool.addToQueueByUrl(modOptions.siteId!, response.profileimageurl).catch(() => {
                        // Ignore failures.
                    }));
                }
            });
        });

        await Promise.all(promises);
    }

    /**
     * @inheritdoc
     */
    async getIntroFiles(module: CoreCourseAnyModuleData, courseId: number): Promise<CoreWSFile[]> {
        const choice = await CoreUtils.ignoreErrors(AddonModChoice.getChoice(courseId, module.id));

        return this.getIntroFilesFromInstance(module, choice);
    }

    /**
     * @inheritdoc
     */
    invalidateContent(moduleId: number, courseId: number): Promise<void> {
        return AddonModChoice.invalidateContent(moduleId, courseId);
    }

    /**
     * Invalidate WS calls needed to determine module status.
     *
     * @param module Module.
     * @param courseId Course ID the module belongs to.
     * @returns Promise resolved when invalidated.
     */
    invalidateModule(module: CoreCourseAnyModuleData, courseId: number): Promise<void> {
        return AddonModChoice.invalidateChoiceData(courseId);
    }

    /**
     * Sync a module.
     *
     * @param module Module.
     * @param courseId Course ID the module belongs to
     * @param siteId Site ID. If not defined, current site.
     * @returns Promise resolved when done.
     */
    sync(module: CoreCourseAnyModuleData, courseId: number, siteId?: string): Promise<AddonModChoiceSyncResult> {
        return AddonModChoiceSync.syncChoice(module.instance, undefined, siteId);
    }

}

export const AddonModChoicePrefetchHandler = makeSingleton(AddonModChoicePrefetchHandlerService);
