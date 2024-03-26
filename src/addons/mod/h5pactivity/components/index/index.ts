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

import { Component, Optional, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { IonContent } from '@ionic/angular';

import { CoreConstants } from '@/core/constants';
import { CoreSite } from '@classes/sites/site';
import { CoreCourseModuleMainActivityComponent } from '@features/course/classes/main-activity-component';
import { CoreCourseContentsPage } from '@features/course/pages/contents/contents';
import { CoreH5PDisplayOptions } from '@features/h5p/classes/core';
import { CoreH5PHelper } from '@features/h5p/classes/helper';
import { CoreH5P } from '@features/h5p/services/h5p';
import { CoreXAPIOffline } from '@features/xapi/services/offline';
import { CoreXAPI } from '@features/xapi/services/xapi';
import { CoreNetwork } from '@services/network';
import { CoreFilepool } from '@services/filepool';
import { CoreNavigator } from '@services/navigator';
import { CoreSites, CoreSitesReadingStrategy } from '@services/sites';
import { CoreDomUtils } from '@services/utils/dom';
import { CoreWSFile } from '@services/ws';
import { CoreEventObserver, CoreEvents } from '@singletons/events';
import {
    AddonModH5PActivity,
    AddonModH5PActivityAccessInfo,
    AddonModH5PActivityData,
    AddonModH5PActivityProvider,
    AddonModH5PActivityXAPIPostStateData,
    AddonModH5PActivityXAPIStateData,
    AddonModH5PActivityXAPIStatementsData,
    MOD_H5PACTIVITY_STATE_ID,
} from '../../services/h5pactivity';
import {
    AddonModH5PActivitySync,
    AddonModH5PActivitySyncProvider,
    AddonModH5PActivitySyncResult,
} from '../../services/h5pactivity-sync';
import { CoreFileHelper } from '@services/file-helper';
import { AddonModH5PActivityModuleHandlerService } from '../../services/handlers/module';
import { CoreTextUtils } from '@services/utils/text';
import { CoreUtils } from '@services/utils/utils';

/**
 * Component that displays an H5P activity entry page.
 */
@Component({
    selector: 'addon-mod-h5pactivity-index',
    templateUrl: 'addon-mod-h5pactivity-index.html',
})
export class AddonModH5PActivityIndexComponent extends CoreCourseModuleMainActivityComponent implements OnInit, OnDestroy {

    @Output() onActivityFinish = new EventEmitter<boolean>();

    component = AddonModH5PActivityProvider.COMPONENT;
    pluginName = 'h5pactivity';

    h5pActivity?: AddonModH5PActivityData; // The H5P activity object.
    accessInfo?: AddonModH5PActivityAccessInfo; // Info about the user capabilities.
    deployedFile?: CoreWSFile; // The H5P deployed file.

    stateMessage?: string; // Message about the file state.
    downloading = false; // Whether the H5P file is being downloaded.
    needsDownload = false; // Whether the file needs to be downloaded.
    percentage?: string; // Download/unzip percentage.
    showPercentage = false; // Whether to show the percentage.
    progressMessage?: string; // Message about download/unzip.
    playing = false; // Whether the package is being played.
    displayOptions?: CoreH5PDisplayOptions; // Display options for the package.
    onlinePlayerUrl?: string; // URL to play the package in online.
    fileUrl?: string; // The fileUrl to use to play the package.
    state?: string; // State of the file.
    siteCanDownload = false;
    trackComponent?: string; // Component for tracking.
    hasOffline = false;
    isOpeningPage = false;
    canViewAllAttempts = false;
    saveStateEnabled = false;
    saveFreq?: number;
    contentState?: string;

    protected fetchContentDefaultError = 'addon.mod_h5pactivity.errorgetactivity';
    protected syncEventName = AddonModH5PActivitySyncProvider.AUTO_SYNCED;
    protected site: CoreSite;
    protected observer?: CoreEventObserver;
    protected messageListenerFunction: (event: MessageEvent) => Promise<void>;
    protected checkCompletionAfterLog = false; // It's called later, when the user plays the package.

    constructor(
        protected content?: IonContent,
        @Optional() courseContentsPage?: CoreCourseContentsPage,
    ) {
        super('AddonModH5PActivityIndexComponent', content, courseContentsPage);

        this.site = CoreSites.getRequiredCurrentSite();
        this.siteCanDownload = this.site.canDownloadFiles() && !CoreH5P.isOfflineDisabledInSite();

        // Listen for messages from the iframe.
        this.messageListenerFunction = (event) => this.onIframeMessage(event);
        window.addEventListener('message', this.messageListenerFunction);
    }

    /**
     * @inheritdoc
     */
    async ngOnInit(): Promise<void> {
        super.ngOnInit();

        this.loadContent(false, true);
    }

    /**
     * @inheritdoc
     */
    protected async fetchContent(refresh?: boolean, sync = false, showErrors = false): Promise<void> {
        // Always show loading and stop playing, the package needs to be reloaded with the latest data.
        this.showLoading = true;
        this.playing = false;

        this.h5pActivity = await AddonModH5PActivity.getH5PActivity(this.courseId, this.module.id, {
            siteId: this.siteId,
        });

        this.dataRetrieved.emit(this.h5pActivity);
        this.description = this.h5pActivity.intro;
        this.displayOptions = CoreH5PHelper.decodeDisplayOptions(this.h5pActivity.displayoptions);

        if (sync) {
            await this.syncActivity(showErrors);
        }

        await Promise.all([
            this.checkHasOffline(),
            this.fetchAccessInfo(),
            this.fetchDeployedFileData(),
        ]);

        await this.loadContentState(); // Loading the state requires the access info.

        this.trackComponent = this.accessInfo?.cansubmit ? AddonModH5PActivityProvider.TRACK_COMPONENT : '';
        this.canViewAllAttempts = !!this.h5pActivity.enabletracking && !!this.accessInfo?.canreviewattempts &&
                AddonModH5PActivity.canGetUsersAttemptsInSite();

        if (this.h5pActivity.package && this.h5pActivity.package[0]) {
            // The online player should use the original file, not the trusted one.
            this.onlinePlayerUrl = CoreH5P.h5pPlayer.calculateOnlinePlayerUrl(
                this.site.getURL(),
                this.h5pActivity.package[0].fileurl,
                this.displayOptions,
                this.trackComponent,
            );
        }

        if (!this.siteCanDownload || this.state == CoreConstants.DOWNLOADED) {
            // Cannot download the file or already downloaded, play the package directly.
            this.play();

        } else if ((this.state == CoreConstants.NOT_DOWNLOADED || this.state == CoreConstants.OUTDATED) && CoreNetwork.isOnline() &&
                    this.deployedFile?.filesize && CoreFilepool.shouldDownload(this.deployedFile.filesize)) {
            // Package is small, download it automatically. Don't block this function for this.
            this.downloadAutomatically();
        }
    }

    /**
     * Fetch the access info and store it in the right variables.
     *
     * @returns Promise resolved when done.
     */
    protected async checkHasOffline(): Promise<void> {
        if (!this.h5pActivity) {
            return;
        }

        this.hasOffline = await CoreXAPIOffline.contextHasData(this.h5pActivity.context, this.siteId);
    }

    /**
     * Fetch the access info and store it in the right variables.
     *
     * @returns Promise resolved when done.
     */
    protected async fetchAccessInfo(): Promise<void> {
        if (!this.h5pActivity) {
            return;
        }

        this.accessInfo = await AddonModH5PActivity.getAccessInformation(this.h5pActivity.id, {
            cmId: this.module.id,
            siteId: this.siteId,
        });
    }

    /**
     * Fetch the deployed file data if needed and store it in the right variables.
     *
     * @returns Promise resolved when done.
     */
    protected async fetchDeployedFileData(): Promise<void> {
        if (!this.siteCanDownload || !this.h5pActivity) {
            // Cannot download the file, no need to fetch the file data.
            return;
        }

        this.deployedFile = await AddonModH5PActivity.getDeployedFile(this.h5pActivity, {
            displayOptions: this.displayOptions,
            siteId: this.siteId,
        });

        this.fileUrl = CoreFileHelper.getFileUrl(this.deployedFile);

        // Listen for changes in the state.
        const eventName = await CoreFilepool.getFileEventNameByUrl(this.site.getId(), this.fileUrl);

        if (!this.observer) {
            this.observer = CoreEvents.on(eventName, () => {
                this.calculateFileState();
            });
        }

        await this.calculateFileState();
    }

    /**
     * Load the content's state (if enabled and there's any).
     */
    protected async loadContentState(): Promise<void> {
        if (!this.h5pActivity || !this.accessInfo || !AddonModH5PActivity.isSaveStateEnabled(this.h5pActivity, this.accessInfo)) {
            this.saveStateEnabled = false;

            return;
        }

        this.saveStateEnabled = true;
        this.saveFreq = this.h5pActivity.savestatefreq;

        const contentState = await CoreXAPI.getState(
            AddonModH5PActivityProvider.TRACK_COMPONENT,
            this.h5pActivity.context,
            MOD_H5PACTIVITY_STATE_ID,
            {
                appComponent: AddonModH5PActivityProvider.COMPONENT,
                appComponentId: this.h5pActivity.coursemodule,
                readingStrategy: CoreSitesReadingStrategy.PREFER_NETWORK,
            },
        );

        if (contentState === null) {
            return;
        }

        const contentStateObj = CoreTextUtils.parseJSON<{h5p: string}>(contentState, { h5p: '{}' });

        // The H5P state doesn't always use JSON, so an h5p property was added to jsonize it.
        this.contentState = contentStateObj.h5p ?? '{}';
    }

    /**
     * Calculate the state of the deployed file.
     *
     * @returns Promise resolved when done.
     */
    protected async calculateFileState(): Promise<void> {
        if (!this.fileUrl || !this.deployedFile) {
            return;
        }

        this.state = await CoreFilepool.getFileStateByUrl(
            this.site.getId(),
            this.fileUrl,
            this.deployedFile.timemodified,
        );

        this.showFileState();
    }

    /**
     * @inheritdoc
     */
    protected invalidateContent(): Promise<void> {
        return AddonModH5PActivity.invalidateActivityData(this.courseId);
    }

    /**
     * Displays some data based on the state of the main file.
     */
    protected async showFileState(): Promise<void> {
        if (this.state == CoreConstants.OUTDATED) {
            this.stateMessage = 'addon.mod_h5pactivity.filestateoutdated';
            this.needsDownload = true;
        } else if (this.state == CoreConstants.NOT_DOWNLOADED) {
            this.stateMessage = 'addon.mod_h5pactivity.filestatenotdownloaded';
            this.needsDownload = true;
        } else if (this.state == CoreConstants.DOWNLOADING) {
            this.stateMessage = '';

            if (!this.downloading) {
                // It's being downloaded right now but the view isn't tracking it. "Restore" the download.
                await this.downloadDeployedFile();

                this.play();
            }
        } else {
            this.stateMessage = '';
            this.needsDownload = false;
        }
    }

    /**
     * Download the file and play it.
     *
     * @param event Click event.
     * @returns Promise resolved when done.
     */
    async downloadAndPlay(event?: MouseEvent): Promise<void> {
        event?.preventDefault();
        event?.stopPropagation();

        if (!this.deployedFile) {
            return;
        }

        if (!CoreNetwork.isOnline()) {
            CoreDomUtils.showErrorModal('core.networkerrormsg', true);

            return;
        }

        try {
            // Confirm the download if needed.
            await CoreDomUtils.confirmDownloadSize({ size: this.deployedFile.filesize || 0, total: true });

            await this.downloadDeployedFile();

            if (!this.isDestroyed) {
                this.play();
            }

        } catch (error) {
            if (CoreDomUtils.isCanceledError(error) || this.isDestroyed) {
                // User cancelled or view destroyed, stop.
                return;
            }

            CoreDomUtils.showErrorModalDefault(error, 'core.errordownloading', true);
        }
    }

    /**
     * Download the file automatically.
     *
     * @returns Promise resolved when done.
     */
    protected async downloadAutomatically(): Promise<void> {
        try {
            await this.downloadDeployedFile();

            if (!this.isDestroyed) {
                this.play();
            }
        } catch (error) {
            CoreDomUtils.showErrorModalDefault(error, 'core.errordownloading', true);
        }
    }

    /**
     * Download athe H5P deployed file or restores an ongoing download.
     *
     * @returns Promise resolved when done.
     */
    protected async downloadDeployedFile(): Promise<void> {
        if (!this.fileUrl || !this.deployedFile) {
            return;
        }

        const deployedFile = this.deployedFile;
        this.downloading = true;
        this.progressMessage = 'core.downloading';

        // Delete offline states when downloading the package because it means the package has changed or user deleted it.
        this.deleteOfflineStates();

        try {
            await CoreFilepool.downloadUrl(
                this.site.getId(),
                this.fileUrl,
                false,
                this.component,
                this.componentId,
                deployedFile.timemodified,
                (data: DownloadProgressData) => {
                    if (!data) {
                        return;
                    }

                    this.percentage = undefined;
                    this.showPercentage = false;

                    if (data.message) {
                        // Show a message.
                        this.progressMessage = data.message;
                    } else if (data.loaded !== undefined) {
                        // Downloading or unzipping.
                        const totalSize = this.progressMessage == 'core.downloading' ? deployedFile.filesize : data.total;

                        if (totalSize !== undefined) {
                            const percentageNumber = (Number(data.loaded / totalSize) * 100);
                            this.percentage = percentageNumber.toFixed(1);
                            this.showPercentage = percentageNumber >= 0 && percentageNumber <= 100;
                        }
                    }
                },
            );

        } finally {
            this.progressMessage = undefined;
            this.percentage = undefined;
            this.showPercentage = false;
            this.downloading = false;
        }
    }

    /**
     * Play the package.
     */
    async play(): Promise<void> {
        if (!this.h5pActivity) {
            return;
        }

        this.playing = true;

        // Mark the activity as viewed.
        await AddonModH5PActivity.logView(this.h5pActivity.id, this.siteId);

        this.checkCompletion();

        this.analyticsLogEvent('mod_h5pactivity_view_h5pactivity');
    }

    /**
     * Go to view user attempts.
     */
    async viewMyAttempts(): Promise<void> {
        this.isOpeningPage = true;
        const userId = CoreSites.getCurrentSiteUserId();

        try {
            await CoreNavigator.navigateToSitePath(
                `${AddonModH5PActivityModuleHandlerService.PAGE_NAME}/${this.courseId}/${this.module.id}/userattempts/${userId}`,
            );
        } finally {
            this.isOpeningPage = false;
        }
    }

    /**
     * Go to view all user attempts.
     */
    async viewAllAttempts(): Promise<void> {
        this.isOpeningPage = true;

        try {
            await CoreNavigator.navigateToSitePath(
                `${AddonModH5PActivityModuleHandlerService.PAGE_NAME}/${this.courseId}/${this.module.id}/users`,
            );
        } finally {
            this.isOpeningPage = false;
        }
    }

    /**
     * Treat an iframe message event.
     *
     * @param event Event.
     * @returns Promise resolved when done.
     */
    protected async onIframeMessage(event: MessageEvent): Promise<void> {
        const data = event.data;
        if (!data || !this.h5pActivity) {
            return;
        }

        if (CoreXAPI.canPostStatementsInSite(this.site) && this.isCurrentXAPIPostStatement(data)) {
            this.postStatements(data);
        } else if (this.saveStateEnabled && this.isCurrentXAPIState(data, 'xapi_post_state') && this.isXAPIPostState(data)) {
            this.postState(data);
        } else if (this.saveStateEnabled && this.isCurrentXAPIState(data, 'xapi_delete_state')) {
            this.deleteState(data);
        }
    }

    /**
     * Check if an event is an H5P event meant for this app.
     *
     * @param data Event data.
     * @returns Whether it's an H5P event meant for this app.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    protected isH5PEventForApp(data: any): boolean {
        return data.environment === 'moodleapp' && data.context === 'h5p';
    }

    /**
     * Check if an activity ID (an IRI) belongs to the current activity.
     *
     * @param activityId Activity ID (IRI).
     * @returns Whether it belongs to the current activity.
     */
    protected activityIdIsCurrentActivity(activityId?: string): boolean {
        if (!activityId || !this.h5pActivity) {
            return false;
        }

        if (!this.site.containsUrl(activityId)) {
            // The event belongs to another site, weird scenario. Maybe some JS running in background.
            return false;
        }

        const match = activityId.match(/xapi\/activity\/(\d+)/);

        return !!match && Number(match[1]) === this.h5pActivity.context;
    }

    /**
     * Check if an event is an XAPI post statement of the current activity.
     *
     * @param data Event data.
     * @returns Whether it's an XAPI post statement of the current activity.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    protected isCurrentXAPIPostStatement(data: any): data is AddonModH5PActivityXAPIStatementsData {
        if (!this.h5pActivity) {
            return false;
        }

        if (!this.isH5PEventForApp(data) || data.action !== 'xapi_post_statement' || !data.statements) {
            return false;
        }

        // Check the event belongs to this activity.
        return this.activityIdIsCurrentActivity(data.statements[0] && data.statements[0].object && data.statements[0].object.id);
    }

    /**
     * Post statements.
     *
     * @param data Event data.
     */
    protected async postStatements(data: AddonModH5PActivityXAPIStatementsData): Promise<void> {
        if (!this.h5pActivity) {
            return;
        }

        try {
            const options = {
                offline: this.hasOffline,
                courseId: this.courseId,
                extra: this.h5pActivity.name,
                siteId: this.site.getId(),
            };

            const sent = await CoreXAPI.postStatements(
                this.h5pActivity.context,
                data.component,
                JSON.stringify(data.statements),
                options,
            );

            this.hasOffline = !sent;
            this.deleteOfflineStates(); // Posting statements means attempt has finished, delete any offline state.

            if (sent) {
                try {
                    // Invalidate attempts.
                    await AddonModH5PActivity.invalidateUserAttempts(this.h5pActivity.id, undefined, this.siteId);
                } catch {
                    // Ignore errors.
                }

                // Check if the H5P has ended. Final statements don't include a subContentId.
                const hasEnded = data.statements.some(statement => !statement.object.id.includes('subContentId='));
                if (hasEnded) {
                    this.onActivityFinish.emit(hasEnded);
                    this.checkCompletion();
                }
            }
        } catch (error) {
            CoreDomUtils.showErrorModalDefault(error, 'Error sending tracking data.');
        }
    }

    /**
     * Check if an event is an XAPI state event of the current activity.
     *
     * @param data Event data.
     * @param action Action to check.
     * @returns Whether it's an XAPI state event of the current activity.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    protected isCurrentXAPIState(data: any, action: string): data is AddonModH5PActivityXAPIStateData {
        if (!this.h5pActivity) {
            return false;
        }

        if (!this.isH5PEventForApp(data) || data.action !== action) {
            return false;
        }

        // Check the event belongs to this activity.
        return this.activityIdIsCurrentActivity(data.activityId);
    }

    /**
     * Check if an xAPI state event data is a post state event.
     *
     * @param data Event data.
     * @returns Whether it's an XAPI post state.
     */
    protected isXAPIPostState(data: AddonModH5PActivityXAPIStateData): data is AddonModH5PActivityXAPIPostStateData {
        return 'stateData' in data;
    }

    /**
     * Post state.
     *
     * @param data Event data.
     */
    protected async postState(data: AddonModH5PActivityXAPIPostStateData): Promise<void> {
        try {
            const options = {
                offline: this.hasOffline,
                courseId: this.courseId,
                extra: this.h5pActivity?.name,
                siteId: this.site.getId(),
            };

            const sent = await CoreXAPI.postState(
                data.component,
                data.activityId,
                data.agent,
                data.stateId,
                data.stateData,
                options,
            );

            this.hasOffline = !sent;
        } catch (error) {
            CoreDomUtils.showErrorModalDefault(error, 'Error sending tracking data.');
        }
    }

    /**
     * Delete state.
     *
     * @param data Event data.
     */
    protected async deleteState(data: AddonModH5PActivityXAPIStateData): Promise<void> {
        try {
            await CoreXAPI.deleteState(
                data.component,
                data.activityId,
                data.agent,
                data.stateId,
                {
                    siteId: this.site.getId(),
                },
            );
        } catch (error) {
            CoreDomUtils.showErrorModalDefault(error, 'Error sending tracking data.');
        }
    }

    /**
     * Delete offline states for current activity.
     */
    protected async deleteOfflineStates(): Promise<void> {
        if (!this.h5pActivity) {
            return;
        }

        await CoreUtils.ignoreErrors(CoreXAPIOffline.deleteStates(AddonModH5PActivityProvider.TRACK_COMPONENT, {
            itemId: this.h5pActivity.context,
        }));
    }

    /**
     * @inheritdoc
     */
    protected async sync(): Promise<AddonModH5PActivitySyncResult> {
        if (!this.h5pActivity) {
            return {
                updated: false,
                warnings: [],
            };
        }

        return AddonModH5PActivitySync.syncActivity(this.h5pActivity.context, this.site.getId());
    }

    /**
     * @inheritdoc
     */
    protected autoSyncEventReceived(): void {
        this.checkHasOffline();
    }

    /**
     * Component destroyed.
     */
    ngOnDestroy(): void {
        super.ngOnDestroy();

        this.observer?.off();

        // Wait a bit to make sure all messages have been received.
        setTimeout(() => {
            window.removeEventListener('message', this.messageListenerFunction);
        }, 2000);
    }

}

type DownloadProgressData = {
    message?: string;
    loaded?: number;
    total?: number;
};
