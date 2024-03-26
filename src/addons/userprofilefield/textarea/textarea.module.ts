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

import { AddonUserProfileFieldTextareaHandler } from './services/handlers/textarea';
import { CoreUserProfileFieldDelegate } from '@features/user/services/user-profile-field-delegate';
import { AddonUserProfileFieldTextareaComponent } from './component/textarea';
import { CoreSharedModule } from '@/core/shared.module';
import { CoreEditorComponentsModule } from '@features/editor/components/components.module';

@NgModule({
    declarations: [
        AddonUserProfileFieldTextareaComponent,
    ],
    imports: [
        CoreSharedModule,
        CoreEditorComponentsModule,
    ],
    providers: [
        {
            provide: APP_INITIALIZER,
            multi: true,
            useValue: () => {
                CoreUserProfileFieldDelegate.registerHandler(AddonUserProfileFieldTextareaHandler.instance);
            },
        },
    ],
    exports: [
        AddonUserProfileFieldTextareaComponent,
    ],
})
export class AddonUserProfileFieldTextareaModule {}
