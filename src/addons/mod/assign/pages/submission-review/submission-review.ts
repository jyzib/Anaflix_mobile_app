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

import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, ActivatedRouteSnapshot } from '@angular/router';
import { CoreRoutedItemsManagerSourcesTracker } from '@classes/items-management/routed-items-manager-sources-tracker';
import { CoreSwipeNavigationItemsManager } from '@classes/items-management/swipe-navigation-items-manager';
import { CoreCourse } from '@features/course/services/course';
import { CanLeave } from '@guards/can-leave';
import { CoreNavigator } from '@services/navigator';
import { CoreScreen } from '@services/screen';
import { CoreDomUtils } from '@services/utils/dom';
import { AddonModAssignListFilterName, AddonModAssignSubmissionsSource } from '../../classes/submissions-source';
import { AddonModAssignSubmissionComponent } from '../../components/submission/submission';
import { AddonModAssign, AddonModAssignAssign } from '../../services/assign';
import { CoreTime } from '@singletons/time';
import { CoreAnalytics, CoreAnalyticsEventType } from '@services/analytics';
import { Translate } from '@singletons';

/**
 * Page that displays a submission.
 */
@Component({
    selector: 'page-addon-mod-assign-submission-review',
    templateUrl: 'submission-review.html',
})
export class AddonModAssignSubmissionReviewPage implements OnInit, OnDestroy, CanLeave {

    @ViewChild(AddonModAssignSubmissionComponent) submissionComponent?: AddonModAssignSubmissionComponent;

    title = ''; // Title to display.
    submissions?: AddonModAssignSubmissionSwipeItemsManager;
    moduleId!: number; // Module ID the submission belongs to.
    courseId!: number; // Course ID the assignment belongs to.
    submitId!: number; // User that did the submission.
    blindId?: number; // Blinded user ID (if it's blinded).
    loaded = false; // Whether data has been loaded.
    canSaveGrades = false; // Whether the user can save grades.

    protected assign?: AddonModAssignAssign; // The assignment the submission belongs to.
    protected blindMarking = false; // Whether it uses blind marking.
    protected forceLeave = false; // To allow leaving the page without checking for changes.
    protected logView: () => void;

    constructor(protected route: ActivatedRoute) {
        this.logView = CoreTime.once(() => {
            if (!this.assign) {
                return;
            }

            const id = this.blindMarking ? this.blindId : this.submitId;
            const paramName = this.blindMarking ? 'blindid' : 'userid';

            CoreAnalytics.logEvent({
                type: CoreAnalyticsEventType.VIEW_ITEM,
                ws: 'mod_assign_get_submission_status',
                name: Translate.instant('addon.mod_assign.subpagetitle', {
                    contextname: this.assign.name,
                    subpage: Translate.instant('addon.mod_assign.grading'),
                }),
                data: { id, assignid: this.assign.id, category: 'assign' },
                url: `/mod/assign/view.php?id=${this.assign.cmid}&action=grader&${paramName}=${id}`,
            });
        });
    }

    /**
     * @inheritdoc
     */
    ngOnInit(): void {
        this.route.queryParams.subscribe((params) => {
            try {
                this.moduleId = CoreNavigator.getRequiredRouteNumberParam('cmId');
                this.courseId = CoreNavigator.getRequiredRouteNumberParam('courseId');
                this.submitId = CoreNavigator.getRouteNumberParam('submitId') || 0;
                this.blindId = CoreNavigator.getRouteNumberParam('blindId', { params });
                const groupId = CoreNavigator.getRequiredRouteNumberParam('groupId');
                const selectedStatus = CoreNavigator.getRouteParam<AddonModAssignListFilterName>('selectedStatus');
                const submissionsSource = CoreRoutedItemsManagerSourcesTracker.getOrCreateSource(
                    AddonModAssignSubmissionsSource,
                    [this.courseId, this.moduleId, selectedStatus],
                );

                this.submissions?.destroy();

                submissionsSource.groupId = groupId;
                this.submissions = new AddonModAssignSubmissionSwipeItemsManager(submissionsSource);

                this.submissions.start();
            } catch (error) {
                CoreDomUtils.showErrorModal(error);

                CoreNavigator.back();

                return;
            }

            this.fetchSubmission().finally(() => {
                this.logView();
                this.loaded = true;
            });
        });
    }

    /**
     * @inheritdoc
     */
    ngOnDestroy(): void {
        this.submissions?.destroy();
    }

    /**
     * Check if we can leave the page or not.
     *
     * @returns Resolved if we can leave it, rejected if not.
     */
    async canLeave(): Promise<boolean> {
        if (!this.submissionComponent || this.forceLeave) {
            return true;
        }

        // Check if data has changed.
        return this.submissionComponent.canLeave();
    }

    /**
     * User entered the page.
     */
    ionViewDidEnter(): void {
        this.submissionComponent?.ionViewDidEnter();
    }

    /**
     * User left the page.
     */
    ionViewDidLeave(): void {
        this.submissionComponent?.ionViewDidLeave();
    }

    /**
     * Get the submission.
     *
     * @returns Promise resolved when done.
     */
    protected async fetchSubmission(): Promise<void> {
        this.assign = await AddonModAssign.getAssignment(this.courseId, this.moduleId);
        this.title = this.assign.name;

        this.blindMarking = !!this.assign.blindmarking && !this.assign.revealidentities;

        const gradeInfo = await CoreCourse.getModuleBasicGradeInfo(this.moduleId);
        if (!gradeInfo) {
            return;
        }

        // Grades can be saved if simple grading.
        if (gradeInfo.advancedgrading && gradeInfo.advancedgrading[0] &&
                gradeInfo.advancedgrading[0].method !== undefined) {

            const method = gradeInfo.advancedgrading[0].method || 'simple';
            this.canSaveGrades = method == 'simple';
        } else {
            this.canSaveGrades = true;
        }
    }

    /**
     * Refresh all the data.
     *
     * @returns Promise resolved when done.
     */
    protected async refreshAllData(): Promise<void> {
        const promises: Promise<void>[] = [];

        promises.push(AddonModAssign.invalidateAssignmentData(this.courseId));
        if (this.assign) {
            promises.push(AddonModAssign.invalidateSubmissionData(this.assign.id));
            promises.push(AddonModAssign.invalidateAssignmentUserMappingsData(this.assign.id));
            promises.push(AddonModAssign.invalidateSubmissionStatusData(
                this.assign.id,
                this.submitId,
                undefined,
                this.blindMarking,
            ));
        }

        try {
            await Promise.all(promises);
        } finally {
            this.submissionComponent && this.submissionComponent.invalidateAndRefresh(true);

            await this.fetchSubmission();
        }
    }

    /**
     * Refresh the data.
     *
     * @param refresher Refresher.
     */
    refreshSubmission(refresher?: HTMLIonRefresherElement): void {
        this.refreshAllData().finally(() => {
            refresher?.complete();
        });
    }

    /**
     * Submit a grade and feedback.
     */
    async submitGrade(): Promise<void> {
        if (!this.submissionComponent) {
            return;
        }

        try {
            await this.submissionComponent.submitGrade();
            // Grade submitted, leave the view if not in tablet.
            if (!CoreScreen.isTablet) {
                this.forceLeave = true;
                CoreNavigator.back();
            }
        } catch (error) {
            CoreDomUtils.showErrorModalDefault(error, 'core.error', true);
        }
    }

}

/**
 * Helper to manage swiping within a collection of submissions.
 */
class AddonModAssignSubmissionSwipeItemsManager extends CoreSwipeNavigationItemsManager {

    /**
     * @inheritdoc
     */
    protected getSelectedItemPathFromRoute(route: ActivatedRouteSnapshot): string | null {
        return route.params.submitId;
    }

}
