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
import { CoreError } from '@classes/errors/error';
import { CoreSite } from '@classes/sites/site';
import { CoreCourse, CoreCourseModuleContentFile } from '@features/course/services/course';
import { CoreCourseModuleData } from '@features/course/services/course-helper';
import { CoreCourseLogHelper } from '@features/course/services/log-helper';
import { CoreNetwork } from '@services/network';
import { CoreFilepool } from '@services/filepool';
import { CoreSitesCommonWSOptions, CoreSites } from '@services/sites';
import { CoreTextUtils } from '@services/utils/text';
import { CoreUtils } from '@services/utils/utils';
import { CoreWSExternalFile, CoreWSExternalWarning } from '@services/ws';
import { makeSingleton, Translate } from '@singletons';
import { CorePath } from '@singletons/path';
import { CoreSiteWSPreSets } from '@classes/sites/authenticated-site';

const ROOT_CACHE_KEY = 'mmaModImscp:';

/**
 * Service that provides some features for IMSCP.
 */
@Injectable( { providedIn: 'root' })
export class AddonModImscpProvider {

    static readonly COMPONENT = 'mmaModImscp';

    /**
     * Get the IMSCP toc as an array.
     *
     * @param contents The module contents.
     * @returns The toc.
     */
    protected getToc(contents: CoreCourseModuleContentFile[]): AddonModImscpTocItemTree[] {
        if (!contents || !contents.length) {
            return [];
        }

        return CoreTextUtils.parseJSON<AddonModImscpTocItemTree[]>(contents[0].content || '');
    }

    /**
     * Get the imscp toc as an array of items (not nested) to build the navigation tree.
     *
     * @param contents The module contents.
     * @returns The toc as a list.
     */
    createItemList(contents: CoreCourseModuleContentFile[]): AddonModImscpTocItem[] {
        const items: AddonModImscpTocItem[] = [];

        this.getToc(contents).forEach((item) => {
            items.push({ href: item.href, title: item.title, level: item.level });

            item.subitems.forEach((subitem) => {
                items.push({ href: subitem.href, title: subitem.title, level: subitem.level });
            });
        });

        return items;
    }

    /**
     * Check if we should ommit the file download.
     *
     * @param fileName The file name
     * @returns True if we should ommit the file.
     */
    protected checkSpecialFiles(fileName: string): boolean {
        return fileName == 'imsmanifest.xml';
    }

    /**
     * Get cache key for imscp data WS calls.
     *
     * @param courseId Course ID.
     * @returns Cache key.
     */
    protected getImscpDataCacheKey(courseId: number): string {
        return ROOT_CACHE_KEY + 'imscp:' + courseId;
    }

    /**
     * Get a imscp with key=value. If more than one is found, only the first will be returned.
     *
     * @param courseId Course ID.
     * @param key Name of the property to check.
     * @param value Value to search.
     * @param options Other options.
     * @returns Promise resolved when the imscp is retrieved.
     */
    protected async getImscpByKey(
        courseId: number,
        key: string,
        value: number,
        options: CoreSitesCommonWSOptions = {},
    ): Promise<AddonModImscpImscp> {
        const site = await CoreSites.getSite(options.siteId);

        const params: AddonModImscpGetImscpsByCoursesWSParams = {
            courseids: [courseId],
        };

        const preSets: CoreSiteWSPreSets = {
            cacheKey: this.getImscpDataCacheKey(courseId),
            updateFrequency: CoreSite.FREQUENCY_RARELY,
            component: AddonModImscpProvider.COMPONENT,
            ...CoreSites.getReadingStrategyPreSets(options.readingStrategy),
        };

        const response =
            await site.read<AddonModImscpGetImscpsByCoursesWSResponse>('mod_imscp_get_imscps_by_courses', params, preSets);

        const currentImscp = response.imscps.find((imscp) => imscp[key] == value);
        if (currentImscp) {
            return currentImscp;
        }

        throw new CoreError(Translate.instant('core.course.modulenotfound'));
    }

    /**
     * Get a imscp by course module ID.
     *
     * @param courseId Course ID.
     * @param cmId Course module ID.
     * @param options Other options.
     * @returns Promise resolved when the imscp is retrieved.
     */
    getImscp(courseId: number, cmId: number, options: CoreSitesCommonWSOptions = {}): Promise<AddonModImscpImscp> {
        return this.getImscpByKey(courseId, 'coursemodule', cmId, options);
    }

    /**
     * Given a filepath, get a certain fileurl from module contents.
     *
     * @param items Module contents.
     * @param targetFilePath Path of the searched file.
     * @returns File URL.
     */
    protected getFileUrlFromContents(items: CoreCourseModuleContentFile[], targetFilePath: string): string | undefined {
        const item = items.find((item) => {
            if (item.type != 'file') {
                return false;
            }

            const filePath = CorePath.concatenatePaths(item.filepath, item.filename);
            const filePathAlt = filePath.charAt(0) === '/' ? filePath.substring(1) : '/' + filePath;

            // Check if it's main file.
            return filePath === targetFilePath || filePathAlt === targetFilePath;
        });

        return item?.fileurl;
    }

    /**
     * Get src of a imscp item.
     *
     * @param module The module object.
     * @param itemHref Href of item to get.
     * @returns Promise resolved with the item src.
     */
    async getIframeSrc(module: CoreCourseModuleData, itemHref: string): Promise<string> {
        const siteId = CoreSites.getCurrentSiteId();

        try {
            const dirPath = await CoreFilepool.getPackageDirUrlByUrl(siteId, module.url || '');

            return CorePath.concatenatePaths(dirPath, itemHref);
        } catch (error) {
            // Error getting directory, there was an error downloading or we're in browser. Return online URL if connected.
            if (CoreNetwork.isOnline()) {
                const contents = await CoreCourse.getModuleContents(module);

                const indexUrl = this.getFileUrlFromContents(contents, itemHref);

                if (indexUrl) {
                    const site = await CoreSites.getSite(siteId);

                    return site.checkAndFixPluginfileURL(indexUrl);
                }
            }

            throw error;
        }
    }

    /**
     * Get last item viewed's href in the app for a IMSCP.
     *
     * @param id IMSCP instance ID.
     * @param siteId Site ID. If not defined, current site.
     * @returns Promise resolved with last item viewed's href, undefined if none.
     */
    async getLastItemViewed(id: number, siteId?: string): Promise<string | undefined> {
        const site = await CoreSites.getSite(siteId);
        const entry = await site.getLastViewed(AddonModImscpProvider.COMPONENT, id);

        return entry?.value;
    }

    /**
     * Invalidate the prefetched content.
     *
     * @param moduleId The module ID.
     * @param courseId Course ID of the module.
     * @param siteId Site ID. If not defined, current site.
     * @returns Promise resolved when the content is invalidated.
     */
    async invalidateContent(moduleId: number, courseId: number, siteId?: string): Promise<void> {
        siteId = siteId || CoreSites.getCurrentSiteId();

        const promises: Promise<void>[] = [];

        promises.push(this.invalidateImscpData(courseId, siteId));
        promises.push(CoreFilepool.invalidateFilesByComponent(siteId, AddonModImscpProvider.COMPONENT, moduleId));
        promises.push(CoreCourse.invalidateModule(moduleId, siteId));

        await CoreUtils.allPromises(promises);
    }

    /**
     * Invalidates imscp data.
     *
     * @param courseId Course ID.
     * @param siteId Site ID. If not defined, current site.
     * @returns Promise resolved when the data is invalidated.
     */
    async invalidateImscpData(courseId: number, siteId?: string): Promise<void> {
        const site = await CoreSites.getSite(siteId);

        await site.invalidateWsCacheForKey(this.getImscpDataCacheKey(courseId));
    }

    /**
     * Check if a file is downloadable. The file param must have 'type' and 'filename' attributes
     * like in core_course_get_contents response.
     *
     * @param file File to check.
     * @returns True if downloadable, false otherwise.
     */
    isFileDownloadable(file: CoreCourseModuleContentFile): boolean {
        return file.type === 'file' && !this.checkSpecialFiles(file.filename);
    }

    /**
     * Return whether or not the plugin is enabled in a certain site.
     *
     * @param siteId Site ID. If not defined, current site.
     * @returns Promise resolved with true if plugin is enabled, rejected or resolved with false otherwise.
     */
    async isPluginEnabled(siteId?: string): Promise<boolean> {
        const site = await CoreSites.getSite(siteId);

        return site.canDownloadFiles();
    }

    /**
     * Report a IMSCP as being viewed.
     *
     * @param id Module ID.
     * @param siteId Site ID. If not defined, current site.
     * @returns Promise resolved when the WS call is successful.
     */
    async logView(id: number, siteId?: string): Promise<void> {
        const params: AddonModImscpViewImscpWSParams = {
            imscpid: id,
        };

        await CoreCourseLogHelper.log(
            'mod_imscp_view_imscp',
            params,
            AddonModImscpProvider.COMPONENT,
            id,
            siteId,
        );
    }

    /**
     * Store last item viewed in the app for a IMSCP.
     *
     * @param id IMSCP instance ID.
     * @param href Item href.
     * @param courseId Course ID.
     * @param siteId Site ID. If not defined, current site.
     * @returns Promise resolved with last item viewed, undefined if none.
     */
    async storeLastItemViewed(id: number, href: string, courseId: number, siteId?: string): Promise<void> {
        const site = await CoreSites.getSite(siteId);

        await site.storeLastViewed(AddonModImscpProvider.COMPONENT, id, href, { data: String(courseId) });
    }

}
export const AddonModImscp = makeSingleton(AddonModImscpProvider);

/**
 * Params of mod_imscp_view_imscp WS.
 */
type AddonModImscpViewImscpWSParams = {
    imscpid: number; // Imscp instance id.
};

/**
 * IMSCP returned by mod_imscp_get_imscps_by_courses.
 */
export type AddonModImscpImscp = {
    id: number; // IMSCP id.
    coursemodule: number; // Course module id.
    course: number; // Course id.
    name: string; // Activity name.
    intro?: string; // The IMSCP intro.
    introformat?: number; // Intro format (1 = HTML, 0 = MOODLE, 2 = PLAIN or 4 = MARKDOWN).
    introfiles?: CoreWSExternalFile[];
    revision?: number; // Revision.
    keepold?: number; // Number of old IMSCP to keep.
    structure?: string; // IMSCP structure.
    timemodified?: string; // Time of last modification.
    section?: number; // Course section id.
    visible?: boolean; // If visible.
    groupmode?: number; // Group mode.
    groupingid?: number; // Group id.
};

/**
 * Params of mod_imscp_get_imscps_by_courses WS.
 */
type AddonModImscpGetImscpsByCoursesWSParams = {
    courseids?: number[]; // Array of course ids.
};

/**
 * Data returned by mod_imscp_get_imscps_by_courses WS.
 */
type AddonModImscpGetImscpsByCoursesWSResponse = {
    imscps: AddonModImscpImscp[];
    warnings?: CoreWSExternalWarning[];
};

export type AddonModImscpTocItem = {
    href: string;
    title: string;
    level: string;
};

type AddonModImscpTocItemTree = AddonModImscpTocItem & {
    subitems: AddonModImscpTocItem[];
};
