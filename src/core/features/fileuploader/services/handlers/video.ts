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

import { Injectable } from '@angular/core';

import { CoreApp } from '@services/app';
import { CorePlatform } from '@services/platform';
import { CoreUtils } from '@services/utils/utils';
import { makeSingleton } from '@singletons';
import { CoreFileUploaderHandler, CoreFileUploaderHandlerData, CoreFileUploaderHandlerResult } from '../fileuploader-delegate';
import { CoreFileUploaderHelper } from '../fileuploader-helper';
/**
 * Handler to record a video to upload it.
 */
@Injectable({ providedIn: 'root' })
export class CoreFileUploaderVideoHandlerService implements CoreFileUploaderHandler {

    name = 'CoreFileUploaderVideo';
    priority = 1400;

    /**
     * Whether or not the handler is enabled on a site level.
     *
     * @returns Promise resolved with true if enabled.
     */
    async isEnabled(): Promise<boolean> {
        return CorePlatform.isMobile() || (CoreApp.canGetUserMedia() && CoreApp.canRecordMedia());
    }

    /**
     * Given a list of mimetypes, return the ones that are supported by the handler.
     *
     * @param mimetypes List of mimetypes.
     * @returns Supported mimetypes.
     */
    getSupportedMimetypes(mimetypes: string[]): string[] {
        if (CorePlatform.isIOS()) {
            // In iOS it's recorded as MOV.
            return CoreUtils.filterByRegexp(mimetypes, /^video\/quicktime$/);
        } else if (CorePlatform.isAndroid()) {
            // In Android we don't know the format the video will be recorded, so accept any video mimetype.
            return CoreUtils.filterByRegexp(mimetypes, /^video\//);
        } else {
            // In browser, support video formats that are supported by MediaRecorder.
            if (MediaRecorder) {
                return mimetypes.filter((type) => {
                    const matches = type.match(/^video\//);

                    return matches?.length && MediaRecorder.isTypeSupported(type);
                });
            }
        }

        return [];
    }

    /**
     * Get the data to display the handler.
     *
     * @returns Data.
     */
    getData(): CoreFileUploaderHandlerData {
        return {
            title: 'core.fileuploader.video',
            class: 'core-fileuploader-video-handler',
            icon: 'videocam', // Cannot use font-awesome in action sheet.
            action: async (
                maxSize?: number,
                upload?: boolean,
                allowOffline?: boolean,
                mimetypes?: string[],
            ): Promise<CoreFileUploaderHandlerResult> => {
                const result = await CoreFileUploaderHelper.uploadAudioOrVideo(false, maxSize, upload, mimetypes);

                return {
                    treated: true,
                    result: result,
                };
            },
        };
    }

}

export const CoreFileUploaderVideoHandler = makeSingleton(CoreFileUploaderVideoHandlerService);
