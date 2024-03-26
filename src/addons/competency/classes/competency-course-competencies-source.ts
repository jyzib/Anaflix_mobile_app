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

import { CoreRoutedItemsManagerSource } from '@classes/items-management/routed-items-manager-source';
import { CoreUserProfile } from '@features/user/services/user';
import { CoreUtils } from '@services/utils/utils';
import {
    AddonCompetency,
    AddonCompetencyDataForCourseCompetenciesPageCompetency,
    AddonCompetencyDataForCourseCompetenciesPageWSResponse,
} from '../services/competency';
import { AddonCompetencyHelper } from '../services/competency-helper';

/**
 * Provides a collection of course competencies.
 */
export class AddonCompetencyCourseCompetenciesSource
    extends CoreRoutedItemsManagerSource<AddonCompetencyDataForCourseCompetenciesPageCompetency> {

    /**
     * @inheritdoc
     */
    static getSourceId(courseId: number, userId?: number): string {
        return `${courseId}-${userId || 'current-user'}`;
    }

    readonly COURSE_ID: number;
    readonly USER_ID?: number;

    courseCompetencies?: AddonCompetencyDataForCourseCompetenciesPageWSResponse;
    user?: CoreUserProfile;

    constructor(courseId: number, userId?: number) {
        super();

        this.COURSE_ID = courseId;
        this.USER_ID = userId;
    }

    /**
     * @inheritdoc
     */
    getItemPath(competency: AddonCompetencyDataForCourseCompetenciesPageCompetency): string {
        return String(competency.competency.id);
    }

    /**
     * @inheritdoc
     */
    async load(): Promise<void> {
        if (this.dirty || !this.courseCompetencies) {
            await this.loadCourseCompetencies();
        }

        await super.load();
    }

    /**
     * Invalidate course cache.
     */
    async invalidateCache(): Promise<void> {
        await CoreUtils.ignoreErrors(AddonCompetency.invalidateCourseCompetencies(this.COURSE_ID, this.USER_ID));
    }

    /**
     * @inheritdoc
     */
    protected async loadPageItems(): Promise<{ items: AddonCompetencyDataForCourseCompetenciesPageCompetency[] }> {
        if (!this.courseCompetencies) {
            throw new Error('Can\'t load competencies without course data');
        }

        return { items: this.courseCompetencies.competencies };
    }

    /**
     * Load competencies.
     */
    private async loadCourseCompetencies(): Promise<void> {
        [this.courseCompetencies, this.user] = await Promise.all([
            AddonCompetency.getCourseCompetencies(this.COURSE_ID, this.USER_ID),
            AddonCompetencyHelper.getProfile(this.USER_ID),
        ]);
    }

}
