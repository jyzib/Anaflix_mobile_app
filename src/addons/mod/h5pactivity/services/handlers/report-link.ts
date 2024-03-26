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

import { CoreContentLinksHandlerBase } from '@features/contentlinks/classes/base-handler';
import { CoreContentLinksAction } from '@features/contentlinks/services/contentlinks-delegate';
import { CoreCourse } from '@features/course/services/course';
import { CoreNavigator } from '@services/navigator';
import { CoreSites, CoreSitesReadingStrategy } from '@services/sites';
import { CoreDomUtils } from '@services/utils/dom';
import { CoreUtils } from '@services/utils/utils';
import { makeSingleton } from '@singletons';
import { AddonModH5PActivity } from '../h5pactivity';
import { AddonModH5PActivityModuleHandlerService } from './module';

/**
 * Handler to treat links to H5P activity report.
 */
@Injectable({ providedIn: 'root' })
export class AddonModH5PActivityReportLinkHandlerService extends CoreContentLinksHandlerBase {

    name = 'AddonModH5PActivityReportLinkHandler';
    featureName = 'CoreCourseModuleDelegate_AddonModH5PActivity';
    pattern = /\/mod\/h5pactivity\/report\.php.*([&?]a=\d+)/;

    /**
     * @inheritdoc
     */
    getActions(
        siteIds: string[],
        url: string,
        params: Record<string, string>,
    ): CoreContentLinksAction[] | Promise<CoreContentLinksAction[]> {
        return [{
            action: async (siteId) => {
                const modal = await CoreDomUtils.showModalLoading();

                try {
                    const instanceId = Number(params.a);

                    const module = await CoreCourse.getModuleBasicInfoByInstance(
                        instanceId,
                        'h5pactivity',
                        { siteId, readingStrategy: CoreSitesReadingStrategy.PREFER_CACHE },
                    );

                    if (params.attemptid !== undefined) {
                        this.openAttemptResults(module.id, Number(params.attemptid), module.course, siteId);
                    } else {
                        const userId = params.userid ? Number(params.userid) : undefined;

                        await this.openUserAttempts(module.id, module.course, instanceId, siteId, userId);
                    }
                } catch (error) {
                    CoreDomUtils.showErrorModalDefault(error, 'Error processing link.');
                } finally {
                    modal.dismiss();
                }
            },
        }];
    }

    /**
     * @inheritdoc
     */
    isEnabled(): Promise<boolean> {
        return AddonModH5PActivity.isPluginEnabled();
    }

    /**
     * Open attempt results.
     *
     * @param cmId Module ID.
     * @param attemptId Attempt ID.
     * @param courseId Course ID.
     * @param siteId Site ID.
     */
    protected openAttemptResults(cmId: number, attemptId: number, courseId: number, siteId: string): void {
        const path = AddonModH5PActivityModuleHandlerService.PAGE_NAME + `/${courseId}/${cmId}/attemptresults/${attemptId}`;

        CoreNavigator.navigateToSitePath(path, {
            siteId,
        });
    }

    /**
     * Open user attempts.
     *
     * @param cmId Module ID.
     * @param courseId Course ID.
     * @param id Instance ID.
     * @param siteId Site ID.
     * @param userId User ID. If not defined, current user in site.
     * @returns Promise resolved when done.
     */
    protected async openUserAttempts(cmId: number, courseId: number, id: number, siteId: string, userId?: number): Promise<void> {
        let canViewAllAttempts = false;

        if (!userId) {
            // No user ID specified. Check if current user can view all attempts.
            userId = CoreSites.getCurrentSiteUserId();
            canViewAllAttempts = await AddonModH5PActivity.canGetUsersAttempts(siteId);

            if (canViewAllAttempts) {
                const accessInfo = await CoreUtils.ignoreErrors(AddonModH5PActivity.getAccessInformation(id, {
                    cmId,
                    siteId,
                }));

                canViewAllAttempts = !!accessInfo?.canreviewattempts;
            }
        }

        let path: string;
        if (canViewAllAttempts) {
            path = `${AddonModH5PActivityModuleHandlerService.PAGE_NAME}/${courseId}/${cmId}/users`;
        } else {
            path = `${AddonModH5PActivityModuleHandlerService.PAGE_NAME}/${courseId}/${cmId}/userattempts/${userId}`;
        }

        CoreNavigator.navigateToSitePath(path, {
            siteId,
        });
    }

}

export const AddonModH5PActivityReportLinkHandler = makeSingleton(AddonModH5PActivityReportLinkHandlerService);
