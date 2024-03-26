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
import { CoreCourseResourcePrefetchHandlerBase } from '@features/course/classes/resource-prefetch-handler';
import { CoreCourse, CoreCourseAnyModuleData } from '@features/course/services/course';
import { makeSingleton } from '@singletons';
import { AddonModUrlProvider } from '../url';

/**
 * Handler to prefetch URLs. URLs cannot be prefetched, but the handler will be used to invalidate some data on course PTR.
 */
@Injectable({ providedIn: 'root' })
export class AddonModUrlPrefetchHandlerService extends CoreCourseResourcePrefetchHandlerBase {

    name = 'AddonModUrl';
    modName = 'url';
    component = AddonModUrlProvider.COMPONENT;

    /**
     * @inheritdoc
     */
    async download(): Promise<void> {
        return;
    }

    /**
     * @inheritdoc
     */
    invalidateModule(module: CoreCourseAnyModuleData): Promise<void> {
        return CoreCourse.invalidateModule(module.id, undefined, this.modName);
    }

    /**
     * @inheritdoc
     */
    async isDownloadable(): Promise<boolean> {
        return false; // URLs aren't downloadable.
    }

    /**
     * @inheritdoc
     */
    async prefetch(): Promise<void> {
        return;
    }

}
export const AddonModUrlPrefetchHandler = makeSingleton(AddonModUrlPrefetchHandlerService);
