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
    AddonCompetencyDataForPlanPageCompetency,
    AddonCompetencyDataForPlanPageWSResponse,
} from '../services/competency';
import { AddonCompetencyHelper } from '../services/competency-helper';

/**
 * Provides a collection of plan competencies.
 */
export class AddonCompetencyPlanCompetenciesSource extends CoreRoutedItemsManagerSource<AddonCompetencyDataForPlanPageCompetency> {

    readonly PLAN_ID: number;

    plan?: AddonCompetencyDataForPlanPageWSResponse;
    user?: CoreUserProfile;

    constructor(planId: number) {
        super();

        this.PLAN_ID = planId;
    }

    /**
     * @inheritdoc
     */
    getItemPath(competency: AddonCompetencyDataForPlanPageCompetency): string {
        return String(competency.competency.id);
    }

    /**
     * @inheritdoc
     */
    async load(): Promise<void> {
        if (this.dirty || !this.plan) {
            await this.loadLearningPlan();
        }

        await super.load();
    }

    /**
     * Invalidate plan cache.
     */
    async invalidateCache(): Promise<void> {
        await CoreUtils.ignoreErrors(AddonCompetency.invalidateLearningPlan(this.PLAN_ID));
    }

    /**
     * @inheritdoc
     */
    protected async loadPageItems(): Promise<{ items: AddonCompetencyDataForPlanPageCompetency[] }> {
        if (!this.plan) {
            throw new Error('Can\'t load competencies without plan!');
        }

        return { items: this.plan.competencies };
    }

    /**
     * Load learning plan.
     */
    private async loadLearningPlan(): Promise<void> {
        this.plan = await AddonCompetency.getLearningPlan(this.PLAN_ID);
        this.plan.plan.statusname = AddonCompetencyHelper.getPlanStatusName(this.plan.plan.status);

        // Get the user profile image.
        this.user = await AddonCompetencyHelper.getProfile(this.plan.plan.userid);
    }

}
