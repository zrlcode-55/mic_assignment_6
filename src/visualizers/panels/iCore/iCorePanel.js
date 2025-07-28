/*globals define, _, WebGMEGlobal*/
/**
 * 
 */

define([
    'js/PanelBase/PanelBaseWithHeader',
    'js/PanelManager/IActivePanel',
    'widgets/iCore/iCoreWidget',
    './iCoreControl'
], function (
    PanelBaseWithHeader,
    IActivePanel,
    iCoreWidget,
    iCoreControl
) {
    'use strict';

    function iCorePanel(layoutManager, params) {
        var options = {};
        options[PanelBaseWithHeader.OPTIONS.LOGGER_INSTANCE_NAME] = 'iCorePanel';
        options[PanelBaseWithHeader.OPTIONS.FLOATING_TITLE] = true;

        PanelBaseWithHeader.apply(this, [options, layoutManager]);

        this._client = params.client;

        this._initialize();

        this.logger.debug('ctor finished');
    }


    // Inherit from PanelBaseWithHeader
    _.extend(iCorePanel.prototype, PanelBaseWithHeader.prototype);
    _.extend(iCorePanel.prototype, IActivePanel.prototype);

    iCorePanel.prototype._initialize = function () {
        var self = this;

        this.setTitle('');

        this.widget = new iCoreWidget(this.logger, this.$el);

        this.widget.setTitle = function (title) {
            self.setTitle(title);
        };

        this.control = new iCoreControl({
            logger: this.logger,
            client: this._client,
            widget: this.widget
        });

        this.onActivate();
    };

    iCorePanel.prototype.onReadOnlyChanged = function (isReadOnly) {
        PanelBaseWithHeader.prototype.onReadOnlyChanged.call(this, isReadOnly);
    };

    iCorePanel.prototype.onResize = function (width, height) {
        this.logger.debug('onResize --> width: ' + width + ', height: ' + height);
        this.widget.onWidgetContainerResize(width, height);
    };

    
    iCorePanel.prototype.destroy=function() {
        this.control.destroy();
        this.widget.destroy();

        PanelBaseWithHeader.prototype.destroy.call(this);
        WebGMEGlobal.KeyboardManager.setListener(undefined);
        WebGMEGlobal.Toolbar.refresh();
    };

    iCorePanel.prototype.onActivate = function () {
        this.widget.onActivate();
        this.control.onActivate();
        WebGMEGlobal.KeyboardManager.setListener(this.widget);
        WebGMEGlobal.Toolbar.refresh();
    };

    iCorePanel.prototype.onDeactivate = function () {
        this.widget.onDeactivate();
        this.control.onDeactivate();
        WebGMEGlobal.KeyboardManager.setListener(undefined);
        WebGMEGlobal.Toolbar.refresh();
    };

    return iCorePanel;
});
