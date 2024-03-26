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

import { Component, OnInit, Input } from '@angular/core';
import { Params } from '@angular/router';
import { CoreTag } from '@features/tag/services/tag';
import { CoreUser } from '@features/user/services/user';
import { CoreNavigator } from '@services/navigator';
import { CoreSites } from '@services/sites';
import { CoreEvents } from '@singletons/events';
import {
    AddonModDataAction,
    AddonModDataData,
    AddonModDataEntry,
    AddonModDataGetDataAccessInformationWSResponse,
    AddonModDataProvider,
    AddonModDataTemplateMode,
} from '../../services/data';
import { AddonModDataHelper } from '../../services/data-helper';
import { AddonModDataOffline } from '../../services/data-offline';
import { AddonModDataModuleHandlerService } from '../../services/handlers/module';
import { CoreDomUtils } from '@services/utils/dom';
import { AddonModDataActionsMenuComponent, AddonModDataActionsMenuItem } from '../actionsmenu/actionsmenu';

/**
 * Component that displays a database action.
 */
@Component({
    selector: 'addon-mod-data-action',
    templateUrl: 'addon-mod-data-action.html',
})
export class AddonModDataActionComponent implements OnInit {

    @Input() access?: AddonModDataGetDataAccessInformationWSResponse; // Access info.
    @Input() mode!: AddonModDataTemplateMode; // The render mode.
    @Input() action!: AddonModDataAction; // The field to render.
    @Input() entry!: AddonModDataEntry; // The value of the field.
    @Input() database!: AddonModDataData; // Database object.
    @Input() title = ''; // Name of the module.
    @Input() group = 0; // Module group.
    @Input() offset?: number; // Offset of the entry.
    @Input() sortBy?: string | number; // Sort by used to calculate the offset.
    @Input() sortDirection?: string; // Sort direction used to calculate the offset.

    siteId: string;
    userPicture?: string;
    tagsEnabled = false;

    constructor() {
        this.siteId = CoreSites.getCurrentSiteId();
        this.tagsEnabled = CoreTag.areTagsAvailableInSite();
    }

    /**
     * @inheritdoc
     */
    async ngOnInit(): Promise<void> {
        if (this.action == AddonModDataAction.USERPICTURE) {
            const profile = await CoreUser.getProfile(this.entry.userid, this.database.course);
            this.userPicture = profile.profileimageurl;
        }
    }

    /**
     * Approve the entry.
     */
    approveEntry(): void {
        AddonModDataHelper.approveOrDisapproveEntry(this.database.id, this.entry.id, true, this.database.course);
    }

    /**
     * Show confirmation modal for deleting the entry.
     */
    deleteEntry(): void {
        AddonModDataHelper.showDeleteEntryModal(this.database.id, this.entry.id, this.database.course);
    }

    /**
     * Disapprove the entry.
     */
    disapproveEntry(): void {
        AddonModDataHelper.approveOrDisapproveEntry(this.database.id, this.entry.id, false, this.database.course);
    }

    /**
     * Go to the edit page of the entry.
     */
    editEntry(): void {
        const params: Params = {
            title: this.title,
        };

        const basePath = AddonModDataModuleHandlerService.PAGE_NAME;
        CoreNavigator.navigateToSitePath(
            `${basePath}/${this.database.course}/${this.database.coursemodule}/edit/${this.entry.id}`,
            { params },
        );
    }

    /**
     * Go to the view page of the entry.
     */
    viewEntry(): void {
        const params: Params = {
            title: this.title,
            group: this.group,
            offset: this.offset,
            sortBy: this.sortBy,
            sortDirection: this.sortDirection,
        };

        const basePath = AddonModDataModuleHandlerService.PAGE_NAME;
        CoreNavigator.navigateToSitePath(
            `${basePath}/${this.database.course}/${this.database.coursemodule}/${this.entry.id}`,
            { params },
        );
    }

    /**
     * Undo delete action.
     *
     * @returns Solved when done.
     */
    async undoDelete(): Promise<void> {
        const dataId = this.database.id;
        const entryId = this.entry.id;

        await AddonModDataOffline.getEntry(dataId, entryId, AddonModDataAction.DELETE, this.siteId);

        // Found. Just delete the action.
        await AddonModDataOffline.deleteEntry(dataId, entryId, AddonModDataAction.DELETE, this.siteId);
        CoreEvents.trigger(AddonModDataProvider.ENTRY_CHANGED, { dataId: dataId, entryId: entryId }, this.siteId);
    }

    /**
     * Open actions menu popover.
     */
    async actionsMenu(event: Event): Promise<void> {
        event.stopPropagation();
        event.preventDefault();

        const items: AddonModDataActionsMenuItem[] = [];

        if (this.entry.canmanageentry) {
            items.push(
                this.entry.deleted
                    ? {
                        action: () => this.undoDelete(),
                        text: 'core.restore',
                        icon: 'fas-rotate-left',
                    }
                    : {
                        action: () => this.deleteEntry(),
                        text: 'core.delete',
                        icon: 'fas-trash',
                    },
            );

            if (!this.entry.deleted) {
                items.unshift({
                    action: () => this.editEntry(),
                    text: 'core.edit',
                    icon: 'fas-pen',
                });
            }
        }

        if (this.database.approval && this.access?.canapprove && !this.entry.deleted) {
            items.push(
                !this.entry.approved
                    ? {
                        action: () => this.approveEntry(),
                        text: 'addon.mod_data.approve',
                        icon: 'fas-thumbs-up',
                    }
                    : {
                        action: () => this.disapproveEntry(),
                        text: 'addon.mod_data.disapprove',
                        icon: 'far-thumbs-down',
                    },
            );
        }

        if (this.mode === AddonModDataTemplateMode.LIST) {
            items.unshift({
                action: () => this.viewEntry(),
                text: 'addon.mod_data.showmore',
                icon: 'fas-magnifying-glass-plus',
            });
        }

        await CoreDomUtils.openPopover({
            component: AddonModDataActionsMenuComponent,
            componentProps: { items },
            id: 'actionsmenu-popover',
            event,
        });
    }

}
