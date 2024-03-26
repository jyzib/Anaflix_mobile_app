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

/**
 * Singleton with helper functions for arrays.
 */
export class CoreArray {

    /**
     * Check whether an array contains an item.
     *
     * @param arr Array.
     * @param item Item.
     * @returns Whether item is within the array.
     * @deprecated since 4.1. Use arr.includes() instead.
     */
    static contains<T>(arr: T[], item: T): boolean {
        // eslint-disable-next-line no-console
        console.warn('CoreArray.contains is deprecated and will be removed soon. Please use array \'includes\' instead.');

        return arr.indexOf(item) !== -1;
    }

    /**
     * Flatten the first dimension of a multi-dimensional array.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/flat#reduce_and_concat
     *
     * @param arr Original array.
     * @returns Flattened array.
     */
    static flatten<T>(arr: T[][]): T[] {
        return (<T[]> []).concat(...arr);
    }

    /**
     * Obtain a new array without the specified item.
     *
     * @param arr Array.
     * @param item Item to remove.
     * @returns Array without the specified item.
     */
    static withoutItem<T>(arr: T[], item: T): T[] {
        const newArray = [...arr];
        const index = arr.indexOf(item);

        if (index !== -1) {
            newArray.splice(index, 1);
        }

        return newArray;
    }

}
