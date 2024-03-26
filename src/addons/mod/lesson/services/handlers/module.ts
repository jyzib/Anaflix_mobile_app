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

import { CoreConstants, ModPurpose } from '@/core/constants';
import { CoreCourseModuleHandler } from '@features/course/services/module-delegate';
import { AddonModLessonIndexComponent } from '../../components/index';
import { makeSingleton } from '@singletons';
import { CoreModuleHandlerBase } from '@features/course/classes/module-base-handler';

/**
 * Handler to support lesson modules.
 */
@Injectable({ providedIn: 'root' })
export class AddonModLessonModuleHandlerService extends CoreModuleHandlerBase implements CoreCourseModuleHandler {

    static readonly PAGE_NAME = 'mod_lesson';

    name = 'AddonModLesson';
    modName = 'lesson';
    protected pageName = AddonModLessonModuleHandlerService.PAGE_NAME;

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
        [CoreConstants.FEATURE_MOD_PURPOSE]: ModPurpose.MOD_PURPOSE_CONTENT,
    };

    /**
     * @inheritdoc
     */
    async getMainComponent(): Promise<Type<unknown>> {
        return AddonModLessonIndexComponent;
    }

}

export const AddonModLessonModuleHandler = makeSingleton(AddonModLessonModuleHandlerService);
