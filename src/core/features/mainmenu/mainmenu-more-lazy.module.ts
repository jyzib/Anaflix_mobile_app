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

import { Injector, NgModule } from '@angular/core';
import { RouterModule, Routes, ROUTES } from '@angular/router';

import { CoreSharedModule } from '@/core/shared.module';
import { buildTabMainRoutes } from '@features/mainmenu/mainmenu-tab-routing.module';
import { CoreMainMenuProvider } from '@features/mainmenu/services/mainmenu';
import { CoreMainMenuComponentsModule } from '@features/mainmenu/components/components.module';
import { CoreMainMenuMorePage } from '@features/mainmenu/pages/more/more';

/**
 * Build module routes.
 *
 * @param injector Injector.
 * @returns Routes.
 */
function buildRoutes(injector: Injector): Routes {
    return buildTabMainRoutes(injector, {
        component: CoreMainMenuMorePage,
        data: {
            mainMenuTabRoot: CoreMainMenuProvider.MORE_PAGE_NAME,
        },
    });
}

@NgModule({
    imports: [
        CoreSharedModule,
        CoreMainMenuComponentsModule,
    ],
    providers: [
        {
            provide: ROUTES,
            multi: true,
            deps: [Injector],
            useFactory: buildRoutes,
        },
    ],
    declarations: [
        CoreMainMenuMorePage,
    ],
    exports: [
        RouterModule,
    ],
})
export class CoreMainMenuMoreLazyModule {}
