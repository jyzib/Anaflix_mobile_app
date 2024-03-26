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
import { CoreCourseProvider } from '@features/course/services/course';
import {
    CoreCourseAccess,
    CoreCourseOptionsHandler,
    CoreCourseOptionsHandlerData,
} from '@features/course/services/course-options-delegate';
import { CoreCourseAnyCourseData, CoreCourseUserAdminOrNavOptionIndexed } from '@features/courses/services/courses';
import { PARTICIPANTS_PAGE_NAME } from '@features/user/user.module';
import { makeSingleton } from '@singletons';
import { CoreUser } from '../user';

/**
 * Course nav handler.
 */
@Injectable({ providedIn: 'root' })
export class CoreUserCourseOptionHandlerService implements CoreCourseOptionsHandler {

    name = 'CoreUserParticipants';
    priority = 600;

    /**
     * @inheritdoc
     */
    invalidateEnabledForCourse(courseId: number, navOptions?: CoreCourseUserAdminOrNavOptionIndexed): Promise<void> {
        if (navOptions && navOptions.participants !== undefined) {
            // No need to invalidate anything.
            return Promise.resolve();
        }

        return CoreUser.invalidateParticipantsList(courseId);
    }

    /**
     * @inheritdoc
     */
    isEnabled(): Promise<boolean> {
        return Promise.resolve(true);
    }

    /**
     * @inheritdoc
     */
    isEnabledForCourse(
        courseId: number,
        accessData: CoreCourseAccess,
        navOptions?: CoreCourseUserAdminOrNavOptionIndexed,
    ): boolean | Promise<boolean> {
        if (accessData && accessData.type == CoreCourseProvider.ACCESS_GUEST) {
            return false; // Not enabled for guests.
        }

        if (navOptions && navOptions.participants !== undefined) {
            return navOptions.participants;
        }

        return CoreUser.isPluginEnabledForCourse(courseId);
    }

    /**
     * @inheritdoc
     */
    getDisplayData(): CoreCourseOptionsHandlerData | Promise<CoreCourseOptionsHandlerData> {
        return {
            title: 'core.user.participants',
            class: 'core-user-participants-handler',
            page: PARTICIPANTS_PAGE_NAME,
        };
    }

    /**
     * @inheritdoc
     */
    async prefetch(course: CoreCourseAnyCourseData): Promise<void> {
        let offset = 0;
        let canLoadMore = true;

        do {
            const result = await CoreUser.getParticipants(course.id, offset, undefined, undefined, true);

            offset += result.participants.length;
            canLoadMore = result.canLoadMore;
        } while (canLoadMore);
    }

}

export const CoreUserCourseOptionHandler = makeSingleton(CoreUserCourseOptionHandlerService);
