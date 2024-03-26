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
import { CoreCourseComponentsModule } from '@features/course/components/components.module';
import { resolveIndexRoutes } from '@features/course/course-routing.module';
import { CoreCourseSummaryPageModule } from '@features/course/pages/course-summary/course-summary.module';
import { CoreCourseIndexPage } from '@features/course/pages/index';
import { CoreCourseListModTypePage } from '@features/course/pages/list-mod-type/list-mod-type';
import { CoreCourseModulePreviewPage } from '@features/course/pages/module-preview/module-preview';
import { CoreCourseHelper } from './services/course-helper';

export const COURSE_INDEX_PATH = ':courseId';

/**
 * Build module routes.
 *
 * @param injector Injector.
 * @returns Routes.
 */
function buildRoutes(injector: Injector): Routes {
    const indexRoutes = resolveIndexRoutes(injector);

    return [
        {
            path: COURSE_INDEX_PATH,
            children: [
                {
                    path: '',
                    component: CoreCourseIndexPage,
                    data: {
                        isCourseIndex: true,
                    },
                    children: indexRoutes.children,
                },
                ...indexRoutes.siblings,
            ],
        },
        {
            path: ':courseId/:cmId/module-preview',
            component: CoreCourseModulePreviewPage,
        },
        {
            path: ':courseId/list-mod-type',
            component: CoreCourseListModTypePage,
        },
        {
            path: ':courseId/summary',
            loadChildren: () => CoreCourseHelper.getCourseSummaryRouteModule(),
        },
    ];
}

@NgModule({
    declarations: [
        CoreCourseListModTypePage,
        CoreCourseIndexPage,
        CoreCourseModulePreviewPage,
    ],
    imports: [
        CoreSharedModule,
        CoreCourseComponentsModule,
        CoreCourseSummaryPageModule,
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
export class CoreCourseLazyModule {}
