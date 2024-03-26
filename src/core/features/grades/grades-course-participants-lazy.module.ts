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

import { conditionalRoutes } from '@/app/app-routing.module';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { CoreUserParticipantsPageModule } from '@features/user/pages/participants/participants.module';
import { CoreUserParticipantsPage } from '@features/user/pages/participants/participants.page';
import { CoreScreen } from '@services/screen';

const routes: Routes = [
    {
        path: '',
        component: CoreUserParticipantsPage,
        children: conditionalRoutes([
            {
                path: ':userId',
                loadChildren: () => import('./grades-course-lazy.module').then(m => m.CoreGradesCourseLazyModule),
                data: { swipeManagerSource: 'participants' },
            },
        ], () => CoreScreen.isTablet),
    },
];

@NgModule({
    imports: [
        RouterModule.forChild(routes),
        CoreUserParticipantsPageModule,
    ],
})
export class CoreGradesCourseParticipantsLazyModule {}
