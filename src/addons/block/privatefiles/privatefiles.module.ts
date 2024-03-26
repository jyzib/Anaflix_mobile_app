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
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { CoreBlockDelegate } from '@features/block/services/block-delegate';
import { AddonBlockPrivateFilesHandler } from './services/block-handler';

@NgModule({
    imports: [
        IonicModule,
        TranslateModule.forChild(),
    ],
    providers: [
        {
            provide: APP_INITIALIZER,
            multi: true,
            useValue: () => {
                CoreBlockDelegate.registerHandler(AddonBlockPrivateFilesHandler.instance);
            },
        },
    ],
})
export class AddonBlockPrivateFilesModule {}
