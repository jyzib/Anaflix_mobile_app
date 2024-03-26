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

import { Component, Input, OnInit, DoCheck, KeyValueDiffers } from '@angular/core';
import { CoreFileEntry } from '@services/file-helper';

import { CoreMimetypeUtils } from '@services/utils/mimetype';
import { CoreUtils } from '@services/utils/utils';

/**
 * Component to render a file list.
 *
 * <core-files [files]="files" [component]="component" [componentId]="assign.cmid">
 * </core-files>
 */
@Component({
    selector: 'core-files',
    templateUrl: 'core-files.html',
})
export class CoreFilesComponent implements OnInit, DoCheck {

    @Input() files: CoreFileEntry[] = []; // List of files.
    @Input() component?: string; // Component the downloaded files will be linked to.
    @Input() componentId?: string | number; // Component ID.
    @Input() alwaysDownload?: boolean | string; // Whether it should always display the refresh button when the file is downloaded.
    @Input() canDownload?: boolean | string = true; // Whether file can be downloaded.
    @Input() showSize?: boolean | string = true; // Whether show filesize.
    @Input() showTime?: boolean | string = true; // Whether show file time modified.
    @Input() showInline = false; // If true, it will reorder and try to show inline files first.
    @Input() extraHtml?: string[]; // Extra HTML for each attachment. Each HTML should be at the same position as the attachment.

    contentText?: string;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    protected differ: any; // To detect changes in the data input.

    constructor(differs: KeyValueDiffers) {
        this.differ = differs.find([]).create();
    }

    /**
     * @inheritdoc
     */
    ngOnInit(): void {
        if (CoreUtils.isTrueOrOne(this.showInline) && this.files) {
            this.renderInlineFiles();
        }
    }

    /**
     * Detect and act upon changes that Angular can’t or won’t detect on its own (objects and arrays).
     */
    ngDoCheck(): void {
        if (CoreUtils.isTrueOrOne(this.showInline) && this.files) {
            // Check if there's any change in the files array.
            const changes = this.differ.diff(this.files);
            if (changes) {
                this.renderInlineFiles();
            }
        }
    }

    /**
     * Calculate contentText based on fils that can be rendered inline.
     */
    protected renderInlineFiles(): void {
        this.contentText = this.files.reduce((previous, file) => {
            const text = CoreMimetypeUtils.getEmbeddedHtml(file);

            return text ? previous + '<br>' + text : previous;
        }, '');
    }

}
