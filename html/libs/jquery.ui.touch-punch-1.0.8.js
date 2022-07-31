/*!
 * jQuery UI Touch Punch 1.0.8 as modified by RWAP Software
 * based on original touchpunch v0.2.3 which has not been updated since 2014
 *
 * Updates by RWAP Software to take account of various suggested changes on the original code issues
 *
 * Original: https://github.com/furf/jquery-ui-touch-punch
 * Copyright 2011–2014, Dave Furfero
 * Dual licensed under the MIT or GPL Version 2 licenses.
 *
 * Fork: https://github.com/RWAP/jquery-ui-touch-punch
 *
 * Depends:
 * jquery.ui.widget.js
 * jquery.ui.mouse.js
 */

"use strict";
(function( factory ) {if ( typeof define === "function" && define.amd ) {define([ "jquery", "jquery-ui" ], factory );} else {factory( jQuery );}}(function ($) {$.support.mspointer = window.navigator.msPointerEnabled;$.support.touch = ( 'ontouchstart' in document|| 'ontouchstart' in window|| window.TouchEvent|| (window.DocumentTouch && document instanceof DocumentTouch)|| navigator.maxTouchPoints > 0|| navigator.msMaxTouchPoints > 0);if ((!$.support.touch && !$.support.mspointer) || !$.ui.mouse) {return;}let mouseProto = $.ui.mouse.prototype,_mouseInit = mouseProto._mouseInit,_mouseDestroy = mouseProto._mouseDestroy,touchHandled;function getTouchCoords (event) {return {x: event.originalEvent.changedTouches[0].pageX,y: event.originalEvent.changedTouches[0].pageY};}function simulateMouseEvent (event, simulatedType) {if (event.originalEvent.touches.length > 1) {return;}if (event.cancelable) {event.preventDefault();}let touch = event.originalEvent.changedTouches[0],simulatedEvent = document.createEvent('MouseEvents');simulatedEvent.initMouseEvent(simulatedType,true,true,window,1,touch.screenX,touch.screenY,touch.clientX,touch.clientY,false,false,false,false,0,null);event.target.dispatchEvent(simulatedEvent);}mouseProto._touchStart = function (event) {let self = this;this._startedMove = event.timeStamp;self._startPos = getTouchCoords(event);if (touchHandled || !self._mouseCapture(event.originalEvent.changedTouches[0])) {return;}touchHandled = true;self._touchMoved = false;simulateMouseEvent(event, 'mouseover');simulateMouseEvent(event, 'mousemove');simulateMouseEvent(event, 'mousedown');};mouseProto._touchMove = function (event) {if (!touchHandled) {return;}this._touchMoved = true;simulateMouseEvent(event, 'mousemove');};mouseProto._touchEnd = function (event) {if (!touchHandled) {return;}simulateMouseEvent(event, 'mouseup');simulateMouseEvent(event, 'mouseout');let timeMoving = event.timeStamp - this._startedMove;if (!this._touchMoved || timeMoving < 500) {simulateMouseEvent(event, 'click');} else {let endPos = getTouchCoords(event);if ((Math.abs(endPos.x - this._startPos.x) < 10) && (Math.abs(endPos.y - this._startPos.y) < 10)) {if (!this._touchMoved || event.originalEvent.changedTouches[0].touchType === 'stylus') {simulateMouseEvent(event, 'click');}}}this._touchMoved = false;touchHandled = false;};mouseProto._mouseInit = function () {let self = this;if ($.support.mspointer) {self.element[0].style.msTouchAction = 'none';}self.element.on({touchstart: $.proxy(self, '_touchStart'),touchmove: $.proxy(self, '_touchMove'),touchend: $.proxy(self, '_touchEnd')});_mouseInit.call(self);};mouseProto._mouseDestroy = function () {let self = this;self.element.off({touchstart: $.proxy(self, '_touchStart'),touchmove: $.proxy(self, '_touchMove'),touchend: $.proxy(self, '_touchEnd')});_mouseDestroy.call(self);};}));
