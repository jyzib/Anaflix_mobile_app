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

import { Params } from '@angular/router';
import { CoreRoutedItemsManagerSource } from '@classes/items-management/routed-items-manager-source';
import { AddonBadges, AddonBadgesUserBadge } from '../services/badges';

/**
 * Provides a collection of user badges.
 */
export class AddonBadgesUserBadgesSource extends CoreRoutedItemsManagerSource<AddonBadgesUserBadge> {

    readonly COURSE_ID: number;
    readonly USER_ID: number;

    constructor(courseId: number, userId: number) {
        super();

        this.COURSE_ID = courseId;
        this.USER_ID = userId;
    }

    /**
     * @inheritdoc
     */
    getItemPath(badge: AddonBadgesUserBadge): string {
        return badge.uniquehash;
    }

    /**
     * @inheritdoc
     */
    getItemQueryParams(): Params {
        return {
            courseId: this.COURSE_ID,
            userId: this.USER_ID,
        };
    }

    /**
     * @inheritdoc
     */
    protected async loadPageItems(): Promise<{ items: AddonBadgesUserBadge[] }> {
        const badges = await AddonBadges.getUserBadges(this.COURSE_ID, this.USER_ID);

        return { items: badges };
    }

}
