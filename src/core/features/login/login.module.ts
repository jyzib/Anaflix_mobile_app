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

import { APP_INITIALIZER, NgModule } from '@angular/core';
import { Routes } from '@angular/router';

import { AppRoutingModule } from '@/app/app-routing.module';
import { CoreLoginHelper, CoreLoginHelperProvider } from './services/login-helper';
import { redirectGuard } from '@guards/redirect';
import { CoreLoginCronHandler } from './services/handlers/cron';
import { CoreCronDelegate } from '@services/cron';
import { CoreEvents } from '@singletons/events';

export const CORE_LOGIN_SERVICES = [
    CoreLoginHelperProvider,
];

const appRoutes: Routes = [
    {
        path: 'login',
        loadChildren: () => import('./login-lazy.module').then(m => m.CoreLoginLazyModule),
        canActivate: [redirectGuard],
    },
];

@NgModule({
    imports: [
        AppRoutingModule.forChild(appRoutes),
    ],
    providers: [
        {
            provide: APP_INITIALIZER,
            multi: true,
            useValue: async () => {
                CoreCronDelegate.register(CoreLoginCronHandler.instance);

                CoreEvents.on(CoreEvents.SESSION_EXPIRED, (data) => {
                    CoreLoginHelper.sessionExpired(data);
                });

                CoreEvents.on(CoreEvents.PASSWORD_CHANGE_FORCED, (data) => {
                    CoreLoginHelper.passwordChangeForced(data.siteId);
                });

                CoreEvents.on(CoreEvents.SITE_POLICY_NOT_AGREED, (data) => {
                    CoreLoginHelper.sitePolicyNotAgreed(data.siteId);
                });

                await CoreLoginHelper.initialize();
            },
        },
    ],
})
export class CoreLoginModule {}
