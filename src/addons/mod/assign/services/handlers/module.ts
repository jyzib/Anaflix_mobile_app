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

import { CoreConstants, ModPurpose } from '@/core/constants';
import { Injectable, Type } from '@angular/core';
import { CoreCourseModuleHandler } from '@features/course/services/module-delegate';
import { AddonModAssignIndexComponent } from '../../components/index';
import { makeSingleton } from '@singletons';
import { CoreModuleHandlerBase } from '@features/course/classes/module-base-handler';

/**
 * Handler to support assign modules.
 */
@Injectable({ providedIn: 'root' })
export class AddonModAssignModuleHandlerService extends CoreModuleHandlerBase implements CoreCourseModuleHandler {

    static readonly PAGE_NAME = 'mod_assign';

    name = 'AddonModAssign';
    modName = 'assign';
    protected pageName = AddonModAssignModuleHandlerService.PAGE_NAME;

    supportedFeatures = {
        [CoreConstants.FEATURE_GROUPS]: true,
        [CoreConstants.FEATURE_GROUPINGS]: true,
        [CoreConstants.FEATURE_MOD_INTRO]: true,
        [CoreConstants.FEATURE_COMPLETION_TRACKS_VIEWS]: true,
        [CoreConstants.FEATURE_COMPLETION_HAS_RULES]: true,
        [CoreConstants.FEATURE_GRADE_HAS_GRADE]: true,
        [CoreConstants.FEATURE_GRADE_OUTCOMES]: true,
        [CoreConstants.FEATURE_BACKUP_MOODLE2]: true,
        [CoreConstants.FEATURE_SHOW_DESCRIPTION]: true,
        [CoreConstants.FEATURE_ADVANCED_GRADING]: true,
        [CoreConstants.FEATURE_PLAGIARISM]: true,
        [CoreConstants.FEATURE_COMMENT]: true,
        [CoreConstants.FEATURE_MOD_PURPOSE]: ModPurpose.MOD_PURPOSE_ASSESSMENT,
    };

    /**
     * @inheritdoc
     */
    async getMainComponent(): Promise<Type<unknown> | undefined> {
        return AddonModAssignIndexComponent;
    }

}
export const AddonModAssignModuleHandler = makeSingleton(AddonModAssignModuleHandlerService);
