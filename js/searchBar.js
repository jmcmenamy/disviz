/**
 * SearchBar is a Singleton. Do not call its constructor directly. Use
 * SearchBar.getInstance()
 * 
 * @classdesc
 * 
 * <p>
 * As the name suggests, SearchBar represents the search bar found in Shiviz's
 * visualization page. Both the text input and the drop-down panel are
 * considered part of the search bar. This class is responsible for binding user
 * input to the search bar with the appropriate actions.
 * </p>
 * 
 * <p>
 * Text searches, pre-defined motif searches, and user-define motif searches can
 * all be performed with the search bar. The SearchBar's mode indicates what
 * type of query is currently being performed and is one of the mode static
 * constants defined in this class (e.g. {@link SearchBar.MODE_TEXT}).
 * </p>
 * 
 * <p>
 * The search bar is associated with a {@link Global}. That global is what will
 * be searched through and modified when a search is performed.
 * </p>
 * 
 * @constructor
 */
function SearchBar() {

    if (SearchBar.instance)
        throw new Exception("Cannot instantiate SearchBar, instance already exists");

    SearchBar.instance = this;

    /** @private */
    this.global = null;

    /** @private */
    this.motifNavigator = null;

    /** @private */
    this.graphBuilder = new GraphBuilder($("#panel svg"), $("#addButton"), false);

    /** @private */
    this.mode = SearchBar.MODE_EMPTY;

    /** @private */
    this.updateLocked = false;

    /** @private */
    this.numInstances = undefined;

    var context = this;

    // Called whenever a change is made to the GraphBuilder -- either through drawing a custom structure or through clearStructure()
    this.graphBuilder.setUpdateCallback(function() {
        if (context.updateLocked) {
            return;
        }

        var vts = new VectorTimestampSerializer("{\"host\":\"`HOST`\",\"clock\":`CLOCK`}", ",", "#structure=[", "]");
        var builderGraph = this.convertToBG();
        if (!this.isCleared()) {
            context.setValue(vts.serialize(builderGraph.toVectorTimestamps()));
        }
    });

    $("#searchbar #bar > input").unbind("keydown.search").on("keydown.search", async function(e) {
        // Only act when panel is expanded
        if (!context.isPanelShown())
            return;

        switch (e.which) {
        // Return
        case 13:
            if (context.getValue().trim().length > 0) {
                context.addToSearchHistory(context.getValue());
                await context.queryServer();
                context.hidePanel();
            }
            break;

        // Escape
        case 27:
            context.hidePanel();
            break;
        }
        context.global.getController().bindScroll();
    });

    $("#searchbar #bar > input").on("input", function() {
        context.clearResults();
        context.update();
    }).on("focus", function() {
        context.showPanel();
        context.showSearchHistory();
    });

    $("#searchButton").on("click", async function(e) { 

        context.addToSearchHistory(context.getValue());

        if (e.ctrlKey && e.altKey) {
            var regexp = '(?<event>){"host":"(?<host>[^}]+)","clock":(?<clock>{[^}]*})}';
            await Shiviz.getInstance().visualize(context.getValue(), regexp, "", "order", false);
        }
        else {
            await context.queryServer();
        }
        context.hidePanel();
    });

    $("#searchbar #bar .clear").on("click", async function() {
        context.updateLocked = true;
        await context.clear(true);
        context.hidePanel();
        context.update();
        context.updateLocked = false;
        context.clearMotifsTab();
        context.global.getController().bindScroll();
    });

    $("#searchbar .predefined button").on("click", async function() {
        context.clearStructure();
        context.setValue("#" + this.name);
        context.addToSearchHistory("#" + this.name)
        context.hidePanel();
        await context.queryServer();
    });

    $("#nextButton").on("click", function() {
        if (context.motifNavigator == null) {
            return;
        }
        context.getNextResultFromServer(1);
        // context.motifNavigator.next();
        // context.hidePanel();
    });

    $("#prevButton").on("click", function() {
        if (context.motifNavigator == null) {
            return;
        }
        context.getNextResultFromServer(-1);
        // context.motifNavigator.prev();
        // context.hidePanel();
    });

    $('#numFoundInput').on('keydown', function(event) {
        if (event.key === 'Enter' && context.motifNavigator != null) {
            context.getNextResultFromServer(undefined, parseInt($('#numFoundInput').val(), 10)-1);
        }
    });

    // Event handler for switching between search options
    $("#searchbar .searchTabLinks a").on("click", function(e) {
        // Show the clicked on tab and hide the others
        var currentTab = $(this).attr("href");
        $("#searchbar #" + currentTab).show().siblings("div").hide();
        $(this).parent("li").addClass("default").siblings("li").removeClass("default");
        // prevent id of div from being added to URL
        e.preventDefault();
    });

    // Event handler for motif selection in network motifs tab
    $("#motifOption input").on("change", function() {
        if ($(this).is(":checked") || $(this).siblings("input:checkbox:checked").length > 0) {
            context.setValue("#motif");
            $("#searchButton").click();
        } else {
            context.clearText();
            $(".motifResults td").empty();
        }
        context.clearStructure();
    });
}

/**
 * @static
 * @const
 */
SearchBar.MODE_EMPTY = 0;

/**
 * @static
 * @const
 */
SearchBar.MODE_TEXT = 1;

/**
 * @static
 * @const
 */
SearchBar.MODE_CUSTOM = 2;

/**
 * @static
 * @const
 */
SearchBar.MODE_PREDEFINED = 3;

/**
 * @static
 * @const
 */
SearchBar.MODE_MOTIF = 4;

/**
 * @private
 * @static
 */
SearchBar.instance = null;

/**
 * @static
 * @const
 */
SearchBar.SEARCH_HISTORY_KEY = "searchHistory";
    
/**
 * @static
 * @const
 */
SearchBar.MAX_NUM_OF_ELEMENTS_IN_HISTORY = 64;

/**
 * Gets the SearchBar instance.
 * 
 * @static
 */
SearchBar.getInstance = function() {
    return SearchBar.instance || new SearchBar();
};

/**
 * Sets the global associated with this search bar. The global associated with
 * this search bar is what will be searched through and modified when a search
 * is performed.
 * 
 * @param {Global} global the global associated with this search bar.
 */
SearchBar.prototype.setGlobal = function(global) {
    this.global = global;
};

/**
 * Returns the global associated with this search bar.
 *
 * @returns {Global} global the global associated with this search bar
 */
SearchBar.prototype.getGlobal = function(global) {
    return this.global;
};

/**
 * Updates the mode of this search bar. The mode indicates what type of query is
 * currently being performed and is one of the mode static constants defined in
 * this class (e.g. {@link SearchBar.MODE_TEXT}). This method automatically
 * deduces what type of query is currently entered based on the contents of the
 * text field.
 */
SearchBar.prototype.updateMode = function() {
    var value = this.getValue().trim();

    $("#searchbar #bar > input").css("color", "initial");

    if (value.length == 0) {
        this.mode = SearchBar.MODE_EMPTY;
        $("#searchButton").prop("disabled", true);
        $("#searchbar input").addClass("empty");
        return;
    }
    else {
        $("#searchButton").prop("disabled", false);
        $("#searchbar input").removeClass("empty");
    }

    if (value.charAt(0) != "#") {
        this.mode = SearchBar.MODE_TEXT;
    }
    else if (value.slice(0, 11) == "#structure=") {
        this.mode = SearchBar.MODE_CUSTOM;
    }
    else if (value.slice(0, 7) == "#motif") {
        this.mode = SearchBar.MODE_MOTIF;
    }
    else {
        this.mode = SearchBar.MODE_PREDEFINED;
    }

};

/**
 * Gets the current mode the search bar is in. The mode indicates what type of
 * query is currently being performed and is one of the mode static constants
 * defined in this class (e.g. {@link SearchBar.MODE_TEXT}).
 * 
 * @returns {Number} the mode
 */
SearchBar.prototype.getMode = function() {
    return this.mode;
};

/**
 * Updates the search bar to reflect any changes made to either the text or the
 * drawn graph.
 */
SearchBar.prototype.update = function() {

    this.updateLocked = true;
    this.updateMode();

    switch (this.mode) {

    // Empty
    case SearchBar.MODE_EMPTY:
        this.clearStructure();

        break;

    // Text
    case SearchBar.MODE_TEXT:
        this.clearStructure();
        break;

    // Custom structure
    case SearchBar.MODE_CUSTOM:
        try {
            var json = this.getValue().trim().match(/^#(?:structure=)?(\[.*\])/i)[1];
            var builderGraph = this.getBuilderGraphFromJSON(json);
            this.graphBuilder.convertFromBG(builderGraph);
        }
        catch (exception) {
            this.clearStructure();
            $("#searchbar #bar > input").css("color", "red");
        }
        break;

    // Predefined Structure
    case SearchBar.MODE_PREDEFINED:
        this.clearStructure();
        break;

    // Network motifs
    case SearchBar.MODE_MOTIF:
        break;

    default:
        throw new Exception("Invalid mode in SearchBar");
        break;
    }

    this.updateLocked = false;
};

/**
 * Gets the value of the text in the search bar.
 * 
 * @returns {String} The text in the search bar
 */
SearchBar.prototype.getValue = function() {
    return $("#searchbar #bar > input").val();
};

/**
 * Sets the value of the text in the search bar
 * 
 * @param {String} val The new value of the text in the search bar
 */
SearchBar.prototype.setValue = function(val) {
    $("#searchbar #bar > input").val(val);
    this.updateMode();
};

/**
 * Determines if the drop-down panel is currently shown
 * 
 * @returns {Boolean} true if drop-down panel is shown
 */
SearchBar.prototype.isPanelShown = function() {
    return $("#searchbar #panel:visible").length;
};

/**
 * Shows the drop-down panel
 */
SearchBar.prototype.showPanel = function() {
    var context = this;

    $("#searchbar input").addClass("focus");
    $("#searchbar #panel").show();
    $(window).on("mousedown", function(e) {
        var $target = $(e.target);
        if (!$target.parents("#searchbar").length)
            context.hidePanel();
    });
};

/**
 * Shows search history in its tab
 */
 SearchBar.prototype.showSearchHistory = function() {
    var context = this;
    if (context.storageAvailable()) {
        // Remove the existing content
        var searchHistoryTab =  $("#searchbar #searchHistoryTab");
        searchHistoryTab.empty();

        // Parse the serach history and add it to the tab
        var history = [];
        history = JSON.parse(localStorage.getItem(SearchBar.SEARCH_HISTORY_KEY));
        history.reverse().forEach((previousSearch) => {
            searchHistoryTab.append('<dt class="historyItem"><code>' + previousSearch + '</code></dt>');
        })

        // Event handler for items added above
        $("#searchbar .historyItem").on("click", async function(e) {
            var clickedText = jQuery(this).text();
            context.setValue(clickedText)
            await context.queryServer();
            context.hidePanel();
        });
    } 
};

/**
 * Hides the drop-down panel
 */
SearchBar.prototype.hidePanel = function() {
    $("#bar input").blur().removeClass("focus");
    $(".hostConstraintDialog").hide();
    $("#searchbar #panel").hide();
    $(window).unbind("mousedown");
};

/**
 * Clears the drawn structure
 */
SearchBar.prototype.clearStructure = function() {
    this.graphBuilder.clear();
};

/**
 * Clears the text input
 */
SearchBar.prototype.clearText = function() {
    this.setValue("");
};

/**
 * Clears search results. In other words, un-highlights found nodes and motifs
 */
SearchBar.prototype.clearResults = function() {
    $("#searchbar").removeClass("results");
    this.motifNavigator = null;
    if (this.global != null && this.global.getController().hasHighlight()) {
        this.global.getController().clearHighlight();
    } else {
        // Show the pairwise button on the log lines tab when clearing a motif search
        if (this.global.getViews().length > 1 && !$(".leftTabLinks li").first().next().hasClass("default") && !$(".pairwiseButton").is(":visible")) {
            $(".pairwiseButton").show();
        }
    }
    $(".clusterBase").removeClass("fade");
    $(".clusterResults a").removeClass("execFade");
};

/**
 * Clears the drawn motif, the text input, and the search results
 * 
 * @see {@link SearchBar#clearStructure}
 * @see {@link SearchBar#clearText}
 * @see {@link SearchBar#clearResults}
 */
SearchBar.prototype.clear = async function(shouldClearServer) {
    console.log("CALLING CLEAR FOR SOME REASON");
    if (shouldClearServer === false) {
        return;
    }
    if (shouldClearServer || shouldClearServer === undefined) {
        const message = {
            type: "searchRequest",
            clear: true,
        };
        const promise = ws.sendWithRetry(message);
        const response = await promise;
        if (!response.success) {
            Shiviz.getInstance().handleException(new Exception("clear should success on the server", true));
        }
    }
    this.numInstances = undefined;
    this.clearStructure();
    this.clearText();
    this.clearResults();
};

SearchBar.prototype.queryServer = async function() {
    this.updateMode();

    // ask the server to perform this query,
    const queryString = this.getValue();
    const message = {
        type: "searchRequest",
        queryString: queryString,
    };
    const promise = ws.sendWithRetry(message);
    const response = await promise;
    console.log("got response, calling handleNExtResuleFromServer");
    await this.handleNextResuleFromServer(queryString, response);
}

SearchBar.prototype.getNextResultFromServer = async function(delta, index) {
    // ask the server to perform this query,
    const queryString = this.getValue();
    const message = {
        type: "nextResultRequest",
        delta: delta,
        index: index,
    };
    const promise = ws.sendWithRetry(message);
    const response = await promise;
    await this.handleNextResuleFromServer(queryString, response);
}

SearchBar.prototype.handleNextResuleFromServer = async function(queryString, response) {
    console.log("got query server response", response.startOffset, response.endOffset, response.numInstances);
    if (response.searchSuccessful) {
        await Shiviz.getInstance().handleLogsFromServer(response, false);
    }
    this.setValue(queryString);
    // console.log("line to highlight from server is ", response.lineToHighlight)
    console.log("Making same query", this.getValue(), "line to highlight", response.lineToHighlight);
    this.query(response.lineToHighlight);
    this.numInstances = response.numInstances;
    this.motifNavigator.numInstances = response.numInstances;
    // this.motifNavigator.next();
    this.hidePanel();
    // $("#numFound").text(`${response.index+1}/${this.numInstances}`);
    // $('#numFoundInput').prop('placeholder', `${response.index}`);
    $("#numFoundInput").val(`${response.index+1}`);
    $("#numFoundTotal").text(`/${this.numInstances}`);
    // var id = "#node" + motifData.id;
    // $(id)[0].dispatchEvent(new MouseEvent("mouseover"));
}

/**
 * Performs a query based on what is currently in the text field.
 */
SearchBar.prototype.query = async function(lineToHighlight) {

    // this.updateMode();

    var searchbar = this;

    console.log("Making query", this.mode);

    try {
        switch (this.mode) {
        case SearchBar.MODE_EMPTY:
            this.clearResults();
            break;

        case SearchBar.MODE_TEXT:
            var finder = new TextQueryMotifFinder(this.getValue());
            this.global.getController().highlightMotif(finder, lineToHighlight);
            break;

        case SearchBar.MODE_CUSTOM:
            try {
                var json = this.getValue().trim().match(/^#(?:structure=)?(\[.*\])/i)[1];
                var builderGraph = this.getBuilderGraphFromJSON(json);
                var finder = new CustomMotifFinder(builderGraph);
                this.global.getController().highlightMotif(finder, lineToHighlight);
            }
            catch (exception) {
                console.log("Got exception", exception);
                $("#searchbar #bar > input").css("color", "red");
                return;
            }
            break;

        case SearchBar.MODE_PREDEFINED:
            var value = this.getValue();
            var type = value.trim().match(/^#(?:motif=)?(.*)/i)[1];

            if (type == "request-response") {
                var finder = new RequestResponseFinder(999, 4);
                this.global.getController().highlightMotif(finder, lineToHighlight);
                break;
            }
            else if (type == "broadcast" || type == "gather") {
                var broadcast;
                if (type == "broadcast")
                    broadcast = true;
                else
                    broadcast = false;

                this.global.getViews().forEach(function(view) {

                    var hiddenHosts = view.getTransformer().getHiddenHosts();
                    var hiddenHosts = view.getTransformer().getHiddenHosts();
                    var hosts = view.getHosts().filter(function(h) {
                        return !hiddenHosts[h];
                    }).length;
                    var finder = new BroadcastGatherFinder(hosts - 1, 4, broadcast);

                    view.getTransformer().highlightMotif(finder, false, lineToHighlight);
                });

                this.global.drawAll();
            }
            else {
                throw new Exception(type + " is not a built-in motif type", true);
            }

            break;

        case SearchBar.MODE_MOTIF:
            var prefix = "/shiviz/log/";
            var url = prefix + "motifs.json";

            $.get(url, function(response) {
                handleMotifResponse(response);
            }).fail(function() {
                prefix = "https://api.github.com/repos/bestchai/shiviz-logs/contents/";
                url = prefix + "motifs.json";

                $.get(url, function(response) {
                    response = atob(response.content);
                    handleMotifResponse(response);
                }).fail(function() {
                    Shiviz.getInstance().handleException(new Exception("unable to retrieve motifs from: " + url, true));
                });
            });
            break;

        default:
            throw new Exception("SearchBar.prototype.query: invalid mode");
            break;
        }
    }
    catch (e) {
        Shiviz.getInstance().handleException(e);
    }
    if (this.mode != SearchBar.MODE_MOTIF) {
        // reset the motifs tab when performing other searches
        this.clearMotifsTab();

        // For the network motifs search, motifs are only highlighted when a user clicks on an execution in the motifs tab
        // so countMotifs() should not be called during the initial search but during the on-click event in MotifDrawer.js
        $("#searchbar").addClass("results");
        this.countMotifs();
    }

    function handleMotifResponse(response) {
        var lines = response.split("\n");
        var viewToCount = {};
        var builderGraphs = [];

        // Get the relevant subgraphs from motifs.json based on ticked checkboxes
        var twoEventCutoff = lines.indexOf("2-event subgraphs");
        var threeEventCutoff = lines.indexOf("3-event subgraphs");
        var fourEventCutoff = lines.indexOf("4-event subgraphs");                

        if (!$("#motifOption #fourEvents").is(":checked")) {
            lines.splice(fourEventCutoff, lines.length - fourEventCutoff);
        }

        if (!$("#motifOption #threeEvents").is(":checked")) {
            lines.splice(threeEventCutoff, fourEventCutoff - threeEventCutoff);     
        }

        if (!$("#motifOption #twoEvents").is(":checked")) {
            var twoEventCutoff = lines.indexOf("2-event subgraphs");
            lines.splice(twoEventCutoff, threeEventCutoff - twoEventCutoff);
        }

        // Find the number of instances of a subgraph in each view
        lines.forEach(function(line) {
            if (isNaN(line.charAt(0))) {
                var builderGraph = searchbar.getBuilderGraphFromJSON(line);
                builderGraphs.push(builderGraph);

                var finder = new CustomMotifFinder(builderGraph);
                var hmt = new HighlightMotifTransformation(finder, false, lineToHighlight);

                searchbar.global.getViews().forEach(function(view) {
                    var label = view.getLabel();

                    hmt.findMotifs(view.getModel());
                    var motifGroup = hmt.getHighlighted();
                    var numMotifs = motifGroup.getMotifs().length;

                    // Save the number of instances of this motif under the current view's label
                    if (viewToCount[label]) {
                        viewToCount[label].push(numMotifs);
                    } else {
                        viewToCount[label] = [numMotifs];
                    }
                });
            }
        });
        
        // Calculate motifs and draw the results in the motifs tab
        var motifDrawer = new MotifDrawer(viewToCount, builderGraphs);
        motifDrawer.drawResults();

        // Switch to the Motifs tab and clear any previously highlighted results
        $(".leftTabLinks li").first().next().show().find("a").click();
        searchbar.clearResults();
    }
};

/**
  * Creates a BuilderGraph from a json object containing hosts and vector timestamps
  *
  * @param {String} json The json object specifying hosts and vector timestamps
  * @returns {BuilderGraph} the builderGraph created from the given json object
  */
SearchBar.prototype.getBuilderGraphFromJSON = function(json) {
    var rawRegExp = '(?<event>){"host":"(?<host>[^}]+)","clock":(?<clock>{[^}]*})}';
    var parsingRegex = new NamedRegExp(rawRegExp, "i");
    var parser = new LogParser(json, null, parsingRegex);
    var logEvents = parser.getLogEvents(parser.getLabels()[0]);
    var vectorTimestamps = logEvents.map(function(logEvent) {
        return logEvent.getVectorTimestamp();
    });
    var gbHosts = this.graphBuilder.getHosts();
    var hostConstraints = gbHosts.map(function(gbHost) {
        return gbHost.getConstraint() != "";
    });
    return BuilderGraph.fromVectorTimestamps(vectorTimestamps, hostConstraints);
}

/**
  * This function creates a new MotifNavigator to count the number of times a highlighted motif occurs in the active views
  */
SearchBar.prototype.countMotifs = function() {
    // Only compute and display the motif count if a search is being performed
    if ($("#searchbar").hasClass("results")) {
        var views = this.global.getActiveViews();
        this.motifNavigator = new MotifNavigator();
        this.motifNavigator.numInstances = this.numInstances;
        this.motifNavigator.addMotif(views[0].getVisualModel(), views[0].getTransformer().getHighlightedMotif());
        if (this.global.getPairwiseView()) {
            this.motifNavigator.addMotif(views[1].getVisualModel(), views[1].getTransformer().getHighlightedMotif());
        }
        this.motifNavigator.start();
        console.log("local num found is ", this.motifNavigator.getNumMotifs());
        // var numMotifs = this.motifNavigator.getNumMotifs();
        // var numInstances = numMotifs + " instance";
        // if (numMotifs == 0 || numMotifs > 1) {
        //     numInstances = numInstances.concat("s");
        // }
        // $("#numFound").text(numInstances + " in view");
    }
};

/**
 * Clears the results in the motifs tab and uncheck all the checkboxes
 */
SearchBar.prototype.clearMotifsTab = function() {
    $("#motifOption input").prop("checked", false);
    $(".motifResults td").empty();
    $(".motifResults td:empty").remove();
}

/**
 * Resets the motif results so that no execution is selected
 */
SearchBar.prototype.resetMotifResults = function() {
    // Clear the #motif value in the searchbar if not on the motifs tab
    if (!$(".leftTabLinks li").first().next().hasClass("default")) {
        this.clearText();
    }
    $("#motifIcon").remove();
    $(".motifResults a").removeClass("indent");
}

/** 
 * Checks if local storage is supported by the browser 
 */
SearchBar.prototype.storageAvailable = function() {
    var storage;
    try {
        storage = window["localStorage"];
        var x = '__storage_test__';
        storage.setItem(x, x);
        storage.removeItem(x);
        return true;
    }
    catch(e) {
        return e instanceof DOMException && (
            // everything except Firefox
            e.code === 22 ||
            // Firefox
            e.code === 1014 ||
            // test name field too, because code might not be present
            // everything except Firefox
            e.name === 'QuotaExceededError' ||
            // Firefox
            e.name === 'NS_ERROR_DOM_QUOTA_REACHED') &&
            // acknowledge QuotaExceededError only if there's something already stored
            (storage && storage.length !== 0);
    }
}

/**
 * Adds the given value to the seatch history.
 */
SearchBar.prototype.addToSearchHistory = function(item) {
    // Check if storage is available, if not, search history is not possible
    if (this.storageAvailable()) {

        // history is a queue
        var history = [];

        // Check if any item exists in the search history
        if (!localStorage.getItem(SearchBar.SEARCH_HISTORY_KEY)) {
            localStorage.setItem(SearchBar.SEARCH_HISTORY_KEY, JSON.stringify(history));
        }

        history = JSON.parse(localStorage.getItem(SearchBar.SEARCH_HISTORY_KEY));

        // Check if the value is already in the history, if true, return
        if (history.includes(item)) {
            return;
        }

        // If search history reaches limit, remove the oldest value
        if (history.length == SearchBar.MAX_NUM_OF_ELEMENTS_IN_HISTORY) {
            history.shift();
        }

        history.push(item);
        localStorage.setItem(SearchBar.SEARCH_HISTORY_KEY, JSON.stringify(history));
    }
}