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

import { NgModule } from '@angular/core';
import { CoreBlockComponent } from './block/block';
import { CoreBlockOnlyTitleComponent } from './only-title-block/only-title-block';
import { CoreBlockPreRenderedComponent } from './pre-rendered-block/pre-rendered-block';
import { CoreSharedModule } from '@/core/shared.module';
import { CoreBlockSideBlocksComponent } from './side-blocks/side-blocks';
import { CoreBlockSideBlocksButtonComponent } from './side-blocks-button/side-blocks-button';
import { CoreBlockSideBlocksTourComponent } from './side-blocks-tour/side-blocks-tour';

@NgModule({
    declarations: [
        CoreBlockComponent,
        CoreBlockOnlyTitleComponent,
        CoreBlockPreRenderedComponent,
        CoreBlockSideBlocksComponent,
        CoreBlockSideBlocksButtonComponent,
        CoreBlockSideBlocksTourComponent,
    ],
    imports: [
        CoreSharedModule,
    ],
    exports: [
        CoreBlockComponent,
        CoreBlockOnlyTitleComponent,
        CoreBlockPreRenderedComponent,
        CoreBlockSideBlocksComponent,
        CoreBlockSideBlocksButtonComponent,
        CoreBlockSideBlocksTourComponent,
    ],
})
export class CoreBlockComponentsModule {}
