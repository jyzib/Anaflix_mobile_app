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
import { CorePluginFileDelegate } from '@services/plugin-file-delegate';
import { AddonModImscpComponentsModule } from './components/components.module';
import { AddonModImscpIndexLinkHandler } from './services/handlers/index-link';
import { AddonModImscpListLinkHandler } from './services/handlers/list-link';
import { AddonModImscpModuleHandler, AddonModImscpModuleHandlerService } from './services/handlers/module';
import { AddonModImscpPluginFileHandler } from './services/handlers/pluginfile';
import { AddonModImscpPrefetchHandler } from './services/handlers/prefetch';
import { AddonModImscpProvider } from './services/imscp';

export const ADDON_MOD_IMSCP_SERVICES: Type<unknown>[] = [
    AddonModImscpProvider,
];

const routes: Routes = [
    {
        path: AddonModImscpModuleHandlerService.PAGE_NAME,
        loadChildren: () => import('./imscp-lazy.module').then(m => m.AddonModImscpLazyModule),
    },
];

@NgModule({
    imports: [
        CoreMainMenuTabRoutingModule.forChild(routes),
        AddonModImscpComponentsModule,
    ],
    providers: [
        {
            provide: APP_INITIALIZER,
            multi: true,
            useValue: () => {
                CoreCourseModuleDelegate.registerHandler(AddonModImscpModuleHandler.instance);
                CoreContentLinksDelegate.registerHandler(AddonModImscpIndexLinkHandler.instance);
                CoreContentLinksDelegate.registerHandler(AddonModImscpListLinkHandler.instance);
                CoreCourseModulePrefetchDelegate.registerHandler(AddonModImscpPrefetchHandler.instance);
                CorePluginFileDelegate.registerHandler(AddonModImscpPluginFileHandler.instance);
            },
        },
    ],
})
export class AddonModImscpModule {}
