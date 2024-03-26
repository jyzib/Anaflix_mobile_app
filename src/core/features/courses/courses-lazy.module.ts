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

import { CoreSharedModule } from '@/core/shared.module';
import { Injector, NgModule } from '@angular/core';
import { RouterModule, ROUTES, Routes } from '@angular/router';
import { CoreCoursesComponentsModule } from '@features/courses/components/components.module';
import { CoreCoursesCategoriesPage } from '@features/courses/pages/categories/categories';
import { CoreCoursesListPage } from '@features/courses/pages/list/list';
import { CoreMainMenuComponentsModule } from '@features/mainmenu/components/components.module';
import { buildTabMainRoutes } from '@features/mainmenu/mainmenu-tab-routing.module';
import { CoreSearchComponentsModule } from '@features/search/components/components.module';
import { CoreCoursesHelper } from './services/courses-helper';
import { CoreCoursesMyCoursesMainMenuHandlerService } from './services/handlers/my-courses-mainmenu';

/**
 * Build module routes.
 *
 * @param injector Injector.
 * @returns Routes.
 */
function buildRoutes(injector: Injector): Routes {
    return [
        {
            path: 'my',
            data: {
                mainMenuTabRoot: CoreCoursesMyCoursesMainMenuHandlerService.PAGE_NAME,
            },
            loadChildren: () => CoreCoursesHelper.getMyRouteModule(),
        },
        {
            path: 'categories',
            redirectTo: 'categories/root', // Fake "id".
            pathMatch: 'full',
        },
        {
            path: 'categories/:id',
            component: CoreCoursesCategoriesPage,
        },
        {
            path: 'list',
            component: CoreCoursesListPage,
        },
        ...buildTabMainRoutes(injector, {
            redirectTo: 'my',
            pathMatch: 'full',
        }),
    ];
}

@NgModule({
    imports: [
        CoreSharedModule,
        CoreCoursesComponentsModule,
        CoreMainMenuComponentsModule,
        CoreSearchComponentsModule,
    ],
    declarations: [
        CoreCoursesCategoriesPage,
        CoreCoursesListPage,
    ],
    exports: [RouterModule],
    providers: [
        {
            provide: ROUTES,
            multi: true,
            deps: [Injector],
            useFactory: buildRoutes,
        },
    ],
})
export class CoreCoursesLazyModule {}
