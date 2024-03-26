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

import {
    AddonModWorkshopAssessmentStrategyFieldErrors,
} from '@addons/mod/workshop/components/assessment-strategy/assessment-strategy';
import { AddonWorkshopAssessmentStrategyHandler } from '@addons/mod/workshop/services/assessment-strategy-delegate';
import {
    AddonModWorkshopGetAssessmentFormDefinitionData,
    AddonModWorkshopGetAssessmentFormFieldsParsedData,
} from '@addons/mod/workshop/services/workshop';
import { Injectable, Type } from '@angular/core';
import { makeSingleton, Translate } from '@singletons';
import { CoreFormFields } from '@singletons/form';
import { AddonModWorkshopAssessmentStrategyCommentsComponent } from '../component/comments';
import { AddonModWorkshopAssessmentStrategyCommentsHandlerService } from './handler';

/**
 * Handler for comments assessment strategy plugin.
 */
@Injectable({ providedIn: 'root' })
export class AddonModWorkshopAssessmentStrategyCommentsHandlerLazyService
    extends AddonModWorkshopAssessmentStrategyCommentsHandlerService
    implements AddonWorkshopAssessmentStrategyHandler {

    /**
     * @inheritdoc
     */
    async isEnabled(): Promise<boolean> {
        return true;
    }

    /**
     * @inheritdoc
     */
    getComponent(): Type<unknown> {
        return AddonModWorkshopAssessmentStrategyCommentsComponent;
    }

    /**
     * @inheritdoc
     */
    async getOriginalValues(
        form: AddonModWorkshopGetAssessmentFormDefinitionData,
    ): Promise<AddonModWorkshopGetAssessmentFormFieldsParsedData[]> {
        const originalValues: AddonModWorkshopGetAssessmentFormFieldsParsedData[] = [];

        form.fields.forEach((field, n) => {
            field.dimtitle = Translate.instant('addon.mod_workshop_assessment_comments.dimensionnumber', { $a: field.number });

            if (!form.current[n]) {
                form.current[n] = {};
            }

            originalValues[n] = {};
            originalValues[n].peercomment = form.current[n].peercomment || '';
            originalValues[n].number = field.number; // eslint-disable-line id-blacklist
        });

        return originalValues;
    }

    /**
     * @inheritdoc
     */
    hasDataChanged(
        originalValues: AddonModWorkshopGetAssessmentFormFieldsParsedData[],
        currentValues: AddonModWorkshopGetAssessmentFormFieldsParsedData[],
    ): boolean {
        for (const x in originalValues) {
            if (originalValues[x].peercomment != currentValues[x].peercomment) {
                return true;
            }
        }

        return false;
    }

    /**
     * @inheritdoc
     */
    async prepareAssessmentData(
        currentValues: AddonModWorkshopGetAssessmentFormFieldsParsedData[],
        form: AddonModWorkshopGetAssessmentFormDefinitionData,
    ): Promise<CoreFormFields> {
        const data: CoreFormFields = {};
        const errors: AddonModWorkshopAssessmentStrategyFieldErrors = {};
        let hasErrors = false;

        form.fields.forEach((field, idx) => {
            if (idx < form.dimenssionscount) {
                if (currentValues[idx].peercomment) {
                    data['peercomment__idx_' + idx] = currentValues[idx].peercomment;
                } else {
                    errors['peercomment_' + idx] = Translate.instant('core.err_required');
                    hasErrors = true;
                }

                data['gradeid__idx_' + idx] = parseInt(form.current[idx].gradeid, 10) || 0;
                data['dimensionid__idx_' + idx] = parseInt(field.dimensionid, 10);
            }
        });

        if (hasErrors) {
            throw errors;
        }

        return data;
    }

}
export const AddonModWorkshopAssessmentStrategyCommentsHandler =
    makeSingleton(AddonModWorkshopAssessmentStrategyCommentsHandlerLazyService);
