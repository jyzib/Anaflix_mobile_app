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

import { Component, OnInit, ViewChild } from '@angular/core';
import { CoreCourseModuleMainActivityPage } from '@features/course/classes/main-activity-page';
import { CoreNavigator } from '@services/navigator';
import { AddonModWikiIndexComponent } from '../../components/index/index';

/**
 * Page that displays a wiki page.
 */
@Component({
    selector: 'page-addon-mod-wiki-index',
    templateUrl: 'index.html',
})
export class AddonModWikiIndexPage extends CoreCourseModuleMainActivityPage<AddonModWikiIndexComponent> implements OnInit {

    @ViewChild(AddonModWikiIndexComponent) activityComponent?: AddonModWikiIndexComponent;

    action?: string;
    pageId?: number;
    pageTitle?: string;
    subwikiId?: number;
    userId?: number;
    groupId?: number;

    /**
     * @inheritdoc
     */
    ngOnInit(): void {
        super.ngOnInit();

        this.action = CoreNavigator.getRouteParam('action') || 'page';
        this.pageId = CoreNavigator.getRouteNumberParam('pageId');
        this.pageTitle = CoreNavigator.getRouteParam('pageTitle');
        this.subwikiId = CoreNavigator.getRouteNumberParam('subwikiId');
        this.userId = CoreNavigator.getRouteNumberParam('userId');
        this.groupId = CoreNavigator.getRouteNumberParam('groupId');
    }

    /**
     * User entered the page.
     */
    ionViewDidEnter(): void {
        this.activityComponent?.ionViewDidEnter();
    }

    /**
     * User left the page.
     */
    ionViewDidLeave(): void {
        this.activityComponent?.ionViewDidLeave();
    }

}
