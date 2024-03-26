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
import { CoreMainMenuTabRoutingModule } from '@features/mainmenu/mainmenu-tab-routing.module';
import { CoreCronDelegate } from '@services/cron';
import { CORE_SITE_SCHEMAS } from '@services/sites';
import { CoreCommentsComponentsModule } from './components/components.module';
import { CoreComments, CoreCommentsProvider } from './services/comments';
import { CoreCommentsOfflineProvider } from './services/comments-offline';
import { CoreCommentsSyncProvider } from './services/comments-sync';
import { COMMENTS_OFFLINE_SITE_SCHEMA } from './services/database/comments';
import { CoreCommentsSyncCronHandler } from './services/handlers/sync-cron';

export const CORE_COMMENTS_SERVICES: Type<unknown>[] = [
    CoreCommentsOfflineProvider,
    CoreCommentsSyncProvider,
    CoreCommentsProvider,
];

const routes: Routes = [
    {
        path: 'comments',
        loadChildren: () => import('@features/comments/comments-lazy.module').then(m => m.CoreCommentsLazyModule),
    },
];

@NgModule({
    imports: [
        CoreCommentsComponentsModule,
        CoreMainMenuTabRoutingModule.forChild(routes),
    ],
    providers: [
        {
            provide: CORE_SITE_SCHEMAS,
            useValue: [COMMENTS_OFFLINE_SITE_SCHEMA],
            multi: true,
        },
        {
            provide: APP_INITIALIZER,
            multi: true,
            useValue: () => {
                CoreCronDelegate.register(CoreCommentsSyncCronHandler.instance);

                CoreComments.initialize();
            },
        },
    ],
})
export class CoreCommentsModule {}
