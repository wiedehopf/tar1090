(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('ol/control/Control'), require('ol/Observable')) :
	typeof define === 'function' && define.amd ? define(['ol/control/Control', 'ol/Observable'], factory) :
	(global.LayerSwitcher = factory(global.ol.control.Control,global.ol.Observable));
}(this, (function (Control,ol_Observable) { 'use strict';

Control = 'default' in Control ? Control['default'] : Control;

var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();







var get = function get(object, property, receiver) {
  if (object === null) object = Function.prototype;
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent === null) {
      return undefined;
    } else {
      return get(parent, property, receiver);
    }
  } else if ("value" in desc) {
    return desc.value;
  } else {
    var getter = desc.get;

    if (getter === undefined) {
      return undefined;
    }

    return getter.call(receiver);
  }
};

var inherits = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }

  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
};











var possibleConstructorReturn = function (self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }

  return call && (typeof call === "object" || typeof call === "function") ? call : self;
};

var CSS_PREFIX = 'layer-switcher-';

/**
 * OpenLayers Layer Switcher Control.
 * See [the examples](./examples) for usage.
 * @constructor
 * @extends {ol/control/Control~Control}
 * @param {Object} opt_options Control options, extends ol/control/Control~Control#options adding:
 * @param {String} opt_options.activationMode Event to use on the button to collapse or expand the panel.
 *   `'mouseover'` (default) the layerswitcher panel stays expanded while button or panel are hovered. 
 *   `'click'` a click on the button toggles the layerswitcher visibility.
 * @param {String} opt_options.collapseLabel Text label to use for the expanded layerswitcher button. E.g.:
 *   `'»'` (default) or `'\u00BB'`, `'-'` or `'\u2212'`. Not visible if activation mode is `'mouseover'`
 * @param {String} opt_options.label Text label to use for the collapsed layerswitcher button. E.g.:
 *   `''` (default), `'«'` or `'\u00AB'`, `'+'`.
 * @param {String} opt_options.tipLabel the button tooltip.
 * @param {String} opt_options.groupSelectStyle either `'none'` - groups don't get a checkbox,
 *   `'children'` (default) groups have a checkbox and affect child visibility or
 *   `'group'` groups have a checkbox but do not alter child visibility (like QGIS).
 * @param {boolean} opt_options.reverse Reverse the layer order. Defaults to true.
 */

var LayerSwitcher = function (_Control) {
    inherits(LayerSwitcher, _Control);

    function LayerSwitcher(opt_options) {
        classCallCheck(this, LayerSwitcher);


        var options = opt_options || {};

        var tipLabel = options.tipLabel ? options.tipLabel : 'Legend';

        var element = document.createElement('div');

        var _this = possibleConstructorReturn(this, (LayerSwitcher.__proto__ || Object.getPrototypeOf(LayerSwitcher)).call(this, { element: element, target: options.target }));

        _this.activationMode = options.activationMode || 'mouseover';

        var collapseLabel = options.collapseLabel !== undefined ? options.collapseLabel : '\xBB';

        var label = options.label !== undefined ? options.label : '';

        _this.groupSelectStyle = LayerSwitcher.getGroupSelectStyle(options.groupSelectStyle);

        _this.reverse = options.reverse !== false;

        _this.mapListeners = [];

        _this.hiddenClassName = 'ol-unselectable ol-control layer-switcher';
        if (LayerSwitcher.isTouchDevice_()) {
            _this.hiddenClassName += ' touch';
        }
        _this.shownClassName = 'shown';

        element.className = _this.hiddenClassName;

        var button = document.createElement('button');
        button.setAttribute('title', tipLabel);
        element.appendChild(button);

        _this.panel = document.createElement('div');
        _this.panel.className = 'panel';
        element.appendChild(_this.panel);
        LayerSwitcher.enableTouchScroll_(_this.panel);

        var this_ = _this;

        button.textContent = label;

        if (_this.activationMode == 'click') {
            element.classList.add('activationModeClick');
            button.onclick = function (e) {
                e = e || window.event;
                if (this_.element.classList.contains(this_.shownClassName)) {
                    this_.hidePanel();
                    button.textContent = label;
                } else {
                    this_.showPanel();
                    button.textContent = collapseLabel;
                }
                e.preventDefault();
            };
            return possibleConstructorReturn(_this);
        }

        button.onmouseover = function (e) {
            this_.showPanel();
        };

        button.onclick = function (e) {
            e = e || window.event;
            this_.showPanel();
            e.preventDefault();
        };

        this_.panel.onmouseout = function (e) {
            e = e || window.event;
            if (!this_.panel.contains(e.toElement || e.relatedTarget)) {
                this_.hidePanel();
            }
        };

        return _this;
    }

    /**
    * Set the map instance the control is associated with.
    * @param {ol/Map~Map} map The map instance.
    */


    createClass(LayerSwitcher, [{
        key: 'setMap',
        value: function setMap(map) {
            // Clean up listeners associated with the previous map
            for (var i = 0, key; i < this.mapListeners.length; i++) {
                ol_Observable.unByKey(this.mapListeners[i]);
            }
            this.mapListeners.length = 0;
            // Wire up listeners etc. and store reference to new map
            get(LayerSwitcher.prototype.__proto__ || Object.getPrototypeOf(LayerSwitcher.prototype), 'setMap', this).call(this, map);
            if (map) {
                this.renderPanel();
                if (this.activationMode == 'click') return;
                var this_ = this;
                this.mapListeners.push(map.on('pointerdown', function () {
                    this_.hidePanel();
                }));
            }
        }

        /**
        * Show the layer panel.
        */

    }, {
        key: 'showPanel',
        value: function showPanel() {
            if (!this.element.classList.contains(this.shownClassName)) {
                this.element.classList.add(this.shownClassName);
                this.renderPanel();
            }
        }

        /**
        * Hide the layer panel.
        */

    }, {
        key: 'hidePanel',
        value: function hidePanel() {
            if (this.element.classList.contains(this.shownClassName)) {
                this.element.classList.remove(this.shownClassName);
            }
        }

        /**
        * Re-draw the layer panel to represent the current state of the layers.
        */

    }, {
        key: 'renderPanel',
        value: function renderPanel() {
            this.dispatchEvent({ type: 'render' });
            LayerSwitcher.renderPanel(this.getMap(), this.panel, { groupSelectStyle: this.groupSelectStyle, reverse: this.reverse });
            this.dispatchEvent({ type: 'rendercomplete' });
        }

        /**
        * **Static** Re-draw the layer panel to represent the current state of the layers.
        * @param {ol/Map~Map} map The OpenLayers Map instance to render layers for
        * @param {Element} panel The DOM Element into which the layer tree will be rendered
        */

    }], [{
        key: 'renderPanel',
        value: function renderPanel(map, panel, options) {
            // Create the event.
            var render_event = new Event('render');
            // Dispatch the event.
            panel.dispatchEvent(render_event);

            options = options || {};

            options.groupSelectStyle = LayerSwitcher.getGroupSelectStyle(options.groupSelectStyle);

            LayerSwitcher.ensureTopVisibleBaseLayerShown_(map);

            while (panel.firstChild) {
                panel.removeChild(panel.firstChild);
            }

            // Reset indeterminate state for all layers and groups before
            // applying based on groupSelectStyle
            LayerSwitcher.forEachRecursive(map, function (l, idx, a) {
                l.set('indeterminate', false);
            });

            if (options.groupSelectStyle === 'children' || options.groupSelectStyle === 'none') {
                // Set visibile and indeterminate state of groups based on
                // their children's visibility
                LayerSwitcher.setGroupVisibility(map);
            } else if (options.groupSelectStyle === 'group') {
                // Set child indetermiate state based on their parent's visibility
                LayerSwitcher.setChildVisibility(map);
            }

            var ul = document.createElement('ul');
            panel.appendChild(ul);
            // passing two map arguments instead of lyr as we're passing the map as the root of the layers tree
            LayerSwitcher.renderLayers_(map, map, ul, options, function render(changedLyr) {
                // console.log('render');
                LayerSwitcher.renderPanel(map, panel, options);
            });

            // Create the event.
            var rendercomplete_event = new Event('rendercomplete');
            // Dispatch the event.
            panel.dispatchEvent(rendercomplete_event);
        }
    }, {
        key: 'isBaseGroup',
        value: function isBaseGroup(lyr) {
            var lyrs = lyr.getLayers ? lyr.getLayers().getArray() : [];
            return lyrs.length && lyrs[0].get('type') === 'base';
        }
    }, {
        key: 'setGroupVisibility',
        value: function setGroupVisibility(map) {
            // Get a list of groups, with the deepest first
            var groups = LayerSwitcher.getGroupsAndLayers(map, function (l) {
                return l.getLayers && !l.get('combine') && !LayerSwitcher.isBaseGroup(l);
            }).reverse();
            // console.log(groups.map(g => g.get('title')));
            groups.forEach(function (group) {
                // TODO Can we use getLayersArray, is it public in the esm build?
                var descendantVisibility = group.getLayersArray().map(function (l) {
                    var state = l.getVisible();
                    // console.log('>', l.get('title'), state);
                    return state;
                });
                // console.log(descendantVisibility);
                if (descendantVisibility.every(function (v) {
                    return v === true;
                })) {
                    group.setVisible(true);
                    group.set('indeterminate', false);
                } else if (descendantVisibility.every(function (v) {
                    return v === false;
                })) {
                    group.setVisible(false);
                    group.set('indeterminate', false);
                } else {
                    group.setVisible(true);
                    group.set('indeterminate', true);
                }
            });
        }
    }, {
        key: 'setChildVisibility',
        value: function setChildVisibility(map) {
            // console.log('setChildVisibility');
            var groups = LayerSwitcher.getGroupsAndLayers(map, function (l) {
                return l.getLayers && !l.get('combine') && !LayerSwitcher.isBaseGroup(l);
            });
            groups.forEach(function (group) {
                // console.log(group.get('title'));
                var groupVisible = group.getVisible();
                var groupIndeterminate = group.get('indeterminate');
                group.getLayers().getArray().forEach(function (l) {
                    // console.log('>', l.get('title'));
                    l.set('indeterminate', false);
                    if ((!groupVisible || groupIndeterminate) && l.getVisible()) {
                        l.set('indeterminate', true);
                    }
                });
            });
        }

        /**
        * **Static** Ensure only the top-most base layer is visible if more than one is visible.
        * @param {ol/Map~Map} map The map instance.
        * @private
        */

    }, {
        key: 'ensureTopVisibleBaseLayerShown_',
        value: function ensureTopVisibleBaseLayerShown_(map) {
            var lastVisibleBaseLyr;
            LayerSwitcher.forEachRecursive(map, function (l, idx, a) {
                if (l.get('type') === 'base' && l.getVisible()) {
                    lastVisibleBaseLyr = l;
                }
            });
            if (lastVisibleBaseLyr) LayerSwitcher.setVisible_(map, lastVisibleBaseLyr, true);
        }
    }, {
        key: 'getGroupsAndLayers',
        value: function getGroupsAndLayers(lyr, filterFn) {
            var layers = [];
            filterFn = filterFn || function (l, idx, a) {
                return true;
            };
            LayerSwitcher.forEachRecursive(lyr, function (l, idx, a) {
                if (l.get('title')) {
                    if (filterFn(l, idx, a)) {
                        layers.push(l);
                    }
                }
            });
            return layers;
        }

        /**
        * **Static** Toggle the visible state of a layer.
        * Takes care of hiding other layers in the same exclusive group if the layer
        * is toggle to visible.
        * @private
        * @param {ol/Map~Map} map The map instance.
        * @param {ol/layer/Base~BaseLayer} The layer whose visibility will be toggled.
        */

    }, {
        key: 'setVisible_',
        value: function setVisible_(map, lyr, visible, groupSelectStyle) {
            // console.log(lyr.get('title'), visible, groupSelectStyle);
            lyr.setVisible(visible);
            if (visible && lyr.get('type') === 'base') {
                // Hide all other base layers regardless of grouping
                LayerSwitcher.forEachRecursive(map, function (l, idx, a) {
                    if (l != lyr && l.get('type') === 'base') {
                        l.setVisible(false);
                    }
                });
            }
            if (lyr.getLayers && !lyr.get('combine') && groupSelectStyle === 'children') {
                lyr.getLayers().forEach(function (l) {
                    LayerSwitcher.setVisible_(map, l, lyr.getVisible(), groupSelectStyle);
                });
            }
        }

        /**
        * **Static** Render all layers that are children of a group.
        * @private
        * @param {ol/Map~Map} map The map instance.
        * @param {ol/layer/Base~BaseLayer} lyr Layer to be rendered (should have a title property).
        * @param {Number} idx Position in parent group list.
        */

    }, {
        key: 'renderLayer_',
        value: function renderLayer_(map, lyr, idx, options, render) {

            var li = document.createElement('li');

            var lyrTitle = lyr.get('title');

            var checkboxId = LayerSwitcher.uuid();

            var label = document.createElement('label');

            if (lyr.getLayers && !lyr.get('combine')) {

                var isBaseGroup = LayerSwitcher.isBaseGroup(lyr);

                li.classList.add('group');
                if (isBaseGroup) {
                    li.classList.add(CSS_PREFIX + 'base-group');
                }

                // Group folding
                if (lyr.get('fold')) {
                    li.classList.add(CSS_PREFIX + 'fold');
                    li.classList.add(CSS_PREFIX + lyr.get('fold'));
                    var btn = document.createElement('button');
                    btn.onclick = function (e) {
                        e = e || window.event;
                        LayerSwitcher.toggleFold_(lyr, li);
                        e.preventDefault();
                    };
                    li.appendChild(btn);
                }

                if (!isBaseGroup && options.groupSelectStyle != 'none') {
                    var _input = document.createElement('input');
                    _input.type = 'checkbox';
                    _input.id = checkboxId;
                    _input.checked = lyr.getVisible();
                    _input.indeterminate = lyr.get('indeterminate');
                    _input.onchange = function (e) {
                        LayerSwitcher.setVisible_(map, lyr, e.target.checked, options.groupSelectStyle);
                        render(lyr);
                    };
                    li.appendChild(_input);
                    label.htmlFor = checkboxId;
                }

                label.innerHTML = lyrTitle;
                li.appendChild(label);
                var ul = document.createElement('ul');
                li.appendChild(ul);

                LayerSwitcher.renderLayers_(map, lyr, ul, options, render);
            } else {

                li.className = 'layer';
                var input = document.createElement('input');
                if (lyr.get('type') === 'base') {
                    input.type = 'radio';
                    input.name = 'base';
                } else {
                    input.type = 'checkbox';
                }
                input.id = checkboxId;
                input.checked = lyr.get('visible');
                input.indeterminate = lyr.get('indeterminate');
                input.onchange = function (e) {
                    LayerSwitcher.setVisible_(map, lyr, e.target.checked, options.groupSelectStyle);
                    render(lyr);
                };
                li.appendChild(input);

                label.htmlFor = checkboxId;
                label.innerHTML = lyrTitle;

                var rsl = map.getView().getResolution();
                if (rsl > lyr.getMaxResolution() || rsl < lyr.getMinResolution()) {
                    label.className += ' disabled';
                }

                li.appendChild(label);
            }

            return li;
        }

        /**
        * **Static** Render all layers that are children of a group.
        * @private
        * @param {ol/Map~Map} map The map instance.
        * @param {ol/layer/Group~LayerGroup} lyr Group layer whose children will be rendered.
        * @param {Element} elm DOM element that children will be appended to.
        */

    }, {
        key: 'renderLayers_',
        value: function renderLayers_(map, lyr, elm, options, render) {
            var lyrs = lyr.getLayers().getArray().slice();
            if (options.reverse) lyrs = lyrs.reverse();
            for (var i = 0, l; i < lyrs.length; i++) {
                l = lyrs[i];
                if (l.get('title')) {
                    elm.appendChild(LayerSwitcher.renderLayer_(map, l, i, options, render));
                }
            }
        }

        /**
        * **Static** Call the supplied function for each layer in the passed layer group
        * recursing nested groups.
        * @param {ol/layer/Group~LayerGroup} lyr The layer group to start iterating from.
        * @param {Function} fn Callback which will be called for each `ol/layer/Base~BaseLayer`
        * found under `lyr`. The signature for `fn` is the same as `ol/Collection~Collection#forEach`
        */

    }, {
        key: 'forEachRecursive',
        value: function forEachRecursive(lyr, fn) {
            lyr.getLayers().forEach(function (lyr, idx, a) {
                fn(lyr, idx, a);
                if (lyr.getLayers) {
                    LayerSwitcher.forEachRecursive(lyr, fn);
                }
            });
        }

        /**
        * **Static** Generate a UUID
        * Adapted from http://stackoverflow.com/a/2117523/526860
        * @returns {String} UUID
        */

    }, {
        key: 'uuid',
        value: function uuid() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0,
                    v = c == 'x' ? r : r & 0x3 | 0x8;
                return v.toString(16);
            });
        }

        /**
        * @private
        * @desc Apply workaround to enable scrolling of overflowing content within an
        * element. Adapted from https://gist.github.com/chrismbarr/4107472
        */

    }, {
        key: 'enableTouchScroll_',
        value: function enableTouchScroll_(elm) {
            if (LayerSwitcher.isTouchDevice_()) {
                var scrollStartPos = 0;
                elm.addEventListener("touchstart", function (event) {
                    scrollStartPos = this.scrollTop + event.touches[0].pageY;
                }, false);
                elm.addEventListener("touchmove", function (event) {
                    this.scrollTop = scrollStartPos - event.touches[0].pageY;
                }, false);
            }
        }

        /**
        * @private
        * @desc Determine if the current browser supports touch events. Adapted from
        * https://gist.github.com/chrismbarr/4107472
        */

    }, {
        key: 'isTouchDevice_',
        value: function isTouchDevice_() {
            try {
                document.createEvent("TouchEvent");
                return true;
            } catch (e) {
                return false;
            }
        }

        /**
        * Fold/unfold layer group
        * @private
        */

    }, {
        key: 'toggleFold_',
        value: function toggleFold_(lyr, li) {
            li.classList.remove(CSS_PREFIX + lyr.get('fold'));
            lyr.set('fold', lyr.get('fold') === 'open' ? 'close' : 'open');
            li.classList.add(CSS_PREFIX + lyr.get('fold'));
        }

        /**
         * If a valid groupSelectStyle value is not provided then return the default
         * @private
         */

    }, {
        key: 'getGroupSelectStyle',
        value: function getGroupSelectStyle(groupSelectStyle) {
            return ['none', 'children', 'group'].indexOf(groupSelectStyle) >= 0 ? groupSelectStyle : 'children';
        }
    }]);
    return LayerSwitcher;
}(Control);

if (window.ol && window.ol.control) {
    window.ol.control.LayerSwitcher = LayerSwitcher;
}

return LayerSwitcher;

})));
