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
import { CoreNavigator } from '@services/navigator';
import { makeSingleton } from '@singletons';
import { CoreTag } from '../tag';

/**
 * Handler to treat links to tag index.
 */
@Injectable({ providedIn: 'root' })
export class CoreTagIndexLinkHandlerService extends CoreContentLinksHandlerBase {

    name = 'CoreTagIndexLinkHandler';
    pattern = /\/tag\/index\.php/;

    /**
     * @inheritdoc
     */
    getActions(
        siteIds: string[],
        url: string,
        params: Record<string, string>,
    ): CoreContentLinksAction[] | Promise<CoreContentLinksAction[]> {
        return [{
            action: (siteId): void => {
                const pageParams = {
                    tagId: parseInt(params.id, 10) || 0,
                    tagName: params.tag || '',
                    collectionId: parseInt(params.tc, 10) || 0,
                    areaId: parseInt(params.ta, 10) || 0,
                    fromContextId: parseInt(params.from, 10) || 0,
                    contextId: parseInt(params.ctx, 10) || 0,
                    recursive: parseInt(params.rec, 10) || 1,
                };

                if (!pageParams.tagId && (!pageParams.tagName || !pageParams.collectionId)) {
                    CoreNavigator.navigateToSitePath('/tag/search', { siteId });
                } else if (pageParams.areaId) {
                    CoreNavigator.navigateToSitePath('/tag/index-area', { params: pageParams, siteId });
                } else {
                    CoreNavigator.navigateToSitePath('/tag/index', { params: pageParams, siteId });
                }
            },
        }];
    }

    /**
     * @inheritdoc
     */
    async isEnabled(siteId: string): Promise<boolean> {
        return CoreTag.areTagsAvailable(siteId);
    }

}

export const CoreTagIndexLinkHandler = makeSingleton(CoreTagIndexLinkHandlerService);
