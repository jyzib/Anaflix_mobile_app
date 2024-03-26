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

import { APP_INITIALIZER, NgModule, Type } from '@angular/core';
import { Routes } from '@angular/router';
import { CoreContentLinksDelegate } from '@features/contentlinks/services/contentlinks-delegate';
import { CoreCourseModuleDelegate } from '@features/course/services/module-delegate';
import { CoreCourseModulePrefetchDelegate } from '@features/course/services/module-prefetch-delegate';
import { CoreMainMenuTabRoutingModule } from '@features/mainmenu/mainmenu-tab-routing.module';
import { AddonModLtiComponentsModule } from './components/components.module';
import { AddonModLtiIndexLinkHandler } from './services/handlers/index-link';
import { AddonModLtiListLinkHandler } from './services/handlers/list-link';
import { AddonModLtiModuleHandler, AddonModLtiModuleHandlerService } from './services/handlers/module';
import { AddonModLtiPrefetchHandler } from './services/handlers/prefetch';
import { AddonModLtiProvider } from './services/lti';
import { AddonModLtiHelper, AddonModLtiHelperProvider } from './services/lti-helper';

export const ADDON_MOD_LTI_SERVICES: Type<unknown>[] = [
    AddonModLtiProvider,
    AddonModLtiHelperProvider,
];

const routes: Routes = [
    {
        path: AddonModLtiModuleHandlerService.PAGE_NAME,
        loadChildren: () => import('./lti-lazy.module').then(m => m.AddonModLtiLazyModule),
    },
];

@NgModule({
    imports: [
        CoreMainMenuTabRoutingModule.forChild(routes),
        AddonModLtiComponentsModule,
    ],
    providers: [
        {
            provide: APP_INITIALIZER,
            multi: true,
            useValue: () => {
                CoreCourseModuleDelegate.registerHandler(AddonModLtiModuleHandler.instance);
                CoreContentLinksDelegate.registerHandler(AddonModLtiIndexLinkHandler.instance);
                CoreContentLinksDelegate.registerHandler(AddonModLtiListLinkHandler.instance);
                CoreCourseModulePrefetchDelegate.registerHandler(AddonModLtiPrefetchHandler.instance);

                AddonModLtiHelper.watchPendingCompletions();
            },
        },
    ],
})
export class AddonModLtiModule {}
