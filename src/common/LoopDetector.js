/*globals define*/
/**
 * Loop Detection Engine for TurtleGraphics
 * 
 * This is set to track cycles in turtle graphics programs and functions to prevent
 * infinite code generation during execution --- This is built out to staify the requirements denoted in the assignment details. .
 */



define([], function () {
    'use strict';


    function LoopDetector(client, logger) {
        this._client = client;
        this._logger = logger;
        
        //command types from GME metamodel
        this._turtleCommands = [
            'PenUp', 'PenDown', 'Right', 'Goto', 'Clear', 
            'Width', 'Color', 'Left', 'Command'
        ];
        


        //relationship patterns also from GME metamodel
        this._sequencePatterns = [
            'next',
            'target',
            'successor'
        ];
        

        // connection types for flow analysis
        this._connectionTypes = [
            'Next',
            'Sequence',
            'Flow'
        ];
    }




    /**
     * loop detection entry point
     */
    LoopDetector.prototype.detectLoops = function (nodeId) {
        var node=this._client.getNode(nodeId);
        if (!node){
            return {hasLoop: false,elements: [], analysis: 'node not found!' };
        }

        var nodeType = this._getNodeType(node);
        var nodeName = node.getAttribute ? node.getAttribute('name') : nodeId;
        
        this._logger.info('[LoopDetector] Analyzing: ' + nodeName + ' (Type: ' + nodeType + ')');
        


        //    Only setting to analyze programs and Functions per assignment requirements
        if (!this._isProgramOrFunction(node)) {
            return { 
                hasLoop: false, 
                elements: [], 
                analysis: 'Not a program or function ----> skipping',
                nodeType: nodeType
            };
        }


        try {
            // pointer sequences first - check denoted in instructions 
            var result=this._analyzeNextPointerSequences(nodeId);
            if (result.hasLoop){
                result.detectionMethod = 'next-pointer-sequence';
                this._logLoopResult(result, nodeName, 'Next Pointer');
                return result;
            }



            //containment-based sequences checker 
            result = this._analyzeContainmentSequences(nodeId);
            if (result.hasLoop) {
                result.detectionMethod = 'containment-sequence';
                this._logLoopResult(result, nodeName, 'Containment');
                return result;
            }

            // connection-based sequences
            result = this._analyzeConnectionSequences(nodeId);
            if (result.hasLoop) {
                result.detectionMethod = 'connection-sequence';
                this._logLoopResult(result, nodeName, 'Connection');
                return result;
            }

            // No loops found logger 
            this._logger.info('[LoopDetector] No loops detect in ' + nodeName);
            this._logger.info('[LoopDetector] Sequential code generation is all safe');

            // Check in for nested functions for programs
            var nestedResults = [];
            if (nodeType === 'Program') {
                nestedResults = this._analyzeNestedFunctions(nodeId);
            }

            return {
                hasLoop:false,
                elements:[],
                detectionMethod:'comprehensive-analysis',
                analysis:'Safe for sequential code generation!',
                nestedFunctions:nestedResults
            };


        } catch (error) {
            this._logger.error('[LoopDetector] Error: '+ error.message);
            return { 
                hasLoop: false, 
                elements: [], 
                error:error.message,
                analysis: 'ERROR during analysis - assuming all is safe'
            };
        }
    };




    /**
     * Analyze next pointer sequences for cycles
     */
    LoopDetector.prototype._analyzeNextPointerSequences=function(nodeId, visited, path) {
        visited = visited || [];
        path = path || [];

        if (visited.indexOf(nodeId) !== -1){
            return this._createLoopResult(nodeId, visited, path, 'next-pointer');
        }

        visited.push(nodeId);
        path.push(nodeId);

        var node = this._client.getNode(nodeId);
        if (!node) return { hasLoop: false, elements: [] };

        // Check in direct next pointer
        if (this._hasPointer(node, 'next')) {
            var targetId = this._getPointerTarget(node, 'next');
            if (targetId) {
                var result = this._analyzeNextPointerSequences(targetId, visited.slice(), path.slice());
                if (result.hasLoop) {
                    return result;
                }
            }
        }



        // Checker for children for next relationships
        var children = node.getChildrenIds ? node.getChildrenIds() : [];
        for (var i = 0; i < children.length;i++) {
            var child = this._client.getNode(children[i]);
            if (child && this._isTurtleCommand(child)) {
                var result =this._analyzeNextPointerSequences(children[i], visited.slice(), path.slice());
                if (result.hasLoop) {
                    return result;
                }
            }
        }

        return { hasLoop: false, elements: [] };
    };



    /**
     *analyze containment sequences for cycles
     */
    LoopDetector.prototype._analyzeContainmentSequences = function (nodeId, visited, path) {
        visited = visited||[];
        path = path ||[];

        if (visited.indexOf(nodeId)!== -1) {
            return this._createLoopResult(nodeId, visited, path, 'containment');
        }

        visited.push(nodeId);
        path.push(nodeId);

        var node=this._client.getNode(nodeId);
        if (!node)return{hasLoop:false,elements: [] };

        // getting turtle commands
        var children=node.getChildrenIds ? node.getChildrenIds() : [];
        var turtleCommands=[];
        

        for (var i=0;i<children.length;i++) {
            var child = this._client.getNode(children[i]);
            if (child && this._isTurtleCommand(child)) {
                turtleCommands.push(children[i]);
            }
        }




        // Analyzing command sequencing...
        for (var j =0;j< turtleCommands.length; j++) {
            var result = this._analyzeContainmentSequences(turtleCommands[j],visited.slice(), path.slice());
            if (result.hasLoop) {
                return result;
            }
        }

        return {hasLoop:false,elements:[]};
    };



    /**
     * connection sequences for cycles 
     */
    LoopDetector.prototype._analyzeConnectionSequences=function (nodeId, visited, path) {
        visited=visited || [];
        path=path||[];

        if (visited.indexOf(nodeId) !== -1) {
            return this._createLoopResult(nodeId,visited,path,'connection');
        }

        visited.push(nodeId);
        path.push(nodeId);


        var node = this._client.getNode(nodeId);
        if (!node) return { hasLoop: false, elements: [] };


        // looking for connection type children
        var children = node.getChildrenIds ? node.getChildrenIds() : [];
        for (var i=0;i<children.length; i++) {
            var child = this._client.getNode(children[i]);
            if (child && this._isNextConnection(child)) {
                var targetId = this._getConnectionTarget(child);
                if (targetId){
                    var result=this._analyzeConnectionSequences(targetId, visited.slice(), path.slice());
                    if (result.hasLoop) {
                        return result;
                    }
                }
            }
        }

        return { hasLoop:false,elements: [] };
    };




    /**
     * looking atnested functions within the programs
     */
    LoopDetector.prototype._analyzeNestedFunctions = function (nodeId) {
        var node = this._client.getNode(nodeId);
        if (!node)return [];

        var functionResults = [];
        var children = node.getChildrenIds ? node.getChildrenIds() : [];


        for (var i = 0; i < children.length; i++) {
            var child = this._client.getNode(children[i]);
            if (child && this._getNodeType(child) === 'Function') {
                var functionName = child.getAttribute ? child.getAttribute('name') : children[i];
                this._logger.info('[LoopDetector] currently analyzing nested function: ' + functionName);
                
                var result = this.detectLoops(children[i]);
                result.functionName = functionName;
                result.functionId = children[i];
                
                functionResults.push(result);
                
                if (result.hasLoop) {
                    this._logger.warn('[LoopDetector] Loop was  detected in function: ' + functionName);
                } else {
                    this._logger.info('[LoopDetector] function ' + functionName + ' is safe!');
                }
            }
        }

        return functionResults;
    };


    // Helper methods
    
    LoopDetector.prototype._isTurtleCommand =function(node) {
        var nodeType = this._getNodeType(node);
        return this._turtleCommands.indexOf(nodeType) !== -1;
    };

    LoopDetector.prototype._isNextConnection = function (node) {
        var nodeType = this._getNodeType(node);
        return nodeType === 'Next' || nodeType === 'Sequence';
    };

    LoopDetector.prototype._createLoopResult = function (nodeId, visited, path, method) {
        var loopStart = path.indexOf(nodeId);
        var loopElements = path.slice(loopStart);
        loopElements.push(nodeId);

        var elementNames = loopElements.map(function(id) {
            var n = this._client.getNode(id);
            return n && n.getAttribute ? n.getAttribute('name') : id;
        }, this);

        return {
            hasLoop: true,
            loopElements: loopElements,
            elements: elementNames,
            detectionMethod: method,
            loopPath: elementNames.join(' -> ')
        };
    };

    LoopDetector.prototype._logLoopResult = function (result, nodeName, method) {
        this._logger.warn('[LoopDetector]---loop detected in ' + nodeName);
        this._logger.warn('[LoopDetector] Detection method used: ' + method);
        this._logger.warn('[LoopDetector] Loop path:' + result.loopPath);
        this._logger.warn('[LoopDetector] Code generation would be infinite!');
    };

    LoopDetector.prototype._isProgramOrFunction = function (node) {
        var nodeType = this._getNodeType(node);
        return nodeType === 'Program' || nodeType === 'Function';
    };

    LoopDetector.prototype._getNodeType = function (node) {
        if (!node) return null;
        try {
            var metaType = node.getMetaType ? node.getMetaType() : null;
            return metaType && metaType.getAttribute ? metaType.getAttribute('name'):'Unknown';
        } catch (error) {
            return 'Unknown';
        }
    };




    LoopDetector.prototype._hasPointer = function (node, pointerName) {
        try {
            var pointerNames = node.getPointerNames ? node.getPointerNames() : [];
            return pointerNames.indexOf(pointerName) !== -1;
        } catch (error) {
            return false;
        }
    };


    LoopDetector.prototype._getPointerTarget = function (node, pointerName) {
        try {
            var pointer = node.getPointer(pointerName);
            return pointer && pointer.to ? pointer.to : null;
        } catch (error) {
            return null;
        }
    };

    
    LoopDetector.prototype._getConnectionTarget = function (connection) {
        return this._getPointerTarget(connection,'dst') || 
               this._getPointerTarget(connection,'target') ||
               this._getPointerTarget(connection, 'to');
    };

    return LoopDetector;
}); 