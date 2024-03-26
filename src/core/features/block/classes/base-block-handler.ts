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

import { CoreCourseBlock } from '@features/course/services/course';
import { CoreBlockHandler, CoreBlockHandlerData } from '../services/block-delegate';

/**
 * Base handler for blocks.
 *
 * This class is needed because parent classes cannot have @Injectable in Angular v6, so the default handler cannot be a
 * parent class.
 */
export class CoreBlockBaseHandler implements CoreBlockHandler {

    name = 'CoreBlockBase';
    blockName = 'base';

    /**
     * Whether or not the handler is enabled on a site level.
     *
     * @returns True or promise resolved with true if enabled.
     */
    async isEnabled(): Promise<boolean> {
        return true;
    }

    /**
     * Returns the data needed to render the block.
     *
     * @param block The block to render.
     * @param contextLevel The context where the block will be used.
     * @param instanceId The instance ID associated with the context level.
     * @returns Data or promise resolved with the data.
     */
    getDisplayData(
        block: CoreCourseBlock, // eslint-disable-line @typescript-eslint/no-unused-vars
        contextLevel: string, // eslint-disable-line @typescript-eslint/no-unused-vars
        instanceId: number, // eslint-disable-line @typescript-eslint/no-unused-vars
    ): undefined | CoreBlockHandlerData | Promise<CoreBlockHandlerData> {
        // To be overridden.
        return undefined;
    }

}
