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
import { APP_INITIALIZER, NgModule } from '@angular/core';

import { CORE_SITE_SCHEMAS } from '@services/sites';
import { AddonModQuizAccessPasswordComponent } from './component/password';
import { AddonModQuizAccessPasswordHandler } from './services/handlers/password';
import { AddonModQuizAccessRuleDelegate } from '../../services/access-rules-delegate';
import { SITE_SCHEMA } from './services/database/password';

@NgModule({
    declarations: [
        AddonModQuizAccessPasswordComponent,
    ],
    imports: [
        CoreSharedModule,
    ],
    providers: [
        {
            provide: CORE_SITE_SCHEMAS,
            useValue: [SITE_SCHEMA],
            multi: true,
        },
        {
            provide: APP_INITIALIZER,
            multi: true,
            useValue: () => {
                AddonModQuizAccessRuleDelegate.registerHandler(AddonModQuizAccessPasswordHandler.instance);
            },
        },
    ],
    exports: [
        AddonModQuizAccessPasswordComponent,
    ],
})
export class AddonModQuizAccessPasswordModule {}
