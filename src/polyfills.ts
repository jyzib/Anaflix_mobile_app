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

// Prevents Angular change detection from running with certain Web Component callbacks.
window.__Zone_disable_customElements = true;

// Zone JS is required by default for Angular itself.
import 'zone.js';

// Platform polyfills
import 'core-js/es/array/at';
import 'core-js/es/array/flat-map';
import 'core-js/es/array/flat';
import 'core-js/es/array/includes';
import 'core-js/es/global-this';
import 'core-js/es/object/from-entries';
import 'core-js/es/object/has-own';
import 'core-js/es/promise/finally';
import 'core-js/es/string/at';
import 'core-js/es/string/match-all';
import 'core-js/es/string/trim-right';
import 'core-js/es/typed-array/at';

polyfillEventComposedPath();

/**
 * Polyfill Event.composedPath() if necessary.
 *
 * @see https://github.com/ionic-team/stencil/issues/2681
 */
function polyfillEventComposedPath() {
    const event = new Event('') as { path?: NodeList };

    if (!('path' in event && event.path instanceof NodeList)) {
        return;
    }

    Event.prototype.composedPath = function () {
        if (this._composedPath) {
            return this._composedPath;
        }

        let node = this.target;

        for (this._composedPath = []; node.parentNode !== null;) {
            this._composedPath.push(node);

            node = node.parentNode;
        }

        this._composedPath.push(document, window);

        return this._composedPath;
    };
}
