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
import { CoreCourse } from '@features/course/services/course';
import { CoreTagFeedComponent } from '@features/tag/components/feed/feed';
import { CoreTagAreaHandler } from '@features/tag/services/tag-area-delegate';
import { CoreTagFeedElement, CoreTagHelper } from '@features/tag/services/tag-helper';
import { CoreSitesReadingStrategy } from '@services/sites';
import { CoreUrlUtils } from '@services/utils/url';
import { makeSingleton } from '@singletons';
import { AddonModBook } from '../book';

/**
 * Handler to support tags.
 */
@Injectable({ providedIn: 'root' })
export class AddonModBookTagAreaHandlerService implements CoreTagAreaHandler {

    name = 'AddonModBookTagAreaHandler';
    type = 'mod_book/book_chapters';

    /**
     * Whether or not the handler is enabled on a site level.
     *
     * @returns Whether or not the handler is enabled on a site level.
     */
    isEnabled(): Promise<boolean> {
        return AddonModBook.isPluginEnabled();
    }

    /**
     * Parses the rendered content of a tag index and returns the items.
     *
     * @param content Rendered content.
     * @returns Area items (or promise resolved with the items).
     */
    async parseContent(content: string): Promise<CoreTagFeedElement[]> {
        const items = CoreTagHelper.parseFeedContent(content);

        // Find module ids of the returned books, they are needed by the link delegate.
        await Promise.all(items.map(async (item) => {
            const params = item.url ? CoreUrlUtils.extractUrlParams(item.url) : {};
            if (params.b && !params.id) {
                const bookId = parseInt(params.b, 10);

                const module = await CoreCourse.getModuleBasicInfoByInstance(
                    bookId,
                    'book',
                    { readingStrategy: CoreSitesReadingStrategy.PREFER_CACHE },
                );
                item.url += '&id=' + module.id;
            }
        }));

        return items;
    }

    /**
     * Get the component to use to display items.
     *
     * @returns The component (or promise resolved with component) to use, undefined if not found.
     */
    getComponent(): Type<unknown> | Promise<Type<unknown>> {
        return CoreTagFeedComponent;
    }

}

export const AddonModBookTagAreaHandler = makeSingleton(AddonModBookTagAreaHandlerService);
