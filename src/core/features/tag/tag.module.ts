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
import { CoreMainMenuDelegate } from '@features/mainmenu/services/mainmenu-delegate';
import { CoreMainMenuRoutingModule } from '../mainmenu/mainmenu-routing.module';
import { CoreContentLinksDelegate } from '@features/contentlinks/services/contentlinks-delegate';
import { CoreTagMainMenuHandler, CoreTagMainMenuHandlerService } from './services/handlers/mainmenu';
import { CoreTagIndexLinkHandler } from './services/handlers/index-link';
import { CoreTagSearchLinkHandler } from './services/handlers/search-link';
import { CoreTagComponentsModule } from './components/components.module';
import { CoreMainMenuTabRoutingModule } from '@features/mainmenu/mainmenu-tab-routing.module';
import { CoreTagAreaDelegateService } from './services/tag-area-delegate';
import { CoreTagHelperProvider } from './services/tag-helper';
import { CoreTagProvider } from './services/tag';

export const CORE_TAG_SERVICES: Type<unknown>[] = [
    CoreTagAreaDelegateService,
    CoreTagHelperProvider,
    CoreTagProvider,
];

const routes: Routes = [
    {
        path: CoreTagMainMenuHandlerService.PAGE_NAME,
        loadChildren: () => import('./tag-lazy.module').then(m => m.CoreTagLazyModule),
    },
];

@NgModule({
    imports: [
        CoreMainMenuTabRoutingModule.forChild(routes),
        CoreMainMenuRoutingModule.forChild({ children: routes }),
        CoreTagComponentsModule,
    ],
    exports: [CoreMainMenuRoutingModule],
    providers: [
        {
            provide: APP_INITIALIZER,
            multi: true,
            useValue: () => {
                CoreMainMenuDelegate.registerHandler(CoreTagMainMenuHandler.instance);
                CoreContentLinksDelegate.registerHandler(CoreTagIndexLinkHandler.instance);
                CoreContentLinksDelegate.registerHandler(CoreTagSearchLinkHandler.instance);
            },
        },
    ],
})
export class CoreTagModule {}
