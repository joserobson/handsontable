import { BasePlugin } from '../base';
import Hooks from '../../pluginHooks';
import { arrayEach } from '../../helpers/array';
import CommandExecutor from './commandExecutor';
import EventManager from '../../eventManager';
import ItemsFactory from './itemsFactory';
import Menu from './menu';
import { getWindowScrollLeft, getWindowScrollTop, hasClass } from '../../helpers/dom/element';
import {
  ROW_ABOVE,
  ROW_BELOW,
  COLUMN_LEFT,
  COLUMN_RIGHT,
  REMOVE_ROW,
  REMOVE_COLUMN,
  UNDO,
  REDO,
  READ_ONLY,
  ALIGNMENT,
  SEPARATOR,
} from './predefinedItems';

import './contextMenu.scss';

export const PLUGIN_KEY = 'contextMenu';
export const PLUGIN_PRIORITY = 70;

Hooks.getSingleton().register('afterContextMenuDefaultOptions');
Hooks.getSingleton().register('beforeContextMenuShow');
Hooks.getSingleton().register('afterContextMenuShow');
Hooks.getSingleton().register('afterContextMenuHide');
Hooks.getSingleton().register('afterContextMenuExecute');

/* eslint-disable jsdoc/require-description-complete-sentence */
/**
 * @class ContextMenu
 * @description
 * This plugin creates the Handsontable Context Menu. It allows to create a new row or column at any place in the
 * grid among [other features](@/guides/accessories-and-menus/context-menu.md#context-menu-with-specific-options).
 * Possible values:
 * * `true` (to enable default options),
 * * `false` (to disable completely)
 * * `{ uiContainer: containerDomElement }` (to declare a container for all of the Context Menu's dom elements to be placed in).
 *
 * or array of any available strings:
 * * `'row_above'`
 * * `'row_below'`
 * * `'col_left'`
 * * `'col_right'`
 * * `'remove_row'`
 * * `'remove_col'`
 * * `'undo'`
 * * `'redo'`
 * * `'make_read_only'`
 * * `'alignment'`
 * * `'---------'` (menu item separator)
 * * `'borders'` (with {@link Options#customBorders} turned on)
 * * `'commentsAddEdit'` (with {@link Options#comments} turned on)
 * * `'commentsRemove'` (with {@link Options#comments} turned on).
 *
 * See [the context menu demo](@/guides/accessories-and-menus/context-menu.md) for examples.
 *
 * @example
 * ```js
 * // as a boolean
 * contextMenu: true
 * // as a array
 * contextMenu: ['row_above', 'row_below', '---------', 'undo', 'redo']
 * ```
 *
 * @plugin ContextMenu
 */
export class ContextMenu extends BasePlugin {
  static get PLUGIN_KEY() {
    return PLUGIN_KEY;
  }

  static get PLUGIN_PRIORITY() {
    return PLUGIN_PRIORITY;
  }

  static get PLUGIN_DEPS() {
    return [
      'plugin:AutoColumnSize',
    ];
  }

  /**
   * Context menu default items order when `contextMenu` options is set as `true`.
   *
   * @returns {string[]}
   */
  static get DEFAULT_ITEMS() {
    return [
      ROW_ABOVE, ROW_BELOW,
      SEPARATOR,
      COLUMN_LEFT, COLUMN_RIGHT,
      SEPARATOR,
      REMOVE_ROW, REMOVE_COLUMN,
      SEPARATOR,
      UNDO, REDO,
      SEPARATOR,
      READ_ONLY,
      SEPARATOR,
      ALIGNMENT,
    ];
  }

  /**
   * @param {Core} hotInstance Handsontable instance.
   */
  constructor(hotInstance) {
    super(hotInstance);
    /**
     * Instance of {@link EventManager}.
     *
     * @private
     * @type {EventManager}
     */
    this.eventManager = new EventManager(this);
    /**
     * Instance of {@link CommandExecutor}.
     *
     * @private
     * @type {CommandExecutor}
     */
    this.commandExecutor = new CommandExecutor(this.hot);
    /**
     * Instance of {@link ItemsFactory}.
     *
     * @private
     * @type {ItemsFactory}
     */
    this.itemsFactory = null;
    /**
     * Instance of {@link Menu}.
     *
     * @private
     * @type {Menu}
     */
    this.menu = null;
  }

  /**
   * Checks if the plugin is enabled in the handsontable settings. This method is executed in {@link Hooks#beforeInit}
   * hook and if it returns `true` then the {@link ContextMenu#enablePlugin} method is called.
   *
   * @returns {boolean}
   */
  isEnabled() {
    return !!this.hot.getSettings()[PLUGIN_KEY];
  }

  /**
   * Enables the plugin functionality for this Handsontable instance.
   */
  enablePlugin() {
    if (this.enabled) {
      return;
    }

    const settings = this.hot.getSettings()[PLUGIN_KEY];

    if (typeof settings.callback === 'function') {
      this.commandExecutor.setCommonCallback(settings.callback);
    }

    this.menu = new Menu(this.hot, {
      className: 'htContextMenu',
      keepInViewport: true,
      container: settings.uiContainer || this.hot.rootDocument.body,
    });

    this.menu.addLocalHook('beforeOpen', () => this.onMenuBeforeOpen());
    this.menu.addLocalHook('afterOpen', () => this.onMenuAfterOpen());
    this.menu.addLocalHook('afterClose', () => this.onMenuAfterClose());
    this.menu.addLocalHook('executeCommand', (...params) => this.executeCommand.call(this, ...params));

    this.addHook('afterOnCellContextMenu', event => this.onAfterOnCellContextMenu(event));

    super.enablePlugin();
  }

  /**
   * Updates the plugin's state.
   *
   * This method is executed when [`updateSettings()`](@/api/core.md#updatesettings) is invoked with any of the following configuration options:
   *  - [`contextMenu`](@/api/options.md#contextmenu)
   */
  updatePlugin() {
    this.disablePlugin();
    this.enablePlugin();

    super.updatePlugin();
  }

  /**
   * Disables the plugin functionality for this Handsontable instance.
   */
  disablePlugin() {
    this.close();

    if (this.menu) {
      this.menu.destroy();
      this.menu = null;
    }
    super.disablePlugin();
  }

  /**
   * Opens menu and re-position it based on the passed coordinates.
   *
   * @param {Event} event The mouse event object.
   */
  open(event) {
    if (!this.menu) {
      return;
    }

    this.prepareMenuItems();
    this.menu.open();

    if (!this.menu.isOpened()) {
      return;
    }

    let offsetTop = 0;
    let offsetLeft = 0;

    if (this.hot.rootDocument !== this.menu.container.ownerDocument) {
      const { frameElement } = this.hot.rootWindow;
      const { top, left } = frameElement.getBoundingClientRect();

      offsetTop = top - getWindowScrollTop(event.view);
      offsetLeft = left - getWindowScrollLeft(event.view);

    } else {
      offsetTop = -1 * getWindowScrollTop(this.menu.hotMenu.rootWindow);
      offsetLeft = -1 * getWindowScrollLeft(this.menu.hotMenu.rootWindow);
    }

    this.menu.setPosition({
      top: parseInt(event.pageY, 10) + offsetTop,
      left: parseInt(event.pageX, 10) + offsetLeft,
    });
  }

  /**
   * Closes the menu.
   */
  close() {
    if (!this.menu) {
      return;
    }

    this.menu.close();
    this.itemsFactory = null;
  }

  /**
   * Execute context menu command.
   *
   * The `executeCommand()` method works only for selected cells.
   *
   * When no cells are selected, `executeCommand()` doesn't do anything.
   *
   * You can execute all predefined commands:
   *  * `'row_above'` - Insert row above
   *  * `'row_below'` - Insert row below
   *  * `'col_left'` - Insert column left
   *  * `'col_right'` - Insert column right
   *  * `'clear_column'` - Clear selected column
   *  * `'remove_row'` - Remove row
   *  * `'remove_col'` - Remove column
   *  * `'undo'` - Undo last action
   *  * `'redo'` - Redo last action
   *  * `'make_read_only'` - Make cell read only
   *  * `'alignment:left'` - Alignment to the left
   *  * `'alignment:top'` - Alignment to the top
   *  * `'alignment:right'` - Alignment to the right
   *  * `'alignment:bottom'` - Alignment to the bottom
   *  * `'alignment:middle'` - Alignment to the middle
   *  * `'alignment:center'` - Alignment to the center (justify).
   *
   * Or you can execute command registered in settings where `key` is your command name.
   *
   * @param {string} commandName The command name to be executed.
   * @param {*} params Additional parameters passed to command executor module.
   */
  executeCommand(commandName, ...params) {
    if (this.itemsFactory === null) {
      this.prepareMenuItems();
    }

    this.commandExecutor.execute(commandName, ...params);
  }

  /**
   * Prepares available contextMenu's items list and registers them in commandExecutor.
   *
   * @private
   * @fires Hooks#afterContextMenuDefaultOptions
   * @fires Hooks#beforeContextMenuSetItems
   */
  prepareMenuItems() {
    this.itemsFactory = new ItemsFactory(this.hot, ContextMenu.DEFAULT_ITEMS);

    const settings = this.hot.getSettings()[PLUGIN_KEY];
    const predefinedItems = {
      items: this.itemsFactory.getItems(settings)
    };

    this.hot.runHooks('afterContextMenuDefaultOptions', predefinedItems);

    this.itemsFactory.setPredefinedItems(predefinedItems.items);
    const menuItems = this.itemsFactory.getItems(settings);

    this.hot.runHooks('beforeContextMenuSetItems', menuItems);

    this.menu.setMenuItems(menuItems);

    // Register all commands. Predefined and added by user or by plugins
    arrayEach(menuItems, command => this.commandExecutor.registerCommand(command.key, command));
  }

  /**
   * On contextmenu listener.
   *
   * @private
   * @param {Event} event The mouse event object.
   */
  onAfterOnCellContextMenu(event) {
    const settings = this.hot.getSettings();
    const showRowHeaders = settings.rowHeaders;
    const showColHeaders = settings.colHeaders;

    /**
     * @private
     * @param {HTMLElement} element The element to validate.
     * @returns {boolean}
     */
    function isValidElement(element) {
      return element.nodeName === 'TD' || element.parentNode.nodeName === 'TD';
    }
    const element = event.target;

    this.close();

    if (hasClass(element, 'handsontableInput')) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (!(showRowHeaders || showColHeaders)) {
      if (!isValidElement(element) && !(hasClass(element, 'current') && hasClass(element, 'wtBorder'))) {
        return;
      }
    }

    this.open(event);
  }

  /**
   * On menu before open listener.
   *
   * @private
   */
  onMenuBeforeOpen() {
    this.hot.runHooks('beforeContextMenuShow', this);
  }

  /**
   * On menu after open listener.
   *
   * @private
   */
  onMenuAfterOpen() {
    this.hot.runHooks('afterContextMenuShow', this);
  }

  /**
   * On menu after close listener.
   *
   * @private
   */
  onMenuAfterClose() {
    this.hot.listen();
    this.hot.runHooks('afterContextMenuHide', this);
  }

  /**
   * Destroys the plugin instance.
   */
  destroy() {
    this.close();

    if (this.menu) {
      this.menu.destroy();
    }
    super.destroy();
  }
}

ContextMenu.SEPARATOR = {
  name: SEPARATOR
};
