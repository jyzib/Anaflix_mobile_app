// (C) Copyright 2015 Moodle Pty Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//

//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {
    Component,
    OnDestroy,
    OnInit,
    QueryList,
    ViewChildren,
} from '@angular/core';
import { URLSearchParams } from 'url';
import { Router, NavigationExtras } from '@angular/router';
import {
    CoreCourseHelper,
    CorePrefetchStatusInfo,
} from '@features/course/services/course-helper';
import { CoreCourses } from '../../services/courses';
import { CoreEventObserver, CoreEvents } from '@singletons/events';
import { CoreSites } from '@services/sites';
import { CoreCoursesDashboard } from '@features/courses/services/dashboard';
import { CoreDomUtils } from '@services/utils/dom';
import { CoreCourseBlock } from '@features/course/services/course';
import { CoreBlockComponent } from '@features/block/components/block/block';
import { CoreNavigator } from '@services/navigator';
import { CoreBlockDelegate } from '@features/block/services/block-delegate';
import { CoreTime } from '@singletons/time';
import { CoreAnalytics, CoreAnalyticsEventType } from '@services/analytics';
import { Translate } from '@singletons';
import { CoreUtils } from '@services/utils/utils';

// ... Existing imports

import { HttpClient } from '@angular/common/http';

/**
 * Page that displays the dashboard page.
 */
@Component({
    selector: 'page-core-courses-dashboard',
    templateUrl: 'dashboard.html',
})
export class CoreCoursesDashboardPage implements OnInit, OnDestroy {
    @ViewChildren(CoreBlockComponent)
    blocksComponents?: QueryList<CoreBlockComponent>;

    hasMainBlocks = false;
    hasSideBlocks = false;
    searchEnabled = false;
    downloadCourseEnabled = false;
    downloadCoursesEnabled = false;
    userId?: number;
    blocks: Partial<CoreCourseBlock>[] = [];
    loaded = false;

    open = false;

    names: any[] = [];
    condition: boolean = true;
    leaderBoard: any[] = [];
    outPutfilter: any[] = [];
    searchFilter: any[] = [];
    userAnacoin: number = 0;
    textTickers: string[] = [];
    courseBasedpastView: any[] = [];
    img: any[] = [];
    count: number = 0;
    isfolderr: boolean = true;
    searchValue: string = '';
    isReshort: boolean = false;
    messageValue: string = '';
    messageSubject: string = '';
    Ethics: boolean = false;
    Posh: boolean = false;
    isLoading: boolean = false;
    reShort: any[] = [];
    reshortOne: any[] = [];
    anacoin: boolean = false;
    isAnacoinCount: boolean = false;
    istimeout: any;
    courseIdreshort: number = 0;
    userName: string = '';
    whatnewdata: any[] = [];
    isyourAnacoin: boolean = false;
    myAnacoins: any[] = [];
    countpage: Number = 7;
    pageSize: number = 10; // Number of items per page
    currentPage: number = 1; // Current page
    updatedObject: any = {};
    valuee: number = 2;
    searchcoursearra: any[] = [];
    searchCourses: boolean = false;
    countAnacoin: number = 30;
    isanacoin: any;

    baseUrl: String = 'https://anaflix.anarock.com/webservice/rest/server.php';
    get startIndex(): number {
        return (this.currentPage - 1) * this.pageSize;
    }

    get endIndex(): number {
        return this.currentPage * this.pageSize;
    }
    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
        }
    }

    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
        }
    }

    get totalPages(): number {
        return Math.ceil(this.myAnacoins.length / this.pageSize);
    }

    protected updateSiteObserver: CoreEventObserver;
    protected logView: () => void;

    change(): void {
        // Your logic for the change function goes here
        this.open = true;
    }

    handelFileOpen(): void {
        if (this.isfolderr) {
            this.isfolderr = false;
        } else {
            this.isfolderr = true;
        }
    }
    close(): void {
        this.open = false;
    }

    hamburger(): void {
        this.condition = false;
    }
    handelshomcoin(): void {
        this.isyourAnacoin = true;
    }
    handelbackmycoin(): void {
        this.isyourAnacoin = false;
    }

    handelcountanacoin(): void {
        this.countAnacoin = 30;
        this.isanacoin = setInterval(() => {
            this.countAnacoin--;
            if (this.countAnacoin == 0) {
                clearInterval(this.isanacoin);
            }
        }, 1000);
    }
    handelanacoincount(): void {
        this.handelcountanacoin();
        this.istimeout = setTimeout(() => {
            this.anacoin = true;
            this.isAnacoinCount = false;
            this.postusercoin();
        }, 30000);
    }
    handelclosecoin(): void {
        this.anacoin = false;
    }
    handelclick(): void {
        const msgval = this.messageValue;
        const subject = this.messageSubject;
        if (msgval && subject) {
            this.isLoading = true;

            this.sendmail(msgval, subject);
        }
    }

    handelbarClose(): void {
        this.condition = true;
        console.log('zaidi');
    }
    left(): void {
        if (this.count > 0) {
            this.count--;
        }
    }

    handelreshort(id: number): void {
        this.fetchoneReshort(id);
        this.courseIdreshort = id;
        console.log(id);
    }

    handelBackreshort(): void {
        clearInterval(this.isanacoin);
        this.fetchuserData();
        this.isReshort = false;
        clearTimeout(this.istimeout);
    }

    right(): void {
        if (this.img.length - 1 > this.count) {
            this.count++;
        }
    }

    handelSubject(subject): void {
        if (subject == 'Ethics') {
            this.Posh = false;
            this.Ethics = true;
        } else {
            this.Posh = true;
            this.Ethics = false;
        }
        this.messageSubject = subject;
        console.log(subject);
    }
    startAutomaticMovement(): void {
        // Set the interval to 500 milliseconds (adjust as needed)
        let movingleft = true;
        const intervalId = setInterval(() => {
            // Call the right function
            if (this.count < this.img.length - 1 && movingleft) {
                if (this.count == this.img.length - 2) {
                    movingleft = false;
                }
                this.right();
            } else {
                if (this.count == 0) {
                    movingleft = true;
                }
                this.left();
            }

            // If you want to stop the automatic movement after a certain condition
            // you can add a condition and clear the interval using clearInterval
        }, 2000);
    }

    oninputmessage(): void {
        const msgval = this.messageValue;
        console.log(msgval);
    }
    handelcourseSearch(): void {
        if (this.searchValue) {
            this.fetchsearchcourse(this.searchValue);
        }
    }
    handelbacksearch(): void {
        this.searchCourses = false;
    }

    constructor(private http: HttpClient, private router: Router) {
        // Existing constructor code...

        // Refresh the enabled flags if the site is updated.
        this.updateSiteObserver = CoreEvents.on(
            CoreEvents.SITE_UPDATED,
            () => {
                this.searchEnabled =
                    !CoreCourses.isSearchCoursesDisabledInSite();
                this.downloadCourseEnabled =
                    !CoreCourses.isDownloadCourseDisabledInSite();
                this.downloadCoursesEnabled =
                    !CoreCourses.isDownloadCoursesDisabledInSite();
            },
            CoreSites.getCurrentSiteId()
        );

        this.logView = CoreTime.once(async () => {
            await CoreUtils.ignoreErrors(CoreCourses.logView('dashboard'));

            CoreAnalytics.logEvent({
                type: CoreAnalyticsEventType.VIEW_ITEM,
                ws: 'core_my_view_page',
                name: Translate.instant('core.courses.mymoodle'),
                data: { category: 'course', page: 'dashboard' },
                url: '/my/',
            });
        });
    }

    /**
     * @inheritdoc
     */
    ngOnInit(): void {
        this.searchEnabled = !CoreCourses.isSearchCoursesDisabledInSite();
        this.downloadCourseEnabled =
            !CoreCourses.isDownloadCourseDisabledInSite();
        this.downloadCoursesEnabled =
            !CoreCourses.isDownloadCoursesDisabledInSite();

        // Fetch names from the API.
        this.fetchNamesFromApi();
        this.fetchtextSticker();

        this.startAutomaticMovement();

        console.group('jyzib logs app');
    }

    /**
     * Fetch data from the API's.
     */
    private fetchNamesFromApi(): void {
        // Replace with the actual URL of your API endpoint.
        const apiUrl = 'https://dummyjson.com/products/';

        // Make an HTTP request to the API.
        this.http.get<{ products: { title: string }[] }>(apiUrl).subscribe(
            (response) => {
                // Extract the 'title' property from each product.

                const names = response.products;

                // Update the property with the fetched names.
                this.names = names;
                this.searchFilter = names;
                // Load the content using the fetched names.
                this.loadContent();
            },
            (error) => {
                // Handle errors appropriately (e.g., show an error message).
                console.error('Error fetching names from the API', error);
            }
        );
    }

    private fetchsearchcourse(input: String): void {
        // Replace with the actual URL of your API endpoint.
        const apiUrl = `${this.baseUrl}?wstoken=bea2fa975a1343e017169c58d21a122b&wsfunction=local_custom_services_get_search&moodlewsrestformat=json&search=${input}&userid=${this.userId}`;

        // Make an HTTP request to the API.
        this.http.get<{ arr: { title: string }[] }>(apiUrl).subscribe(
            (response) => {
                // Extract the 'title' property from each product.
                this.searchcoursearra = response.arr;
                console.log(response.arr);
                // Load the content using the fetched names.
                this.searchCourses = true;
                this.loadContent();
            },
            (error) => {
                // Handle errors appropriately (e.g., show an error message).
                console.error('Error fetching names from the API', error);
            }
        );
    }
    private fetchcoursebasedonpastviews(): void {
        // Replace with the actual URL of your API endpoint.
        const apiUrl = `${this.baseUrl}?wstoken=bea2fa975a1343e017169c58d21a122b&wsfunction=local_custom_services_get_courses&moodlewsrestformat=json&userid=${this.userId}`;

        // Make an HTTP request to the API.
        this.http.get<{ arr: { title: string }[] }>(apiUrl).subscribe(
            (response) => {
                // Extract the 'title' property from each product.
                this.courseBasedpastView = response.arr;
                console.log(response.arr);
                // Load the content using the fetched names.
            },
            (error) => {
                // Handle errors appropriately (e.g., show an error message).
                console.error('Error fetching names from the API', error);
            }
        );
    }

    private myanacoin(): void {
        // Replace with the actual URL of your API endpoint.
        const apiUrl = `${this.baseUrl}?wstoken=bea2fa975a1343e017169c58d21a122b&wsfunction=local_custom_services_get_anacoins_data&moodlewsrestformat=json&userid=${this.userId}`;

        // Make an HTTP request to the API.
        this.http.get<{ response: { title: string }[] }>(apiUrl).subscribe(
            (response) => {
                // Extract the 'title' property from each product.
                this.myAnacoins = response.response;
                const page = Math.ceil(response.response.length / 10);
                console.log(page);
                // Load the content using the fetched names.
            },
            (error) => {
                // Handle errors appropriately (e.g., show an error message).
                console.error('Error fetching names from the API', error);
            }
        );
    }
    private postusercoin(): void {
        // Replace with the actual URL of your API endpoint.
        const apiUrl = `${this.baseUrl}?wstoken=bea2fa975a1343e017169c58d21a122b&wsfunction=local_custom_services_get_coin&moodlewsrestformat=json&userid=${this.userId}&courseid=${this.courseIdreshort}&fieldid=1&seen=true`;

        // Make an HTTP request to the API.
        this.http.get<{ products: { title: string }[] }>(apiUrl).subscribe(
            (response) => {
                // Extract the 'title' property from each product.

                console.log(response);
            },
            (error) => {
                // Handle errors appropriately (e.g., show an error message).
                console.error('Error fetching names from the API', error);
            }
        );
    }
    private fetchwhatsnew(): void {
        // Replace with the actual URL of your API endpoint.
        const apiUrl = `${this.baseUrl}?wstoken=bea2fa975a1343e017169c58d21a122b&wsfunction=local_custom_services_create_newcourse&moodlewsrestformat=json&userid=${this.userId}&courseid=9`;

        // Make an HTTP request to the API.
        this.http.get<{ response: { title: string }[] }>(apiUrl).subscribe(
            (response) => {
                // Extract the 'title' property from each product.
                this.whatnewdata = response.response;
                console.log(response.response);
                // Load the content using the fetched names.
            },
            (error) => {
                // Handle errors appropriately (e.g., show an error message).
                console.error('Error fetching names from the API', error);
            }
        );
    }

    private fetchreshortApi(): void {
        const apiUrl = `${this.baseUrl}?wstoken=bea2fa975a1343e017169c58d21a122b&wsfunction=local_custom_services_show_reshorts&moodlewsrestformat=json&userid=${this.userId}`;

        // Make an HTTP request to the API.
        this.http.get<{ response: { title: string }[] }>(apiUrl).subscribe(
            (response) => {
                // Extract the 'title' property from each product.
                console.log('after api');
                this.reShort = response.response;
                console.log(response.response);

                console.log('before api');
                // Load the content using the fetched names.
            },
            (error) => {
                // Handle errors appropriately (e.g., show an error message).
                console.error('Error fetching names from the API', error);
            }
        );
    }
    private sendmail(msg: string, subject: string): void {
        // Replace with the actual URL of your API endpoint.
        const apiUrl = `https://anaflix.anarock.com/local/admin_dashboard/sendmail.php?subject=${subject}&message=${msg}`;

        // Make an HTTP request to the API with responseType set to 'text'.
        this.http.get(apiUrl, { responseType: 'text' }).subscribe(
            (response) => {
                // Handle the text response as needed.
                console.log(response);
                // Load the content using the fetched data.
                this.isLoading = false;
                this.close();
                this.loadContent();
            },
            (error) => {
                this.isLoading = false;
                // Handle errors appropriately (e.g., show an error message).
                console.error('Error fetching data from the API', error);
            }
        );
    }
    private fetchtextSticker(): void {
        const apiUrl = `${this.baseUrl}?wstoken=bea2fa975a1343e017169c58d21a122b&wsfunction=local_custom_services_get_post&moodlewsrestformat=json&userid=3`;

        this.http.get<{ lower_text_sticker: any }>(apiUrl).subscribe(
            (response) => {
                this.textTickers = response.lower_text_sticker;
                console.log('textical');
                this.img = response.lower_text_sticker;
                console.log(this.img.length);

                this.loadContent();
            },

            (error) => {
                console.error('Error fetching names from the API', error);
            }
        );
    }
    private fetchoneReshort(id: number): void {
        const apiUrl = `${this.baseUrl}?wstoken=bea2fa975a1343e017169c58d21a122b&wsfunction=local_custom_services_get_reshorts&moodlewsrestformat=json&userid=${this.userId}&id=${id}`;

        this.http.get<{ response: any }>(apiUrl).subscribe(
            (response) => {
                this.reshortOne = response.response;
                this.isReshort = true;
                this.userName = response.response[0].fullname;
                if (response.response[0].seen) {
                    this.anacoin = false;
                    this.isAnacoinCount = false;
                } else {
                    this.isAnacoinCount = true;
                    this.handelanacoincount();
                }
                console.log(response.response);
            },

            (error) => {
                console.error('Error fetching names from the API', error);
            }
        );
    }
    private fetchuserData(): void {
        const newUser = `${this.baseUrl}?wstoken=bea2fa975a1343e017169c58d21a122b&wsfunction=local_custom_services_get_leader&moodlewsrestformat=json&userid=${this.userId}`;

        this.http
            .get<{ response: { title: string }[]; anacoin: any }>(newUser)
            .subscribe(
                (response) => {
                    // Extract the 'title' property from each product.

                    const whatnew = response.response;
                    this.userAnacoin = response.anacoin;
                    console.log(whatnew);

                    this.leaderBoard = whatnew;

                    // Update the property with the fetched names.

                    // Load the content using the fetched names.
                    // this.loadContent();
                },
                (error) => {
                    // Handle errors appropriately (e.g., show an error message).
                    console.error('Error fetching names from the API', error);
                }
            );
    }
    private fetchhrsection(): void {
        const newUser = `${this.baseUrl}?wstoken=bea2fa975a1343e017169c58d21a122b&wsfunction=local_custom_services_hr_section&moodlewsrestformat=json&userid=${this.userId}`;

        this.http
            .get<{ response: { title: string }[]; anacoin: any }>(newUser)
            .subscribe(
                (response) => {
                    // Extract the 'title' property from each product.
                    this.updatedObject = response;
                    console.log(response);

                    // Update the property with the fetched names.

                    // Load the content using the fetched names.
                    // this.loadContent();
                },
                (error) => {
                    // Handle errors appropriately (e.g., show an error message).
                    console.error('Error fetching names from the API', error);
                }
            );
    }

    /**
     * Convenience function to fetch the dashboard data.
     *
     * @returns Promise resolved when done.
     */
    protected async loadContent(): Promise<void> {
        const available = await CoreCoursesDashboard.isAvailable();
        const disabled = await CoreCoursesDashboard.isDisabled();

        if (available && !disabled) {
            this.userId = CoreSites.getCurrentSiteUserId();
            console.log('user id is ' + this.userId);

            try {
                this.fetchuserData();
                this.fetchcoursebasedonpastviews();
                this.fetchhrsection();
                this.myanacoin();
                this.fetchreshortApi();
                this.fetchwhatsnew();
                // this.blocks = this.names.map(name => ({ name, visible: true }));

                // this.hasMainBlocks = CoreBlockDelegate.hasSupportedBlock(this.blocks);
                this.hasSideBlocks = false; // Assume no side blocks for simplicity.
            } catch (error) {
                CoreDomUtils.showErrorModal(error);

                // Cannot get the blocks, just show the dashboard if needed.
                this.loadFallbackBlocks();
            }
        } else if (!available) {
            // Not available, but not disabled either. Use fallback.
            this.loadFallbackBlocks();
        } else {
            // Disabled.
            this.blocks = [];
        }

        this.loaded = true;

        this.logView();
    }

    /**
     * Load fallback blocks to show before 3.6 when dashboard blocks are not supported.
     */
    protected loadFallbackBlocks(): void {
        this.blocks = [
            {
                name: 'myoverview',
                visible: true,
            },
            {
                name: 'timeline',
                visible: true,
            },
        ];

        this.hasMainBlocks =
            CoreBlockDelegate.isBlockSupported('myoverview') ||
            CoreBlockDelegate.isBlockSupported('timeline');
    }

    /**
     *
     *
     * @param refresher Refresher.
     */

    refreshDashboard(refresher: HTMLIonRefresherElement): void {}

    /**
     * Go to search courses.
     */
    async openSearch(): Promise<void> {
        CoreNavigator.navigateToSitePath('/courses/list', {
            params: { mode: 'search' },
        });
    }

    async allcourse(id: number, isenrol: boolean): Promise<void> {
        if (isenrol) {
            const course = await CoreCourses.getUserCourse(id);
            CoreCourseHelper.openCourse(course, {
                params: { isGuest: false },
            });
        }
    }

    /**
     * @inheritdoc
     */
    ngOnDestroy(): void {
        this.updateSiteObserver.off();
    }
}
