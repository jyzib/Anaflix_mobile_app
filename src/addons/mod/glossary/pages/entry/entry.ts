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

import { AddonModGlossaryHelper } from '@addons/mod/glossary/services/glossary-helper';
import { AddonModGlossaryOffline, AddonModGlossaryOfflineEntry } from '@addons/mod/glossary/services/glossary-offline';
import { Component, OnDestroy, OnInit, Optional, ViewChild } from '@angular/core';
import { ActivatedRoute, ActivatedRouteSnapshot } from '@angular/router';
import { CoreRoutedItemsManagerSourcesTracker } from '@classes/items-management/routed-items-manager-sources-tracker';
import { CoreSwipeNavigationItemsManager } from '@classes/items-management/swipe-navigation-items-manager';
import { CoreSplitViewComponent } from '@components/split-view/split-view';
import { CoreCommentsCommentsComponent } from '@features/comments/components/comments/comments';
import { CoreComments } from '@features/comments/services/comments';
import { CoreRatingInfo } from '@features/rating/services/rating';
import { CoreTag } from '@features/tag/services/tag';
import { FileEntry } from '@awesome-cordova-plugins/file/ngx';
import { CoreNavigator } from '@services/navigator';
import { CoreNetwork } from '@services/network';
import { CoreDomUtils, ToastDuration } from '@services/utils/dom';
import { CoreUtils } from '@services/utils/utils';
import { Translate } from '@singletons';
import { CoreEventObserver, CoreEvents } from '@singletons/events';
import { AddonModGlossaryEntriesSource, AddonModGlossaryEntryItem } from '../../classes/glossary-entries-source';
import {
    AddonModGlossary,
    AddonModGlossaryEntry,
    AddonModGlossaryGlossary,
    AddonModGlossaryProvider,
    GLOSSARY_ENTRY_UPDATED,
} from '../../services/glossary';
import { CoreTime } from '@singletons/time';
import { CoreAnalytics, CoreAnalyticsEventType } from '@services/analytics';

/**
 * Page that displays a glossary entry.
 */
@Component({
    selector: 'page-addon-mod-glossary-entry',
    templateUrl: 'entry.html',
})
export class AddonModGlossaryEntryPage implements OnInit, OnDestroy {

    @ViewChild(CoreCommentsCommentsComponent) comments?: CoreCommentsCommentsComponent;

    component = AddonModGlossaryProvider.COMPONENT;
    componentId?: number;
    onlineEntry?: AddonModGlossaryEntry;
    offlineEntry?: AddonModGlossaryOfflineEntry;
    offlineEntryFiles?: FileEntry[];
    entries!: AddonModGlossaryEntryEntriesSwipeManager;
    glossary?: AddonModGlossaryGlossary;
    entryUpdatedObserver?: CoreEventObserver;
    loaded = false;
    showAuthor = false;
    showDate = false;
    ratingInfo?: CoreRatingInfo;
    tagsEnabled = false;
    canEdit = false;
    canDelete = false;
    commentsEnabled = false;
    courseId!: number;
    cmId!: number;

    protected logView: () => void;

    constructor(@Optional() protected splitView: CoreSplitViewComponent, protected route: ActivatedRoute) {
        this.logView = CoreTime.once(async () => {
            if (!this.onlineEntry || !this.glossary || !this.componentId) {
                return;
            }

            await CoreUtils.ignoreErrors(AddonModGlossary.logEntryView(this.onlineEntry.id, this.componentId));

            this.analyticsLogEvent('mod_glossary_get_entry_by_id', `/mod/glossary/showentry.php?eid=${this.onlineEntry.id}`);
        });
    }

    get entry(): AddonModGlossaryEntry | AddonModGlossaryOfflineEntry | undefined {
        return this.onlineEntry ?? this.offlineEntry;
    }

    /**
     * @inheritdoc
     */
    async ngOnInit(): Promise<void> {
        let onlineEntryId: number | null = null;
        let offlineEntryTimeCreated: number | null = null;

        try {
            this.courseId = CoreNavigator.getRequiredRouteNumberParam('courseId');
            this.tagsEnabled = CoreTag.areTagsAvailableInSite();
            this.commentsEnabled = !CoreComments.areCommentsDisabledInSite();
            this.cmId = CoreNavigator.getRequiredRouteNumberParam('cmId');

            const entrySlug = CoreNavigator.getRequiredRouteParam<string>('entrySlug');
            const routeData = this.route.snapshot.data;
            const source = CoreRoutedItemsManagerSourcesTracker.getOrCreateSource(
                AddonModGlossaryEntriesSource,
                [this.courseId, this.cmId, routeData.glossaryPathPrefix ?? ''],
            );

            this.entries = new AddonModGlossaryEntryEntriesSwipeManager(source);

            await this.entries.start();

            if (entrySlug.startsWith('new-')) {
                offlineEntryTimeCreated = Number(entrySlug.slice(4));
            } else {
                onlineEntryId = Number(entrySlug);
            }
        } catch (error) {
            CoreDomUtils.showErrorModal(error);
            CoreNavigator.back();

            return;
        }

        this.entryUpdatedObserver = CoreEvents.on(GLOSSARY_ENTRY_UPDATED, data => {
            if (data.glossaryId !== this.glossary?.id) {
                return;
            }

            if (
                (this.onlineEntry && this.onlineEntry.id === data.entryId) ||
                (this.offlineEntry && this.offlineEntry.timecreated === data.timecreated)
            ) {
                this.doRefresh();
            }
        });

        try {
            if (onlineEntryId) {
                await this.loadOnlineEntry(onlineEntryId);
            } else if (offlineEntryTimeCreated) {
                await this.loadOfflineEntry(offlineEntryTimeCreated);
            }
        } finally {
            this.loaded = true;
        }
    }

    /**
     * @inheritdoc
     */
    ngOnDestroy(): void {
        this.entries.destroy();
        this.entryUpdatedObserver?.off();
    }

    /**
     * Edit entry.
     */
    async editEntry(): Promise<void> {
        await CoreNavigator.navigate('./edit');
    }

    /**
     * Delete entry.
     */
    async deleteEntry(): Promise<void> {
        // Log analytics even if the user cancels for consistency with LMS.
        this.analyticsLogEvent(
            'mod_glossary_delete_entry',
            `/mod/glossary/deleteentry.php?id=${this.glossary?.id}&mode=delete&entry=${this.onlineEntry?.id}`,
        );

        const glossaryId = this.glossary?.id;
        const cancelled = await CoreUtils.promiseFails(
            CoreDomUtils.showConfirm(Translate.instant('addon.mod_glossary.areyousuredelete')),
        );

        if (!glossaryId || cancelled) {
            return;
        }

        const modal = await CoreDomUtils.showModalLoading();

        try {
            if (this.onlineEntry) {
                const entryId = this.onlineEntry.id;

                await AddonModGlossary.deleteEntry(glossaryId, entryId);
                await Promise.all([
                    CoreUtils.ignoreErrors(AddonModGlossary.invalidateEntry(entryId)),
                    CoreUtils.ignoreErrors(AddonModGlossary.invalidateEntriesByLetter(glossaryId)),
                    CoreUtils.ignoreErrors(AddonModGlossary.invalidateEntriesByAuthor(glossaryId)),
                    CoreUtils.ignoreErrors(AddonModGlossary.invalidateEntriesByCategory(glossaryId)),
                    CoreUtils.ignoreErrors(AddonModGlossary.invalidateEntriesByDate(glossaryId, 'CREATION')),
                    CoreUtils.ignoreErrors(AddonModGlossary.invalidateEntriesByDate(glossaryId, 'UPDATE')),
                    CoreUtils.ignoreErrors(this.entries.getSource().invalidateCache(false)),
                ]);
            } else if (this.offlineEntry) {
                const concept = this.offlineEntry.concept;
                const timecreated = this.offlineEntry.timecreated;

                await AddonModGlossaryOffline.deleteOfflineEntry(glossaryId, timecreated);
                await AddonModGlossaryHelper.deleteStoredFiles(glossaryId, concept, timecreated);
            }

            CoreDomUtils.showToast('addon.mod_glossary.entrydeleted', true, ToastDuration.LONG);

            if (this.splitView?.outletActivated) {
                await CoreNavigator.navigate('../../');
            } else {
                await CoreNavigator.back();
            }
        } catch (error) {
            CoreDomUtils.showErrorModalDefault(error, 'addon.mod_glossary.errordeleting', true);
        } finally {
            modal.dismiss();
        }
    }

    /**
     * Refresh the data.
     *
     * @param refresher Refresher.
     * @returns Promise resolved when done.
     */
    async doRefresh(refresher?: HTMLIonRefresherElement): Promise<void> {
        if (this.onlineEntry && this.glossary?.allowcomments && this.onlineEntry.id > 0 && this.commentsEnabled && this.comments) {
            // Refresh comments asynchronously (without blocking the current promise).
            CoreUtils.ignoreErrors(this.comments.doRefresh());
        }

        try {
            if (this.onlineEntry) {
                await CoreUtils.ignoreErrors(AddonModGlossary.invalidateEntry(this.onlineEntry.id));
                await this.loadOnlineEntry(this.onlineEntry.id);
            } else if (this.offlineEntry) {
                const entrySlug = CoreNavigator.getRequiredRouteParam<string>('entrySlug');
                const timecreated = Number(entrySlug.slice(4));

                await this.loadOfflineEntry(timecreated);
            }
        } finally {
            refresher?.complete();
        }
    }

    /**
     * Load online entry data.
     */
    protected async loadOnlineEntry(entryId: number): Promise<void> {
        try {
            const result = await AddonModGlossary.getEntry(entryId);
            const canDeleteEntries = CoreNetwork.isOnline() && await AddonModGlossary.canDeleteEntries();
            const canUpdateEntries = CoreNetwork.isOnline() && await AddonModGlossary.canUpdateEntries();

            this.onlineEntry = result.entry;
            this.ratingInfo = result.ratinginfo;
            this.canDelete = canDeleteEntries && !!result.permissions?.candelete;
            this.canEdit = canUpdateEntries && !!result.permissions?.canupdate;

            await this.loadGlossary();

            this.logView();
        } catch (error) {
            CoreDomUtils.showErrorModalDefault(error, 'addon.mod_glossary.errorloadingentry', true);
        }
    }

    /**
     * Load offline entry data.
     *
     * @param timecreated Entry Timecreated.
     */
    protected async loadOfflineEntry(timecreated: number): Promise<void> {
        try {
            const glossary = await this.loadGlossary();

            this.offlineEntry = await AddonModGlossaryOffline.getOfflineEntry(glossary.id, timecreated);
            this.offlineEntryFiles = this.offlineEntry.attachments && this.offlineEntry.attachments.offline > 0
                ? await AddonModGlossaryHelper.getStoredFiles(
                    glossary.id,
                    this.offlineEntry.concept,
                    timecreated,
                )
                : undefined;
            this.canEdit = true;
            this.canDelete = true;
        } catch (error) {
            CoreDomUtils.showErrorModalDefault(error, 'addon.mod_glossary.errorloadingentry', true);
        }
    }

    /**
     * Load glossary data.
     *
     * @returns Glossary.
     */
    protected async loadGlossary(): Promise<AddonModGlossaryGlossary> {
        if (this.glossary) {
            return this.glossary;
        }

        this.glossary = await AddonModGlossary.getGlossary(this.courseId, this.cmId);
        this.componentId = this.glossary.coursemodule;

        switch (this.glossary.displayformat) {
            case 'fullwithauthor':
            case 'encyclopedia':
                this.showAuthor = true;
                this.showDate = true;
                break;
            case 'fullwithoutauthor':
                this.showAuthor = false;
                this.showDate = true;
                break;
            default: // Default, and faq, simple, entrylist, continuous.
                this.showAuthor = false;
                this.showDate = false;
        }

        return this.glossary;
    }

    /**
     * Function called when rating is updated online.
     */
    ratingUpdated(): void {
        if (!this.onlineEntry) {
            return;
        }

        AddonModGlossary.invalidateEntry(this.onlineEntry.id);
    }

    /**
     * Log analytics event.
     *
     * @param wsName WS name.
     * @param url URL.
     */
    protected analyticsLogEvent(wsName: string, url: string): void {
        if (!this.onlineEntry || !this.glossary) {
            return;
        }

        CoreAnalytics.logEvent({
            type: CoreAnalyticsEventType.VIEW_ITEM,
            ws: wsName,
            name: this.onlineEntry.concept,
            data: { id: this.onlineEntry.id, glossaryid: this.glossary.id, category: 'glossary' },
            url,
        });
    }

}

/**
 * Helper to manage swiping within a collection of glossary entries.
 */
class AddonModGlossaryEntryEntriesSwipeManager
    extends CoreSwipeNavigationItemsManager<AddonModGlossaryEntryItem, AddonModGlossaryEntriesSource> {

    /**
     * @inheritdoc
     */
    protected getSelectedItemPathFromRoute(route: ActivatedRouteSnapshot): string | null {
        return `${this.getSource().GLOSSARY_PATH_PREFIX}entry/${route.params.entrySlug}`;
    }

}
