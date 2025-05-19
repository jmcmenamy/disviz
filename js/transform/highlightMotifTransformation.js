/**
 * @class
 * 
 * This transformation visually highlights a set of motifs.
 * 
 * @constructor
 * @extends Transformation
 * @param {MotifFinder} finder A MotifFinder that specifies which motif to
 *            highlight
 * @param {Boolean} ignoreEdges If true, edges will not be visually highlighted
 */
function HighlightMotifTransformation(finder, ignoreEdges, lineToHighlight) {

    /** @private */
    this.finder = finder;

    this.motifGroup = null;

    this.lineToHighlight = lineToHighlight;

    this.setIgnoreEdges(ignoreEdges);
}

// HighlightMotifTransformation extends Transformation
HighlightMotifTransformation.prototype = Object.create(Transformation.prototype);
HighlightMotifTransformation.prototype.constructor = HighlightMotifTransformation;

/**
 * Sets whether or not to highlight edges that are part of the motif.
 * 
 * @param {Boolean} val If true, edges will not be visually highlighted
 */
HighlightMotifTransformation.prototype.setIgnoreEdges = function(val) {
    this.ignoreEdges = !!val;
};

/**
 * Returns the motif group that represents the highlighted elements from the
 * last invocation of {@link HighlightMotifTransformation#transform}. If
 * transform or findMotifs have yet to be called, this method returns null
 * 
 * @returns {MotifGroup}
 */
HighlightMotifTransformation.prototype.getHighlighted = function() {
    return this.motifGroup;
};

/**
 * This function searches for motifs in the given graph using the MotifFinder 
 * that was specified in the constructor
 *
 * @param {ModelGraph} graph The graph to search within
 */
HighlightMotifTransformation.prototype.findMotifs = function(graph) {
    this.motifGroup = this.finder.find(graph);
}

/**
 * Overrides {@link Transformation#transform}
 */
HighlightMotifTransformation.prototype.transform = function(model) {

    this.findMotifs(model.getGraph());

    model.getVisualNodes().forEach(function(node) {
        // Only fade out non-host nodes
        if (!node.isStart()) {
            node.setOpacity(0.2);
        }
    });
    model.getVisualEdges().forEach(function(edge) {
        edge.setOpacity(0.2);
    });

    var nodes = this.motifGroup.getNodes();
    // console.log("Transforming, line to highlight is ", this.lineToHighlight)
    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        var visualNode = model.getVisualNodeByNode(node);
        visualNode.setRadius(5 * 1.2);
        visualNode.setOpacity(1);
        const events = node.getLogEvents();
        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            if (event.getLogLine() === this.lineToHighlight) {
                console.log("Making node", visualNode.getId(), "bigger");
                var id = "#node" + visualNode.getId();
                // make this node appear bigger
                queueMicrotask(() => {
                    $(id)[0].dispatchEvent(new MouseEvent("mouseover"));
                    console.log("Scrolling", visualNode.getY());
                    $(window).scrollTop(Math.max(0, $(id).offset().top - 4*MotifNavigator.TOP_SPACING));
                    // $(window).scrollTop(Math.max(0, visualNode.getY() - MotifNavigator.TOP_SPACING));
                });

                // var position = motifData.getTop() - MotifNavigator.TOP_SPACING;
                // position = Math.max(0, position);
                // $(window).scrollTop(position);
                // $(id)[0].dispatchEvent(new MouseEvent("mouseover"));
                break;
            }
        }
    }

    var edges = this.motifGroup.getEdges();
    for (var i = 0; i < edges.length; i++) {
        var edge = edges[i];
        var visualEdge = model.getVisualEdgeByNodes(edge[0], edge[1]);
        visualEdge.setColor("#333");
        visualEdge.setOpacity(1);
        // visualEdge.setWidth(visualEdge.getWidth() * 1.5);
    }
};