var Hammer = require('../../../module/hammer');
var util = require('../../../util');

/**
 * @constructor Item
 * @param {Object} data             Object containing (optional) parameters type,
 *                                  start, end, content, group, className.
 * @param {{toScreen: function, toTime: function}} conversion
 *                                  Conversion functions from time to screen and vice versa
 * @param {Object} options          Configuration options
 *                                  // TODO: describe available options
 */
function Item (data, conversion, options) {
  this.id = null;
  this.parent = null;
  this.data = data;
  this.dom = null;
  this.conversion = conversion || {};
  this.options = options || {};

  this.selected = false;
  this.displayed = false;
  this.dirty = true;

  this.top = null;
  this.right = null;
  this.left = null;
  this.width = null;
  this.height = null;

  this.editable = null;
  if (this.data && 
      this.data.hasOwnProperty('editable') && 
      typeof this.data.editable === 'boolean') {
    this.editable = data.editable;
  }
}

Item.prototype.stack = true;

/**
 * Select current item
 */
Item.prototype.select = function() {
  this.selected = true;
  this.dirty = true;
  if (this.displayed) this.redraw();
};

/**
 * Unselect current item
 */
Item.prototype.unselect = function() {
  this.selected = false;
  this.dirty = true;
  if (this.displayed) this.redraw();
};

/**
 * Set data for the item. Existing data will be updated. The id should not
 * be changed. When the item is displayed, it will be redrawn immediately.
 * @param {Object} data
 */
Item.prototype.setData = function(data) {
  var groupChanged = data.group != undefined && this.data.group != data.group;
  if (groupChanged) {
    this.parent.itemSet._moveToGroup(this, data.group);
  }

  if (data.hasOwnProperty('editable') && typeof data.editable === 'boolean') {
    this.editable = data.editable;
  }

  this.data = data;
  this.dirty = true;
  if (this.displayed) this.redraw();
};

/**
 * Set a parent for the item
 * @param {ItemSet | Group} parent
 */
Item.prototype.setParent = function(parent) {
  if (this.displayed) {
    this.hide();
    this.parent = parent;
    if (this.parent) {
      this.show();
    }
  }
  else {
    this.parent = parent;
  }
};

/**
 * Check whether this item is visible inside given range
 * @returns {{start: Number, end: Number}} range with a timestamp for start and end
 * @returns {boolean} True if visible
 */
Item.prototype.isVisible = function(range) {
  // Should be implemented by Item implementations
  return false;
};

/**
 * Show the Item in the DOM (when not already visible)
 * @return {Boolean} changed
 */
Item.prototype.show = function() {
  return false;
};

/**
 * Hide the Item from the DOM (when visible)
 * @return {Boolean} changed
 */
Item.prototype.hide = function() {
  return false;
};

/**
 * Repaint the item
 */
Item.prototype.redraw = function() {
  // should be implemented by the item
};

/**
 * Reposition the Item horizontally
 */
Item.prototype.repositionX = function() {
  // should be implemented by the item
};

/**
 * Reposition the Item vertically
 */
Item.prototype.repositionY = function() {
  // should be implemented by the item
};

/**
 * Repaint a delete button on the top right of the item when the item is selected
 * @param {HTMLElement} anchor
 * @protected
 */
Item.prototype._repaintDeleteButton = function (anchor) {
  var editable = (this.options.editable.remove || 
                  this.data.editable === true) &&
                 this.data.editable !== false;

  if (this.selected && editable && !this.dom.deleteButton) {
    // create and show button
    var me = this;

    var deleteButton = document.createElement('div');

    if (this.options.rtl) {
      deleteButton.className = 'vis-delete-rtl';
    } else {
      deleteButton.className = 'vis-delete';
    }
    deleteButton.title = 'Delete this item';

    // TODO: be able to destroy the delete button
    new Hammer(deleteButton).on('tap', function (event) {
      event.stopPropagation();
      me.parent.removeFromDataSet(me);
    });

    anchor.appendChild(deleteButton);
    this.dom.deleteButton = deleteButton;
  }
  else if (!this.selected && this.dom.deleteButton) {
    // remove button
    if (this.dom.deleteButton.parentNode) {
      this.dom.deleteButton.parentNode.removeChild(this.dom.deleteButton);
    }
    this.dom.deleteButton = null;
  }
};

/**
 * Set HTML contents for the item
 * @param {Element} element   HTML element to fill with the contents
 * @private
 */
Item.prototype._updateContents = function (element) {
  var content;
  if (this.options.template) {
    var itemData = this.parent.itemSet.itemsData.get(this.id); // get a clone of the data from the dataset
    content = this.options.template(itemData);
  }
  else {
    content = this.data.content;
  }

  var changed = this._contentToString(this.content) !== this._contentToString(content);
  if (changed) {
    // only replace the content when changed
    if (content instanceof Element) {
      element.innerHTML = '';
      element.appendChild(content);
    }
    else if (content != undefined) {
      element.innerHTML = content;
    }
    else {
      if (!(this.data.type == 'background' && this.data.content === undefined)) {
        throw new Error('Property "content" missing in item ' + this.id);
      }
    }

    this.content = content;
  }
};

/**
 * Set HTML contents for the item
 * @param {Element} element   HTML element to fill with the contents
 * @private
 */
Item.prototype._updateTitle = function (element) {
  if (this.data.title != null) {
    element.title = this.data.title || '';
  }
  else {
    element.removeAttribute('vis-title');
  }
};

/**
 * Process dataAttributes timeline option and set as data- attributes on dom.content
 * @param {Element} element   HTML element to which the attributes will be attached
 * @private
 */
 Item.prototype._updateDataAttributes = function(element) {
  if (this.options.dataAttributes && this.options.dataAttributes.length > 0) {
    var attributes = [];

    if (Array.isArray(this.options.dataAttributes)) {
      attributes = this.options.dataAttributes;
    }
    else if (this.options.dataAttributes == 'all') {
      attributes = Object.keys(this.data);
    }
    else {
      return;
    }

    for (var i = 0; i < attributes.length; i++) {
      var name = attributes[i];
      var value = this.data[name];

      if (value != null) {
        element.setAttribute('data-' + name, value);
      }
      else {
        element.removeAttribute('data-' + name);
      }
    }
  }
};

/**
 * Update custom styles of the element
 * @param element
 * @private
 */
Item.prototype._updateStyle = function(element) {
  // remove old styles
  if (this.style) {
    util.removeCssText(element, this.style);
    this.style = null;
  }

  // append new styles
  if (this.data.style) {
    util.addCssText(element, this.data.style);
    this.style = this.data.style;
  }
};

/**
 * Stringify the items contents
 * @param {string | Element | undefined} content
 * @returns {string | undefined}
 * @private
 */
Item.prototype._contentToString = function (content) {
  if (typeof content === 'string') return content;
  if (content && 'outerHTML' in content) return content.outerHTML;
  return content;
};

/**
 * Return the width of the item left from its start date
 * @return {number}
 */
Item.prototype.getWidthLeft = function () {
  return 0;
};

/**
 * Return the width of the item right from the max of its start and end date
 * @return {number}
 */
Item.prototype.getWidthRight = function () {
  return 0;
};

module.exports = Item;
